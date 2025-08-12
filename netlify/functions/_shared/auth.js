/**
 * Secure authentication utilities for EOS Fitness Tracker
 * Implements HMAC-signed user tokens to prevent forgeable user IDs
 */

const crypto = require('crypto');

// Get HMAC secret from environment - REQUIRED in production
const HMAC_SECRET = process.env.USER_TOKEN_SECRET;

// Fail fast if using default secret in production
if (!HMAC_SECRET) {
  throw new Error('USER_TOKEN_SECRET environment variable is required for secure authentication');
}

if (HMAC_SECRET === 'default-secret-change-in-production') {
  throw new Error('USER_TOKEN_SECRET must be changed from default value in production');
}

/**
 * Generate a secure user token with HMAC signature
 * @param {string} userId - User ID to sign
 * @param {number} expiresIn - Token expiration in milliseconds (default 30 days)
 * @returns {string} Signed token
 */
function generateUserToken(userId, expiresIn = 30 * 24 * 60 * 60 * 1000) {
  const expiration = Date.now() + expiresIn;
  const payload = JSON.stringify({ userId, exp: expiration });
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex');
  
  // Format: base64(payload).signature
  const token = Buffer.from(payload).toString('base64') + '.' + signature;
  return token;
}

/**
 * Verify and extract user ID from signed token
 * @param {string} token - Signed token to verify
 * @returns {Object} { valid: boolean, userId?: string, expired?: boolean, error?: string }
 */
function verifyUserToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Missing or invalid token' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [payloadBase64, signature] = parts;
    
    // Decode payload
    let payload;
    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      payload = JSON.parse(payloadJson);
    } catch (error) {
      return { valid: false, error: 'Invalid token payload' };
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(Buffer.from(payloadBase64, 'base64').toString('utf8'))
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      return { valid: false, error: 'Invalid token signature' };
    }

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, expired: true, error: 'Token expired' };
    }

    return { valid: true, userId: payload.userId };
  } catch (error) {
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Extract user authentication from request
 * Supports both signed tokens and fallback to legacy x-user-id for migration period
 * @param {Object} event - Netlify event object
 * @param {Object} logger - Logger instance
 * @returns {Object} { authenticated: boolean, userId?: string, isLegacy?: boolean, error?: string }
 */
function authenticateUser(event, logger) {
  // Check for Authorization header with Bearer token (preferred)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const verification = verifyUserToken(token);
    
    if (verification.valid) {
      logger.info('User authenticated with signed token', { userId: verification.userId });
      return { authenticated: true, userId: verification.userId };
    } else {
      logger.warn('Invalid authentication token', { error: verification.error });
      return { authenticated: false, error: verification.error };
    }
  }

  // Check for signed token in x-user-token header
  const tokenHeader = event.headers['x-user-token'];
  if (tokenHeader) {
    const verification = verifyUserToken(tokenHeader);
    
    if (verification.valid) {
      logger.info('User authenticated with token header', { userId: verification.userId });
      return { authenticated: true, userId: verification.userId };
    } else {
      logger.warn('Invalid user token header', { error: verification.error });
      return { authenticated: false, error: verification.error };
    }
  }

  // Check if legacy authentication is enabled (for migration period only)
  const allowLegacyAuth = process.env.ALLOW_LEGACY_AUTH === 'true';
  
  if (allowLegacyAuth) {
    // Fallback to legacy x-user-id (DEPRECATED - only for migration)
    const legacyUserId = event.headers['x-user-id'];
    if (legacyUserId) {
      logger.warn('Using DEPRECATED legacy user ID authentication - update client to use secure tokens', { userId: legacyUserId });
      return { authenticated: true, userId: legacyUserId, isLegacy: true };
    }

    // Check body for userId (migration scenarios)
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        if (body.userId) {
          logger.warn('Using DEPRECATED body userId for authentication - update client to use secure tokens', { userId: body.userId });
          return { authenticated: true, userId: body.userId, isLegacy: true };
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }
  }

  logger.warn('No valid authentication found in request');
  return { authenticated: false, error: 'Authentication required' };
}

/**
 * Generate a new user ID and corresponding signed token
 * @returns {Object} { userId: string, token: string }
 */
function createNewUser() {
  const userId = 'user-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex');
  const token = generateUserToken(userId);
  
  return { userId, token };
}

/**
 * Parse and normalize client IP address from request headers
 * @param {Object} event - Netlify event object
 * @returns {string} Normalized IP address
 */
function getClientIp(event) {
  // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
  // First IP is the original client
  const forwardedFor = event.headers['x-forwarded-for'];
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  
  // Fallback to other IP headers
  return event.headers['x-nf-client-connection-ip'] || 
         event.headers['x-real-ip'] || 
         'unknown';
}

/**
 * Rate limiting check (simple in-memory implementation)
 * 
 * WARNING: This in-memory rate limiter has limitations:
 * - Per-instance only (not effective across serverless function instances)
 * - Lost on cold starts/restarts
 * - No persistence across deployments
 * 
 * For production at scale, replace with:
 * - Redis with TTL keys
 * - Netlify Blobs with ETag-based atomic updates
 * - External rate limiting service (e.g., Upstash, Cloudflare)
 */
const rateLimitStore = new Map();

function checkRateLimit(identifier, windowMs = 60000, maxRequests = 60) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get existing requests for this identifier
  const requests = rateLimitStore.get(identifier) || [];
  
  // Remove expired entries
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (validRequests.length >= maxRequests) {
    return { allowed: false, resetTime: Math.min(...validRequests) + windowMs };
  }
  
  // Add current request and update store
  validRequests.push(now);
  rateLimitStore.set(identifier, validRequests);
  
  return { allowed: true, remaining: maxRequests - validRequests.length };
}

module.exports = {
  generateUserToken,
  verifyUserToken,
  authenticateUser,
  createNewUser,
  checkRateLimit,
  getClientIp
};