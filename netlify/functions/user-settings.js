const { getStore, connectLambda } = require("@netlify/blobs");
const { createLogger, formatErrorResponse, formatSuccessResponse } = require("./_shared/logger");

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

// Generate or retrieve user ID from headers or create new one
function getUserId(event) {
    // Check for user ID in headers (future enhancement)
    let userId = event.headers['x-user-id'];

    // If not provided, check body for userId (for migration)
    if (!userId && event.body) {
        try {
            const body = JSON.parse(event.body);
            userId = body.userId;
        } catch (e) {
            // Ignore parse errors
        }
    }

    // Generate new user ID if none provided
    if (!userId) {
        userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    return userId;
}

exports.handler = async(event, context) => {
    // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
    connectLambda(event);
    
    // Create structured logger for this request
    const logger = createLogger('user-settings', event, context);
    logger.info('Function invoked', { method: event.httpMethod });
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://eos-fitness-tracker.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, x-user-id',
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
        const userStore = getStore("user-settings");
        const userId = getUserId(event);
        const settingsKey = `settings-${userId}`;
        
        logger.userAction('settings-request', userId, { method: event.httpMethod });

        if (event.httpMethod === 'GET') {
            logger.dataOperation('read', 'user-settings', settingsKey, userId);
            
            // Retrieve user settings
            const settings = await userStore.get(settingsKey, { type: 'json' });

            if (settings === null) {
                logger.info('New user - returning default settings', { userId });
                // Return default settings for new users
                const defaultSettings = getDefaultSettings();
                const response = formatSuccessResponse({
                    settings: defaultSettings,
                    userId: userId,
                    isNewUser: true
                }, logger);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(response)
                };
            }

            logger.info('Existing user settings retrieved', { userId, settingsCount: Object.keys(settings.equipment_settings || {}).length });
            const response = formatSuccessResponse({
                settings: settings,
                userId: userId,
                isNewUser: false
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

            let settings;
            try {
                const requestBody = JSON.parse(event.body);
                settings = requestBody.settings;
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

            // Save to Netlify Blobs
            const result = await userStore.setJSON(settingsKey, settings, { metadata });
            
            logger.info('Settings saved successfully', { 
                userId, 
                modified: result.modified, 
                etag: result.etag,
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
        logger.error('Unexpected error in user-settings function', error, { userId: getUserId(event) });

        const errorResponse = formatErrorResponse(logger, error, 'An unexpected error occurred');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify(errorResponse)
        };
    }
};