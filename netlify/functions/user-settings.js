const { getStore } = require("@netlify/blobs");

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

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const userStore = getStore("user-settings");
    const userId = getUserId(event);
    const settingsKey = `settings-${userId}`;

    if (event.httpMethod === 'GET') {
      // Retrieve user settings
      const settings = await userStore.get(settingsKey, { type: 'json' });
      
      if (settings === null) {
        // Return default settings for new users
        const defaultSettings = getDefaultSettings();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            settings: defaultSettings,
            userId: userId,
            isNewUser: true
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          settings: settings,
          userId: userId,
          isNewUser: false
        })
      };

    } else if (event.httpMethod === 'POST') {
      // Save or update user settings
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Request body required' })
        };
      }

      const { settings } = JSON.parse(event.body);
      
      // Validate settings structure
      if (!validateSettings(settings)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid settings structure' })
        };
      }

      // Add metadata
      const metadata = {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        source: 'eos-fitness-tracker'
      };

      // Save to Netlify Blobs
      const result = await userStore.setJSON(settingsKey, settings, { metadata });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          userId: userId,
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
    console.error('Error in user-settings function:', error);
    
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