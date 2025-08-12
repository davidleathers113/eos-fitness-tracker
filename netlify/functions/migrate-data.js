const { getStore, connectLambda } = require("@netlify/blobs");
const { createLogger, formatErrorResponse, formatSuccessResponse } = require("./_shared/logger");
const { authenticateUser, checkRateLimit, getClientIp } = require("./_shared/auth");

// Validation functions (matching frontend)
function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') return false;
  if (!settings.user || typeof settings.user !== 'object') return false;
  if (!settings.equipment_settings || typeof settings.equipment_settings !== 'object') return false;
  if (!settings.user.name || typeof settings.user.name !== 'string') return false;
  return true;
}

function validateWorkoutLogs(logs) {
  if (!logs || typeof logs !== 'object') return false;
  if (!Array.isArray(logs.workouts)) return false;
  if (!Array.isArray(logs.templates)) return false;
  
  // Validate each workout structure
  for (const workout of logs.workouts) {
    if (!workout.id || !workout.date || !Array.isArray(workout.exercises)) {
      return false;
    }
  }
  
  return true;
}

// Generate unique user ID
function generateUserId() {
  return 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Merge settings with conflict resolution (local takes precedence)
function mergeSettings(cloudSettings, localSettings) {
  if (!cloudSettings) return localSettings;
  if (!localSettings) return cloudSettings;

  // Deep merge with local settings taking precedence
  const merged = JSON.parse(JSON.stringify(cloudSettings));
  
  // Merge user profile
  if (localSettings.user) {
    merged.user = { ...merged.user, ...localSettings.user };
  }
  
  // Merge equipment settings (local overrides cloud)
  if (localSettings.equipment_settings) {
    merged.equipment_settings = { ...merged.equipment_settings, ...localSettings.equipment_settings };
  }
  
  // Merge preferences
  if (localSettings.preferences) {
    merged.preferences = { ...merged.preferences, ...localSettings.preferences };
  }
  
  // Merge quick substitutes
  if (localSettings.quick_substitutes) {
    merged.quick_substitutes = { ...merged.quick_substitutes, ...localSettings.quick_substitutes };
  }
  
  return merged;
}

// Merge workout logs with conflict resolution (combine workouts, avoid duplicates)
function mergeWorkoutLogs(cloudLogs, localLogs) {
  if (!cloudLogs) return localLogs;
  if (!localLogs) return cloudLogs;

  const merged = JSON.parse(JSON.stringify(cloudLogs));
  
  // Merge workouts, avoiding duplicates by ID
  if (localLogs.workouts && Array.isArray(localLogs.workouts)) {
    const existingIds = new Set(merged.workouts.map(w => w.id));
    
    for (const workout of localLogs.workouts) {
      if (!existingIds.has(workout.id)) {
        merged.workouts.push(workout);
      }
    }
    
    // Sort by date (newest first)
    merged.workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  
  // Merge templates (local takes precedence for templates with same name)
  if (localLogs.templates && Array.isArray(localLogs.templates)) {
    const templateMap = new Map();
    
    // Add cloud templates first
    merged.templates.forEach(template => {
      templateMap.set(template.name, template);
    });
    
    // Override with local templates
    localLogs.templates.forEach(template => {
      templateMap.set(template.name, template);
    });
    
    merged.templates = Array.from(templateMap.values());
  }
  
  return merged;
}

// Update statistics after merging
function updateStatistics(logs) {
  const stats = {
    total_workouts: logs.workouts.length,
    total_time: logs.workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0),
    favorite_equipment: {},
    monthly_summary: {}
  };

  // Calculate equipment usage frequency
  logs.workouts.forEach(workout => {
    workout.exercises?.forEach(exercise => {
      const equipId = exercise.equipment_id;
      stats.favorite_equipment[equipId] = (stats.favorite_equipment[equipId] || 0) + 1;
    });

    // Monthly summary
    const monthKey = workout.date?.substring(0, 7); // YYYY-MM format
    if (monthKey) {
      if (!stats.monthly_summary[monthKey]) {
        stats.monthly_summary[monthKey] = { count: 0, total_time: 0 };
      }
      stats.monthly_summary[monthKey].count++;
      stats.monthly_summary[monthKey].total_time += (workout.duration_minutes || 0);
    }
  });

  logs.statistics = stats;
  return logs;
}

exports.handler = async (event, context) => {
  // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
  connectLambda(event);
  
  // Create structured logger for this request
  const logger = createLogger('migrate-data', event, context);
  logger.info('Migration function invoked', { method: event.httpMethod });
  
  const headers = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://eos-fitness-tracker.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    logger.warn('Method not allowed', { method: event.httpMethod });
    const errorResponse = formatErrorResponse(logger, 
      new Error(`Method ${event.httpMethod} not allowed`), 
      'Method not allowed. Use POST to migrate data.');
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }

  // Validate Content-Type
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (!contentType || !contentType.includes('application/json')) {
    logger.warn('Invalid content type for migration', { contentType });
    const errorResponse = formatErrorResponse(logger, 
      new Error('Invalid content type'), 
      'Content-Type must be application/json');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }

  // Check request body size (migrations can be large but need limits)
  const bodySize = Buffer.byteLength(event.body || '', 'utf8');
  const maxSize = 10 * 1024 * 1024; // 10MB limit for migration data
  if (bodySize > maxSize) {
    logger.warn('Migration payload too large', { 
      bodySize, 
      maxSize,
      sizeMB: (bodySize / 1024 / 1024).toFixed(2)
    });
    const errorResponse = formatErrorResponse(logger, 
      new Error('Payload too large'), 
      `Migration data exceeds ${maxSize / 1024 / 1024}MB limit`);
    return {
      statusCode: 413,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }

  try {
    // Rate limiting check (migration is heavy - only 3 per hour)
    const clientIp = getClientIp(event);
    const rateLimit = checkRateLimit(clientIp, 3600000, 3); // 3 migrations per hour
    
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for migration', { 
        ip: clientIp,
        resetTime: new Date(rateLimit.resetTime).toISOString()
      });
      const errorResponse = formatErrorResponse(logger, 
        new Error('Rate limit exceeded'), 
        'Too many migration requests. Migrations are limited to 3 per hour.');
      return {
        statusCode: 429,
        headers: {
          ...headers,
          'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
        },
        body: JSON.stringify(errorResponse)
      };
    }

    // Authenticate user (CRITICAL - was missing!)
    const auth = authenticateUser(event, logger);
    if (!auth.authenticated) {
      logger.warn('Unauthorized migration attempt', { 
        ip: clientIp,
        error: auth.error 
      });
      const errorResponse = formatErrorResponse(logger, 
        new Error('Authentication failed'), 
        auth.error || 'Authentication required for data migration');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify(errorResponse)
      };
    }

    const userId = auth.userId;
    logger.userAction('migration-start', userId, { 
      isLegacy: auth.isLegacy,
      remainingRequests: rateLimit.remaining,
      bodySizeMB: (bodySize / 1024 / 1024).toFixed(2)
    });

    if (!event.body) {
      logger.warn('Missing request body for migration', { userId });
      const errorResponse = formatErrorResponse(logger, 
        new Error('Request body required'), 
        'Request body required with localStorage data');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify(errorResponse)
      };
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      logger.warn('Invalid JSON in migration request', { userId, error: parseError.message });
      const errorResponse = formatErrorResponse(logger, parseError, 'Invalid JSON in request body');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify(errorResponse)
      };
    }

    const { localSettings, localWorkoutLogs, requestedUserId } = requestBody;

    // Security: Use authenticated user ID, don't allow arbitrary IDs from request
    // (requestedUserId is ignored for security - user can only migrate their own data)
    if (requestedUserId && requestedUserId !== userId) {
      logger.warn('Attempted to migrate data for different user', { 
        authenticatedUserId: userId,
        requestedUserId: requestedUserId
      });
    }
    
    logger.info('Starting migration for authenticated user', { 
      userId,
      hasSettings: !!localSettings,
      hasWorkoutLogs: !!localWorkoutLogs
    });

    // Get stores
    const settingsStore = getStore("user-settings");
    const logsStore = getStore("workout-logs");

    const settingsKey = `settings-${userId}`;
    const logsKey = `logs-${userId}`;

    // Check if cloud data already exists
    const [existingSettings, existingLogs] = await Promise.all([
      settingsStore.get(settingsKey, { type: 'json' }),
      logsStore.get(logsKey, { type: 'json' })
    ]);

    let migratedSettings = null;
    let migratedLogs = null;
    let settingsResult = null;
    let logsResult = null;

    // Migrate settings if provided
    if (localSettings) {
      if (!validateSettings(localSettings)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid settings structure in localStorage data' })
        };
      }

      // Merge with existing cloud data
      migratedSettings = mergeSettings(existingSettings, localSettings);

      // Save settings
      const settingsMetadata = {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        source: 'migration-from-localStorage',
        migrationTimestamp: new Date().toISOString()
      };

      settingsResult = await settingsStore.setJSON(settingsKey, migratedSettings, { metadata: settingsMetadata });
    }

    // Migrate workout logs if provided
    if (localWorkoutLogs) {
      if (!validateWorkoutLogs(localWorkoutLogs)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid workout logs structure in localStorage data' })
        };
      }

      // Merge with existing cloud data
      let mergedLogs = mergeWorkoutLogs(existingLogs, localWorkoutLogs);
      migratedLogs = updateStatistics(mergedLogs);

      // Save logs
      const logsMetadata = {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        source: 'migration-from-localStorage',
        migrationTimestamp: new Date().toISOString()
      };

      logsResult = await logsStore.setJSON(logsKey, migratedLogs, { metadata: logsMetadata });
    }

    // Prepare migration summary
    const migrationSummary = {
      userId: userId,
      migrationTimestamp: new Date().toISOString(),
      settings: {
        migrated: !!migratedSettings,
        hadExistingData: !!existingSettings,
        equipmentCount: migratedSettings?.equipment_settings ? Object.keys(migratedSettings.equipment_settings).length : 0
      },
      workoutLogs: {
        migrated: !!migratedLogs,
        hadExistingData: !!existingLogs,
        totalWorkouts: migratedLogs?.workouts?.length || 0,
        templatesCount: migratedLogs?.templates?.length || 0
      }
    };

    logger.userAction('migration-completed', userId, {
      settingsMigrated: !!migrationSummary.settings.migrated,
      workoutLogsMigrated: !!migrationSummary.workoutLogs.migrated,
      totalWorkouts: migrationSummary.workoutLogs.totalWorkouts,
      equipmentCount: migrationSummary.settings.equipmentCount
    });

    const response = formatSuccessResponse({
      message: 'Data migration completed successfully',
      userId: userId,
      migration: migrationSummary,
      results: {
        settings: settingsResult ? {
          modified: settingsResult.modified,
          etag: settingsResult.etag
        } : null,
        logs: logsResult ? {
          modified: logsResult.modified,
          etag: logsResult.etag
        } : null
      }
    }, logger);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    // Try to get userId for logging, but don't fail if auth fails
    let logUserId = 'unknown';
    try {
      const auth = authenticateUser(event, logger);
      if (auth.authenticated) logUserId = auth.userId;
    } catch (authError) {
      // Ignore auth errors in error handler
    }

    logger.error('Unexpected error in migrate-data function', error, { userId: logUserId });

    const errorResponse = formatErrorResponse(logger, error, 'An unexpected error occurred during migration');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }
};