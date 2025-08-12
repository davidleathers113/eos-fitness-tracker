const { getStore, connectLambda } = require("@netlify/blobs");
const { createLogger, formatErrorResponse, formatSuccessResponse } = require("./_shared/logger");
const { authenticateUser, checkRateLimit } = require("./_shared/auth");
const fs = require('fs/promises');
const path = require('path');

// This function is deprecated - replaced by secure authentication
// Kept for reference during migration period

// Load equipment database from static file
async function loadEquipmentDatabase() {
  try {
    // Use __dirname for more robust path resolution
    const equipmentPath = path.resolve(__dirname, '../../database/equipment-database.json');
    const equipmentData = await fs.readFile(equipmentPath, 'utf8');
    return JSON.parse(equipmentData);
  } catch (error) {
    console.error('Error loading equipment database:', error);
    // Return minimal structure if file not found
    return {
      metadata: {
        version: "2.0",
        last_updated: new Date().toISOString().split('T')[0],
        total_equipment: 0,
        gym_location: "EOS Fitness Lutz, Florida"
      },
      equipment: []
    };
  }
}

exports.handler = async (event, context) => {
  // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
  connectLambda(event);
  
  // Create structured logger for this request
  const logger = createLogger('export-data', event, context);
  logger.info('Function invoked', { method: event.httpMethod });
  
  const headers = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://eos-fitness-tracker.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, max-age=0',
    'Vary': 'Origin'
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

  if (event.httpMethod !== 'GET') {
    logger.warn('Method not allowed', { method: event.httpMethod });
    const errorResponse = formatErrorResponse(logger, new Error(`Method ${event.httpMethod} not allowed`), 'Method not allowed');
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }

  try {
    // Rate limiting check
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['x-nf-client-connection-ip'] || 'unknown';
    const rateLimit = checkRateLimit(clientIp, 300000, 5); // 5 exports per 5 minutes
    
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for export', { ip: clientIp });
      const errorResponse = formatErrorResponse(logger, new Error('Rate limit exceeded'), 'Too many export requests');
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

    const userId = auth.userId;
    logger.userAction('export-request', userId, { 
      isLegacy: auth.isLegacy,
      remainingRequests: rateLimit.remaining 
    });

    // Get user stores
    const settingsStore = getStore("user-settings");
    const logsStore = getStore("workout-logs");

    // Retrieve user data from Netlify Blobs
    const [userSettings, workoutLogs, equipmentDatabase] = await Promise.all([
      settingsStore.get(`settings-${userId}`, { type: 'json' }),
      logsStore.get(`logs-${userId}`, { type: 'json' }),
      loadEquipmentDatabase()
    ]);

    // Default structures if data not found
    const defaultSettings = {
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

    const defaultLogs = {
      workouts: [],
      templates: [],
      statistics: {
        total_workouts: 0,
        total_time: 0,
        favorite_equipment: {},
        monthly_summary: {}
      }
    };

    // Create export data structure (maintains compatibility with existing format)
    const exportData = {
      version: '2.0',
      exported_at: new Date().toISOString(),
      export_source: 'netlify-blobs',
      user_id: userId,
      settings: userSettings || defaultSettings,
      workout_logs: workoutLogs || defaultLogs,
      equipment_database: equipmentDatabase,
      metadata: {
        total_workouts: (workoutLogs?.workouts?.length || 0),
        total_equipment: equipmentDatabase.equipment?.length || 0,
        export_type: 'complete',
        gym_location: "EOS Fitness Lutz, Florida"
      }
    };

    // Add summary statistics
    if (workoutLogs?.workouts?.length > 0) {
      const workouts = workoutLogs.workouts;
      const totalTime = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
      const uniqueEquipment = new Set();
      
      workouts.forEach(workout => {
        workout.exercises?.forEach(exercise => {
          uniqueEquipment.add(exercise.equipment_id);
        });
      });

      exportData.metadata.total_workout_time_minutes = totalTime;
      exportData.metadata.unique_equipment_used = uniqueEquipment.size;
      exportData.metadata.average_workout_duration = Math.round(totalTime / workouts.length);
      
      // Find date range
      const dates = workouts.map(w => w.date).filter(Boolean).sort();
      if (dates.length > 0) {
        exportData.metadata.first_workout_date = dates[0];
        exportData.metadata.last_workout_date = dates[dates.length - 1];
      }
    }

    // Determine response format based on Accept header
    const acceptHeader = event.headers['accept'] || '';
    const wantsDownload = event.queryStringParameters?.download === 'true';

    if (wantsDownload || acceptHeader.includes('application/octet-stream')) {
      // Return as downloadable JSON file
      const filename = `eos-fitness-backup-${userId}-${new Date().toISOString().split('T')[0]}.json`;
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': Buffer.byteLength(JSON.stringify(exportData, null, 2), 'utf8').toString()
        },
        body: JSON.stringify(exportData, null, 2)
      };
    } else {
      // Return as JSON response
      logger.info('Export completed successfully', { 
        userId, 
        totalWorkouts: exportData.metadata.total_workouts,
        totalEquipment: exportData.metadata.total_equipment
      });

      const response = formatSuccessResponse({
        export_data: exportData,
        summary: {
          user_id: userId,
          total_workouts: exportData.metadata.total_workouts,
          total_equipment: exportData.metadata.total_equipment,
          export_timestamp: exportData.exported_at
        }
      }, logger);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response)
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

    logger.error('Unexpected error in export-data function', error, { userId });

    const errorResponse = formatErrorResponse(logger, error, 'An unexpected error occurred during export');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }
};