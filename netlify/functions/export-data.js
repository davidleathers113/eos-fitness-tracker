const { getStore, connectLambda } = require("@netlify/blobs");
const fs = require('fs/promises');
const path = require('path');

// Generate or retrieve user ID from headers
function getUserId(event) {
  let userId = event.headers['x-user-id'];
  
  if (!userId && event.body) {
    try {
      const body = JSON.parse(event.body);
      userId = body.userId;
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  if (!userId) {
    return null; // Export requires user ID
  }
  
  return userId;
}

// Load equipment database from static file
async function loadEquipmentDatabase() {
  try {
    // In Netlify Functions, the build directory is accessible
    const equipmentPath = path.resolve('./database/equipment-database.json');
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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const userId = getUserId(event);
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User ID required in x-user-id header or request body' })
      };
    }

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
          'Content-Length': JSON.stringify(exportData).length.toString()
        },
        body: JSON.stringify(exportData, null, 2)
      };
    } else {
      // Return as JSON response
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          export_data: exportData,
          summary: {
            user_id: userId,
            total_workouts: exportData.metadata.total_workouts,
            total_equipment: exportData.metadata.total_equipment,
            export_timestamp: exportData.exported_at
          }
        })
      };
    }

  } catch (error) {
    console.error('Error in export-data function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};