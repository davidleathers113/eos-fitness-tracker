const { getStore, connectLambda } = require("@netlify/blobs");
const { createLogger, formatErrorResponse, formatSuccessResponse } = require("./_shared/logger");
const { authenticateUser, createNewUser, checkRateLimit } = require("./_shared/auth");

// Validation function (matches frontend validation)
function validateSettings(settings) {
    if (!settings || typeof settings !== 'object') return false;
    if (!settings.user || typeof settings.user !== 'object') return false;
    if (!settings.equipment_settings || typeof settings.equipment_settings !== 'object') return false;
    if (!settings.user.name || typeof settings.user.name !== 'string') return false;
    return true;
}

// Default settings structure
function getDefaultSettings() {
    return {
        user: {
            name: "User",
            experience_level: "beginner",
            goals: ["general_fitness"],
            typical_duration: 45,
            preferred_zones: ["A", "B", "C"],
            gym_location: "EOS Fitness Lutz, Florida"
        },
        equipment_settings: {},
        quick_substitutes: {},
        preferences: {
            show_zones: true,
            auto_save: true,
            notification_sound: false,
            theme: "light"
        }
    };
}

// This function is deprecated - replaced by secure authentication
// Kept for reference during migration period

exports.handler = async(event, context) => {
    // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
    connectLambda(event);
    
    // Create structured logger for this request
    const logger = createLogger('user-settings', event, context);
    logger.info('Function invoked', { method: event.httpMethod });
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://eos-fitness-tracker.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-token, x-user-id',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        logger.info('CORS preflight request handled');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Rate limiting check
        const clientIp = event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || 'unknown';
        const rateLimit = checkRateLimit(clientIp, 60000, 30); // 30 requests per minute
        
        if (!rateLimit.allowed) {
            logger.warn('Rate limit exceeded', { ip: clientIp });
            const errorResponse = formatErrorResponse(logger, new Error('Rate limit exceeded'), 'Too many requests');
            return {
                statusCode: 429,
                headers: {
                    ...headers,
                    'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
                },
                body: JSON.stringify(errorResponse)
            };
        }

        // Authenticate user
        const auth = authenticateUser(event, logger);
        if (!auth.authenticated) {
            const errorResponse = formatErrorResponse(logger, new Error('Authentication failed'), auth.error || 'Authentication required');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify(errorResponse)
            };
        }

        const userStore = getStore("user-settings");
        const userId = auth.userId;
        const settingsKey = `settings-${userId}`;
        
        logger.userAction('settings-request', userId, { 
            method: event.httpMethod, 
            isLegacy: auth.isLegacy,
            remainingRequests: rateLimit.remaining 
        });

        if (event.httpMethod === 'GET') {
            logger.dataOperation('read', 'user-settings', settingsKey, userId);
            
            // Retrieve user settings with metadata (including ETag)
            const result = await userStore.getWithMetadata(settingsKey, { type: 'json' });

            if (result === null) {
                logger.info('New user - returning default settings', { userId });
                // Return default settings for new users (no ETag since not stored yet)
                const defaultSettings = getDefaultSettings();
                const response = formatSuccessResponse({
                    settings: defaultSettings,
                    userId: userId,
                    isNewUser: true,
                    etag: null
                }, logger);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(response)
                };
            }

            logger.info('Existing user settings retrieved', { 
                userId, 
                settingsCount: Object.keys(result.data.equipment_settings || {}).length,
                etag: result.etag
            });
            
            const response = formatSuccessResponse({
                settings: result.data,
                userId: userId,
                isNewUser: false,
                etag: result.etag,
                lastModified: result.lastModified
            }, logger);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response)
            };

        } else if (event.httpMethod === 'POST') {
            logger.dataOperation('write', 'user-settings', settingsKey, userId);
            
            // Save or update user settings
            if (!event.body) {
                logger.warn('Missing request body', { userId });
                const errorResponse = formatErrorResponse(logger, new Error('Request body required'), 'Request body is required');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify(errorResponse)
                };
            }

            let settings, ifMatch;
            try {
                const requestBody = JSON.parse(event.body);
                settings = requestBody.settings;
                ifMatch = requestBody.ifMatch; // Optional ETag for optimistic locking
            } catch (parseError) {
                logger.warn('Invalid JSON in request body', { userId });
                const errorResponse = formatErrorResponse(logger, parseError, 'Invalid JSON in request body');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify(errorResponse)
                };
            }

            // Validate settings structure
            if (!validateSettings(settings)) {
                logger.warn('Invalid settings structure', { userId });
                const errorResponse = formatErrorResponse(logger, new Error('Invalid settings structure'), 'Settings data is invalid');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify(errorResponse)
                };
            }

            // Add metadata
            const metadata = {
                lastUpdated: new Date().toISOString(),
                version: '2.0',
                source: 'eos-fitness-tracker',
                correlationId: logger.correlationId
            };

            // Prepare save options with ETag-based optimistic locking
            const saveOptions = { metadata };
            if (ifMatch) {
                saveOptions.onlyIfMatch = ifMatch;
                logger.info('Using ETag-based optimistic locking', { userId, ifMatch });
            }

            // Save to Netlify Blobs with proper ETag handling
            try {
                const result = await userStore.setJSON(settingsKey, settings, saveOptions);
                
                // Check if the write was actually performed (modified = false means ETag mismatch)
                if (ifMatch && !result.modified) {
                    logger.warn('ETag mismatch - concurrent modification detected', { 
                        userId, 
                        providedETag: ifMatch,
                        modified: result.modified
                    });
                    
                    const conflictResponse = formatErrorResponse(logger, 
                        new Error('ETag mismatch'), 
                        'Conflict: Data was modified by another client. Please refresh and try again.');
                    
                    return {
                        statusCode: 409, // Conflict
                        headers,
                        body: JSON.stringify(conflictResponse)
                    };
                }
                
                logger.info('Settings saved successfully', { 
                    userId, 
                    modified: result.modified, 
                    etag: result.etag,
                    hadIfMatch: !!ifMatch,
                    equipmentCount: Object.keys(settings.equipment_settings || {}).length
                });

                const response = formatSuccessResponse({
                    success: true,
                    userId: userId,
                    modified: result.modified,
                    etag: result.etag
                }, logger);

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(response)
                };
                
            } catch (error) {
                // Handle potential onlyIfMatch errors or other issues
                logger.error('Error saving settings', error, { userId, hadIfMatch: !!ifMatch });
                
                // Re-throw to be handled by outer catch block
                throw error;
            }

        } else {
            // Method not allowed
            logger.warn('Method not allowed', { method: event.httpMethod, userId });
            const errorResponse = formatErrorResponse(logger, new Error(`Method ${event.httpMethod} not allowed`), 'Method not allowed');
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify(errorResponse)
            };
        }

    } catch (error) {
        // Try to get userId for logging, but don't fail if auth fails
        let userId = 'unknown';
        try {
            const auth = authenticateUser(event, logger);
            if (auth.authenticated) userId = auth.userId;
        } catch (authError) {
            // Ignore auth errors in error handler
        }

        logger.error('Unexpected error in user-settings function', error, { userId });

        const errorResponse = formatErrorResponse(logger, error, 'An unexpected error occurred');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify(errorResponse)
        };
    }
};