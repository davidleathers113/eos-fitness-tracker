const { getStore, connectLambda } = require("@netlify/blobs");
const { createLogger, formatErrorResponse, formatSuccessResponse } = require("./_shared/logger");
const { authenticateUser, checkRateLimit, getClientIp } = require("./_shared/auth");

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

// This function is deprecated - replaced by secure authentication
// Kept for reference during migration period

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
  // Initialize Netlify Blobs in Lambda compatibility (Functions API v1)
  connectLambda(event);
  
  // Create structured logger for this request
  const logger = createLogger('workout-logs', event, context);
  logger.info('Function invoked', { method: event.httpMethod });
  
  const headers = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://eos-fitness-tracker.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

  // Validate Content-Type for write operations
  if (['POST', 'PUT', 'DELETE'].includes(event.httpMethod)) {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Invalid content type for write operation', { 
        method: event.httpMethod, 
        contentType 
      });
      const errorResponse = formatErrorResponse(logger, 
        new Error('Invalid content type'), 
        'Content-Type must be application/json for write operations');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify(errorResponse)
      };
    }

    // Check request body size for write operations
    const bodySize = Buffer.byteLength(event.body || '', 'utf8');
    const maxSize = 5 * 1024 * 1024; // 5MB limit for workout data
    if (bodySize > maxSize) {
      logger.warn('Workout payload too large', { 
        method: event.httpMethod,
        bodySize, 
        maxSize,
        sizeMB: (bodySize / 1024 / 1024).toFixed(2)
      });
      const errorResponse = formatErrorResponse(logger, 
        new Error('Payload too large'), 
        `Workout data exceeds ${maxSize / 1024 / 1024}MB limit`);
      return {
        statusCode: 413,
        headers,
        body: JSON.stringify(errorResponse)
      };
    }
  }

  try {
    // Rate limiting check
    const clientIp = getClientIp(event);
    const rateLimit = checkRateLimit(clientIp, 60000, 30); // 30 requests per minute
    
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded for workout operations', { 
        ip: clientIp,
        method: event.httpMethod,
        resetTime: new Date(rateLimit.resetTime).toISOString()
      });
      const errorResponse = formatErrorResponse(logger, 
        new Error('Rate limit exceeded'), 
        'Too many requests. Workout operations are limited to 30 per minute.');
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
      const errorResponse = formatErrorResponse(logger, 
        new Error('Authentication failed'), 
        auth.error || 'Authentication required for workout operations');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify(errorResponse)
      };
    }

    const userId = auth.userId;
    logger.userAction('workout-operation', userId, { 
      method: event.httpMethod,
      isLegacy: auth.isLegacy,
      remainingRequests: rateLimit.remaining 
    });

    const userStore = getStore("workout-logs");
    const logsKey = `logs-${userId}`;

    if (event.httpMethod === 'GET') {
      logger.dataOperation('read', 'workout-logs', logsKey, userId);
      
      // Retrieve workout logs with metadata (including ETag)
      const result = await userStore.getWithMetadata(logsKey, { type: 'json' });
      
      if (result === null) {
        logger.info('New user - returning default workout logs', { userId });
        // Return default logs for new users (no ETag since not stored yet)
        const defaultLogs = getDefaultWorkoutLogs();
        const response = formatSuccessResponse({
          logs: defaultLogs,
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

      // Update statistics before returning
      const updatedLogs = updateStatistics(result.data);
      
      logger.info('Existing workout logs retrieved', { 
        userId, 
        totalWorkouts: updatedLogs.workouts?.length || 0,
        totalTemplates: updatedLogs.templates?.length || 0,
        etag: result.etag
      });

      const response = formatSuccessResponse({
        logs: updatedLogs,
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
      logger.dataOperation('write', 'workout-logs', logsKey, userId);
      
      // Save new workout or update entire logs
      if (!event.body) {
        logger.warn('Missing request body for POST', { userId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Request body required'), 
          'Request body required for workout operations');
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
        logger.warn('Invalid JSON in request body', { userId, error: parseError.message });
        const errorResponse = formatErrorResponse(logger, parseError, 'Invalid JSON in request body');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }
      
      if (requestBody.workout) {
        // Adding a single new workout
        const { workout, ifMatch } = requestBody;
        
        logger.info('Adding new workout', { 
          userId, 
          workoutId: workout?.id,
          exerciseCount: workout?.exercises?.length || 0
        });
        
        if (!validateWorkout(workout)) {
          logger.warn('Invalid workout structure', { userId, workoutId: workout?.id });
          const errorResponse = formatErrorResponse(logger, 
            new Error('Invalid workout structure'), 
            'Workout data structure is invalid');
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify(errorResponse)
          };
        }

        // Get existing logs with ETag for concurrency control
        const logsResult = await userStore.getWithMetadata(logsKey, { type: 'json' });
        let logs = logsResult?.data || getDefaultWorkoutLogs();
        const currentETag = logsResult?.etag;

        // If client provided ETag, verify it matches current data
        if (ifMatch && currentETag !== ifMatch) {
          logger.warn('ETag mismatch for workout addition', { 
            userId, 
            workoutId: workout?.id,
            providedETag: ifMatch,
            currentETag
          });
          
          const conflictResponse = formatErrorResponse(logger, 
            new Error('ETag mismatch'), 
            'Conflict: Workout logs were modified by another client. Please refresh and try again.');
          
          return {
            statusCode: 409, // Conflict
            headers,
            body: JSON.stringify(conflictResponse)
          };
        }

        // Add new workout
        logs.workouts.push(workout);
        logs = updateStatistics(logs);

        // Save back to Blobs with ETag-based optimistic locking
        const metadata = {
          lastUpdated: new Date().toISOString(),
          version: '2.0',
          source: 'eos-fitness-tracker',
          correlationId: logger.correlationId
        };

        const saveOptions = { metadata };
        if (currentETag) {
          saveOptions.onlyIfMatch = currentETag;
        }

        const result = await userStore.setJSON(logsKey, logs, saveOptions);
        
        // Check if write was successful with ETag
        if (currentETag && !result.modified) {
          logger.warn('Workout addition failed due to concurrent modification', { 
            userId, 
            workoutId: workout?.id,
            currentETag,
            modified: result.modified
          });
          
          const conflictResponse = formatErrorResponse(logger, 
            new Error('Concurrent modification'), 
            'Conflict: Workout logs were modified during save. Please refresh and try again.');
          
          return {
            statusCode: 409, // Conflict
            headers,
            body: JSON.stringify(conflictResponse)
          };
        }
        
        logger.info('Workout added successfully', { 
          userId, 
          workoutId: workout.id,
          totalWorkouts: logs.workouts.length,
          modified: result.modified,
          etag: result.etag
        });

        const response = formatSuccessResponse({
          userId: userId,
          workoutAdded: workout.id,
          totalWorkouts: logs.workouts.length,
          modified: result.modified,
          etag: result.etag
        }, logger);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(response)
        };

      } else if (requestBody.logs) {
        // Replacing entire workout logs (for migration)
        const { logs } = requestBody;
        
        logger.info('Replacing entire workout logs', { 
          userId, 
          totalWorkouts: logs?.workouts?.length || 0
        });
        
        if (!validateWorkoutLogs(logs)) {
          logger.warn('Invalid logs structure for replacement', { userId });
          const errorResponse = formatErrorResponse(logger, 
            new Error('Invalid logs structure'), 
            'Workout logs data structure is invalid');
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify(errorResponse)
          };
        }

        const updatedLogs = updateStatistics(logs);

        // Save to Netlify Blobs
        const metadata = {
          lastUpdated: new Date().toISOString(),
          version: '2.0',
          source: 'eos-fitness-tracker',
          correlationId: logger.correlationId
        };

        const result = await userStore.setJSON(logsKey, updatedLogs, { metadata });
        
        logger.info('Workout logs replaced successfully', { 
          userId, 
          totalWorkouts: updatedLogs.workouts.length,
          modified: result.modified,
          etag: result.etag
        });

        const response = formatSuccessResponse({
          userId: userId,
          totalWorkouts: updatedLogs.workouts.length,
          modified: result.modified,
          etag: result.etag
        }, logger);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(response)
        };
      } else {
        logger.warn('Invalid POST request - missing workout or logs', { userId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Invalid request structure'), 
          'Either workout or logs must be provided');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }

    } else if (event.httpMethod === 'PUT') {
      logger.dataOperation('update', 'workout-logs', logsKey, userId);
      
      // Update existing workout
      if (!event.body) {
        logger.warn('Missing request body for PUT', { userId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Request body required'), 
          'Request body required for workout update');
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
        logger.warn('Invalid JSON in PUT request body', { userId, error: parseError.message });
        const errorResponse = formatErrorResponse(logger, parseError, 'Invalid JSON in request body');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }

      const { workoutId, workout } = requestBody;
      
      logger.info('Updating workout', { userId, workoutId });
      
      if (!workoutId || !validateWorkout(workout)) {
        logger.warn('Invalid workout update request', { userId, workoutId, hasValidWorkout: !!validateWorkout(workout) });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Invalid workout data'), 
          'Workout ID and valid workout structure required');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }

      // Get existing logs with ETag for concurrency control
      const logsResult = await userStore.getWithMetadata(logsKey, { type: 'json' });
      if (!logsResult || !logsResult.data) {
        logger.warn('Workout logs not found for update', { userId, workoutId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Workout logs not found'), 
          'No workout logs found for this user');
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }
      
      let logs = logsResult.data;
      const currentETag = logsResult.etag;

      // Find and update workout
      const workoutIndex = logs.workouts.findIndex(w => w.id === workoutId);
      if (workoutIndex === -1) {
        logger.warn('Workout not found for update', { userId, workoutId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Workout not found'), 
          'Workout with specified ID not found');
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }

      logs.workouts[workoutIndex] = workout;
      logs = updateStatistics(logs);

      // Save back to Blobs with ETag-based optimistic locking
      const metadata = {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        source: 'eos-fitness-tracker',
        correlationId: logger.correlationId
      };

      const saveOptions = { metadata };
      if (currentETag) {
        saveOptions.onlyIfMatch = currentETag;
      }

      const result = await userStore.setJSON(logsKey, logs, saveOptions);
      
      // Check if write was successful with ETag
      if (currentETag && !result.modified) {
        logger.warn('Workout update failed due to concurrent modification', { 
          userId, 
          workoutId,
          currentETag,
          modified: result.modified
        });
        
        const conflictResponse = formatErrorResponse(logger, 
          new Error('Concurrent modification'), 
          'Conflict: Workout logs were modified during update. Please refresh and try again.');
        
        return {
          statusCode: 409, // Conflict
          headers,
          body: JSON.stringify(conflictResponse)
        };
      }
      
      logger.info('Workout updated successfully', { 
        userId, 
        workoutId,
        modified: result.modified,
        etag: result.etag
      });

      const response = formatSuccessResponse({
        userId: userId,
        workoutUpdated: workoutId,
        modified: result.modified,
        etag: result.etag
      }, logger);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response)
      };

    } else if (event.httpMethod === 'DELETE') {
      logger.dataOperation('delete', 'workout-logs', logsKey, userId);
      
      // Delete workout
      let requestBody;
      try {
        requestBody = JSON.parse(event.body || '{}');
      } catch (parseError) {
        logger.warn('Invalid JSON in DELETE request body', { userId, error: parseError.message });
        const errorResponse = formatErrorResponse(logger, parseError, 'Invalid JSON in request body');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }
      
      const { workoutId } = requestBody;
      
      logger.info('Deleting workout', { userId, workoutId });
      
      if (!workoutId) {
        logger.warn('Missing workout ID for deletion', { userId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Workout ID required'), 
          'Workout ID is required for deletion');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }

      // Get existing logs with ETag for concurrency control
      const logsResult = await userStore.getWithMetadata(logsKey, { type: 'json' });
      if (!logsResult || !logsResult.data) {
        logger.warn('Workout logs not found for deletion', { userId, workoutId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Workout logs not found'), 
          'No workout logs found for this user');
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }
      
      let logs = logsResult.data;
      const currentETag = logsResult.etag;

      // Filter out the workout to delete
      const originalLength = logs.workouts.length;
      logs.workouts = logs.workouts.filter(w => w.id !== workoutId);
      
      if (logs.workouts.length === originalLength) {
        logger.warn('Workout not found for deletion', { userId, workoutId });
        const errorResponse = formatErrorResponse(logger, 
          new Error('Workout not found'), 
          'Workout with specified ID not found');
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify(errorResponse)
        };
      }

      logs = updateStatistics(logs);

      // Save back to Blobs with ETag-based optimistic locking
      const metadata = {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        source: 'eos-fitness-tracker',
        correlationId: logger.correlationId
      };

      const saveOptions = { metadata };
      if (currentETag) {
        saveOptions.onlyIfMatch = currentETag;
      }

      const result = await userStore.setJSON(logsKey, logs, saveOptions);
      
      // Check if write was successful with ETag
      if (currentETag && !result.modified) {
        logger.warn('Workout deletion failed due to concurrent modification', { 
          userId, 
          workoutId,
          currentETag,
          modified: result.modified
        });
        
        const conflictResponse = formatErrorResponse(logger, 
          new Error('Concurrent modification'), 
          'Conflict: Workout logs were modified during deletion. Please refresh and try again.');
        
        return {
          statusCode: 409, // Conflict
          headers,
          body: JSON.stringify(conflictResponse)
        };
      }
      
      logger.info('Workout deleted successfully', { 
        userId, 
        workoutId,
        totalWorkouts: logs.workouts.length,
        modified: result.modified,
        etag: result.etag
      });

      const response = formatSuccessResponse({
        userId: userId,
        workoutDeleted: workoutId,
        totalWorkouts: logs.workouts.length,
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
      const errorResponse = formatErrorResponse(logger, 
        new Error(`Method ${event.httpMethod} not allowed`), 
        'Method not allowed for workout operations');
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify(errorResponse)
      };
    }

  } catch (error) {
    // Try to get userId for logging, but don't fail if auth fails
    let logUserId = 'unknown';
    try {
      const auth = authenticateUser(event, logger);
      if (auth.authenticated) logUserId = auth.userId;
    } catch (authError) {
      // Ignore auth errors in error handler
    }

    logger.error('Unexpected error in workout-logs function', error, { userId: logUserId });

    const errorResponse = formatErrorResponse(logger, error, 'An unexpected error occurred during workout operation');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }
};