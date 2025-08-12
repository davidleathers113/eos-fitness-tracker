const { connectLambda } = require("@netlify/blobs");
const { createLogger, formatErrorResponse, formatSuccessResponse } = require("./_shared/logger");
const { generateUserToken, createNewUser, checkRateLimit } = require("./_shared/auth");

exports.handler = async (event, context) => {
    // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
    connectLambda(event);
    
    // Create structured logger for this request
    const logger = createLogger('auth', event, context);
    logger.info('Auth function invoked', { method: event.httpMethod });
    
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
        const rateLimit = checkRateLimit(`auth:${clientIp}`, 60000, 10); // 10 auth requests per minute
        
        if (!rateLimit.allowed) {
            logger.warn('Auth rate limit exceeded', { ip: clientIp });
            const errorResponse = formatErrorResponse(logger, new Error('Rate limit exceeded'), 'Too many authentication requests');
            return {
                statusCode: 429,
                headers: {
                    ...headers,
                    'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
                },
                body: JSON.stringify(errorResponse)
            };
        }

        if (event.httpMethod === 'POST') {
            // Create new user or refresh existing token
            let userId, isNewUser = false;

            if (event.body) {
                try {
                    const requestBody = JSON.parse(event.body);
                    
                    if (requestBody.action === 'create_user') {
                        // Create completely new user
                        const newUser = createNewUser();
                        userId = newUser.userId;
                        isNewUser = true;
                        
                        logger.userAction('new-user-created', userId);
                        
                        const response = formatSuccessResponse({
                            userId: newUser.userId,
                            token: newUser.token,
                            isNewUser: true,
                            message: 'New user created successfully'
                        }, logger);

                        return {
                            statusCode: 201,
                            headers,
                            body: JSON.stringify(response)
                        };
                        
                    } else if (requestBody.action === 'generate_token' && requestBody.userId) {
                        // Generate token for existing user ID (migration support)
                        userId = requestBody.userId;
                        const token = generateUserToken(userId);
                        
                        logger.userAction('token-generated', userId, { reason: 'migration' });
                        
                        const response = formatSuccessResponse({
                            userId: userId,
                            token: token,
                            isNewUser: false,
                            message: 'Token generated successfully'
                        }, logger);

                        return {
                            statusCode: 200,
                            headers,
                            body: JSON.stringify(response)
                        };
                    }
                } catch (parseError) {
                    logger.warn('Invalid JSON in auth request body');
                    const errorResponse = formatErrorResponse(logger, parseError, 'Invalid JSON in request body');
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify(errorResponse)
                    };
                }
            }

            // Default: create new user if no specific action
            const newUser = createNewUser();
            logger.userAction('new-user-created', newUser.userId);
            
            const response = formatSuccessResponse({
                userId: newUser.userId,
                token: newUser.token,
                isNewUser: true,
                message: 'New user created successfully'
            }, logger);

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify(response)
            };

        } else if (event.httpMethod === 'GET') {
            // Health check / info endpoint
            const response = formatSuccessResponse({
                service: 'EOS Fitness Tracker Authentication',
                version: '2.0',
                endpoints: {
                    'POST /': 'Create new user or generate token',
                    'GET /': 'Service information'
                }
            }, logger);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response)
            };

        } else {
            // Method not allowed
            logger.warn('Method not allowed', { method: event.httpMethod });
            const errorResponse = formatErrorResponse(logger, new Error(`Method ${event.httpMethod} not allowed`), 'Method not allowed');
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify(errorResponse)
            };
        }

    } catch (error) {
        logger.error('Unexpected error in auth function', error);

        const errorResponse = formatErrorResponse(logger, error, 'Authentication service error');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify(errorResponse)
        };
    }
};