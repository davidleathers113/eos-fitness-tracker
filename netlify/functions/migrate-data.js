const { getStore, connectLambda } = require("@netlify/blobs");

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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST to migrate data.' })
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body required with localStorage data' })
      };
    }

    const requestBody = JSON.parse(event.body);
    const { localSettings, localWorkoutLogs, requestedUserId } = requestBody;

    // Generate user ID (use requested if valid, otherwise generate new)
    const userId = requestedUserId || generateUserId();

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
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
      })
    };

  } catch (error) {
    console.error('Error in migrate-data function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error during migration',
        message: error.message 
      })
    };
  }
};