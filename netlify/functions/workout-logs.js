const { getStore } = require("@netlify/blobs");

// Validation function (matches frontend validation)
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

// Validate single workout structure
function validateWorkout(workout) {
  if (!workout || typeof workout !== 'object') return false;
  if (!workout.id || !workout.date || !Array.isArray(workout.exercises)) return false;
  
  // Validate exercises structure
  for (const exercise of workout.exercises) {
    if (!exercise.equipment_id || !Array.isArray(exercise.sets)) {
      return false;
    }
  }
  
  return true;
}

// Default workout logs structure
function getDefaultWorkoutLogs() {
  return {
    workouts: [],
    templates: [
      {
        name: "Push Day",
        equipment_sequence: ["HS-IL-BP", "EGYM-CP", "NAUT-SP", "HS-IL-SH"],
        estimated_duration: 60,
        notes: "Chest, shoulders, triceps focus"
      },
      {
        name: "Pull Day", 
        equipment_sequence: ["HS-PL-LAT", "NAUT-RW", "HS-IL-ROW", "EGYM-LC"],
        estimated_duration: 55,
        notes: "Back, biceps focus"
      },
      {
        name: "Leg Day",
        equipment_sequence: ["HS-PL-SQT", "NAUT-LP", "HS-LG-CURL", "HS-LG-EXT"],
        estimated_duration: 65,
        notes: "Lower body focus"
      }
    ],
    statistics: {
      total_workouts: 0,
      total_time: 0,
      favorite_equipment: {},
      monthly_summary: {}
    }
  };
}

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
    userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  
  return userId;
}

// Update workout statistics
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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

  try {
    const userStore = getStore("workout-logs");
    const userId = getUserId(event);
    const logsKey = `logs-${userId}`;

    if (event.httpMethod === 'GET') {
      // Retrieve workout logs
      const logs = await userStore.get(logsKey, { type: 'json' });
      
      if (logs === null) {
        // Return default logs for new users
        const defaultLogs = getDefaultWorkoutLogs();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            logs: defaultLogs,
            userId: userId,
            isNewUser: true
          })
        };
      }

      // Update statistics before returning
      const updatedLogs = updateStatistics(logs);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          logs: updatedLogs,
          userId: userId,
          isNewUser: false
        })
      };

    } else if (event.httpMethod === 'POST') {
      // Save new workout or update entire logs
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Request body required' })
        };
      }

      const requestBody = JSON.parse(event.body);
      
      if (requestBody.workout) {
        // Adding a single new workout
        const { workout } = requestBody;
        
        if (!validateWorkout(workout)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid workout structure' })
          };
        }

        // Get existing logs or default
        let logs = await userStore.get(logsKey, { type: 'json' });
        if (!logs) {
          logs = getDefaultWorkoutLogs();
        }

        // Add new workout
        logs.workouts.push(workout);
        logs = updateStatistics(logs);

        // Save back to Blobs
        const metadata = {
          lastUpdated: new Date().toISOString(),
          version: '2.0',
          source: 'eos-fitness-tracker'
        };

        const result = await userStore.setJSON(logsKey, logs, { metadata });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            userId: userId,
            workoutAdded: workout.id,
            totalWorkouts: logs.workouts.length,
            modified: result.modified,
            etag: result.etag
          })
        };

      } else if (requestBody.logs) {
        // Replacing entire workout logs (for migration)
        const { logs } = requestBody;
        
        if (!validateWorkoutLogs(logs)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid logs structure' })
          };
        }

        const updatedLogs = updateStatistics(logs);

        // Save to Netlify Blobs
        const metadata = {
          lastUpdated: new Date().toISOString(),
          version: '2.0',
          source: 'eos-fitness-tracker'
        };

        const result = await userStore.setJSON(logsKey, updatedLogs, { metadata });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            userId: userId,
            totalWorkouts: updatedLogs.workouts.length,
            modified: result.modified,
            etag: result.etag
          })
        };
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Either workout or logs must be provided' })
        };
      }

    } else if (event.httpMethod === 'PUT') {
      // Update existing workout
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Request body required' })
        };
      }

      const { workoutId, workout } = JSON.parse(event.body);
      
      if (!workoutId || !validateWorkout(workout)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Workout ID and valid workout structure required' })
        };
      }

      // Get existing logs
      let logs = await userStore.get(logsKey, { type: 'json' });
      if (!logs) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Workout logs not found' })
        };
      }

      // Find and update workout
      const workoutIndex = logs.workouts.findIndex(w => w.id === workoutId);
      if (workoutIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Workout not found' })
        };
      }

      logs.workouts[workoutIndex] = workout;
      logs = updateStatistics(logs);

      // Save back to Blobs
      const metadata = {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        source: 'eos-fitness-tracker'
      };

      const result = await userStore.setJSON(logsKey, logs, { metadata });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          userId: userId,
          workoutUpdated: workoutId,
          modified: result.modified,
          etag: result.etag
        })
      };

    } else if (event.httpMethod === 'DELETE') {
      // Delete workout
      const { workoutId } = JSON.parse(event.body || '{}');
      
      if (!workoutId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Workout ID required' })
        };
      }

      // Get existing logs
      let logs = await userStore.get(logsKey, { type: 'json' });
      if (!logs) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Workout logs not found' })
        };
      }

      // Filter out the workout to delete
      const originalLength = logs.workouts.length;
      logs.workouts = logs.workouts.filter(w => w.id !== workoutId);
      
      if (logs.workouts.length === originalLength) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Workout not found' })
        };
      }

      logs = updateStatistics(logs);

      // Save back to Blobs
      const metadata = {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        source: 'eos-fitness-tracker'
      };

      const result = await userStore.setJSON(logsKey, logs, { metadata });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          userId: userId,
          workoutDeleted: workoutId,
          totalWorkouts: logs.workouts.length,
          modified: result.modified,
          etag: result.etag
        })
      };

    } else {
      // Method not allowed
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

  } catch (error) {
    console.error('Error in workout-logs function:', error);
    
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