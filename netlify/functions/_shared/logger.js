/**
 * Structured logging utility for Netlify Functions
 * Provides consistent logging format with correlation IDs for debugging
 */

const crypto = require('crypto');

/**
 * Generate a unique correlation ID for request tracing
 */
function generateCorrelationId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Create a structured logger for a specific function
 * @param {string} functionName - Name of the function
 * @param {Object} event - Netlify event object
 * @param {Object} context - Netlify context object
 * @returns {Object} Logger instance
 */
function createLogger(functionName, event, context) {
  const correlationId = generateCorrelationId();
  const baseMetadata = {
    functionName,
    correlationId,
    requestId: context.awsRequestId,
    timestamp: new Date().toISOString(),
    method: event.httpMethod,
    path: event.path,
    userAgent: event.headers['user-agent'],
    ip: event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip']
  };

  return {
    correlationId,
    
    info: (message, metadata = {}) => {
      console.log(JSON.stringify({
        level: 'INFO',
        message,
        ...baseMetadata,
        ...metadata
      }));
    },

    error: (message, error = null, metadata = {}) => {
      const errorData = error ? {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      } : {};

      console.error(JSON.stringify({
        level: 'ERROR',
        message,
        ...baseMetadata,
        ...errorData,
        ...metadata
      }));
    },

    warn: (message, metadata = {}) => {
      console.warn(JSON.stringify({
        level: 'WARN',
        message,
        ...baseMetadata,
        ...metadata
      }));
    },

    debug: (message, metadata = {}) => {
      // Only log debug in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(JSON.stringify({
          level: 'DEBUG',
          message,
          ...baseMetadata,
          ...metadata
        }));
      }
    },

    // Log user actions for analytics and debugging
    userAction: (action, userId, metadata = {}) => {
      console.log(JSON.stringify({
        level: 'USER_ACTION',
        action,
        userId,
        ...baseMetadata,
        ...metadata
      }));
    },

    // Log data operations for audit trail
    dataOperation: (operation, store, key, userId, metadata = {}) => {
      console.log(JSON.stringify({
        level: 'DATA_OPERATION',
        operation,
        store,
        key,
        userId,
        ...baseMetadata,
        ...metadata
      }));
    }
  };
}

/**
 * Standard error response formatter
 * @param {Object} logger - Logger instance
 * @param {Error} error - Error object
 * @param {string} userMessage - User-friendly message
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(logger, error, userMessage = 'An error occurred') {
  logger.error('Function error', error);
  
  return {
    error: true,
    message: userMessage,
    correlationId: logger.correlationId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Standard success response formatter
 * @param {Object} data - Response data
 * @param {Object} logger - Logger instance
 * @returns {Object} Formatted success response
 */
function formatSuccessResponse(data, logger) {
  return {
    ...data,
    correlationId: logger.correlationId,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  createLogger,
  formatErrorResponse,
  formatSuccessResponse,
  generateCorrelationId
};