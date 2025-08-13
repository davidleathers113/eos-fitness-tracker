/**
 * Event Bus - Pub/sub system for decoupled communication
 * No external dependencies - pure JavaScript
 */

// Event subscribers map
const subscribers = new Map();

// Event queue for deferred processing
const eventQueue = [];
let isProcessing = false;

/**
 * Event type constants to prevent typos
 */
export const EVT = {
    // Filter events
    FILTERS_CHANGED: 'filters/changed',
    FILTERS_CLEARED: 'filters/cleared',
    SEARCH_CHANGED: 'search/changed',
    
    // Equipment events
    EQUIPMENT_LOADED: 'equipment/loaded',
    EQUIPMENT_SELECTED: 'equipment/selected',
    EQUIPMENT_SETTINGS_SAVED: 'equipment/settings-saved',
    
    // Workout events
    WORKOUT_STARTED: 'workout/started',
    WORKOUT_SAVED: 'workout/saved',
    WORKOUT_CLEARED: 'workout/cleared',
    WORKOUT_ITEM_ADDED: 'workout/item-added',
    WORKOUT_ITEM_REMOVED: 'workout/item-removed',
    
    // Auth events
    AUTH_LOGIN: 'auth/login',
    AUTH_LOGOUT: 'auth/logout',
    AUTH_REGISTER: 'auth/register',
    AUTH_TOKEN_EXPIRED: 'auth/token-expired',
    
    // Settings events
    SETTINGS_UPDATED: 'settings/updated',
    SETTINGS_SAVED: 'settings/saved',
    SETTINGS_LOADED: 'settings/loaded',
    
    // Network events
    NETWORK_ONLINE: 'network/online',
    NETWORK_OFFLINE: 'network/offline',
    NETWORK_REQUEST_START: 'network/request-start',
    NETWORK_REQUEST_END: 'network/request-end',
    
    // UI events
    VIEW_CHANGED: 'view/changed',
    MODAL_OPENED: 'modal/opened',
    MODAL_CLOSED: 'modal/closed',
    TOAST_SHOWN: 'toast/shown',
    THEME_CHANGED: 'theme/changed',
    DENSITY_CHANGED: 'density/changed',
    
    // Data events
    DATA_MIGRATION_START: 'data/migration-start',
    DATA_MIGRATION_COMPLETE: 'data/migration-complete',
    DATA_EXPORT: 'data/export',
    DATA_IMPORT: 'data/import',
    DATA_RESET: 'data/reset',
    
    // App lifecycle
    APP_READY: 'app/ready',
    APP_ERROR: 'app/error',
    APP_LOADING: 'app/loading',
    APP_LOADED: 'app/loaded'
};

/**
 * Emit an event with optional payload
 * @param {string} event - Event name
 * @param {*} payload - Event payload
 * @param {Object} options - Emit options
 */
export function emit(event, payload = null, options = {}) {
    const { async = false, priority = false } = options;
    
    if (async) {
        // Queue for async processing
        if (priority) {
            eventQueue.unshift({ event, payload });
        } else {
            eventQueue.push({ event, payload });
        }
        processQueue();
    } else {
        // Emit synchronously
        emitNow(event, payload);
    }
}

/**
 * Subscribe to an event
 * @param {string} event - Event name or pattern (supports wildcards)
 * @param {Function} callback - Handler function
 * @param {Object} options - Subscribe options
 * @returns {Function} Unsubscribe function
 */
export function on(event, callback, options = {}) {
    const { once = false, priority = false } = options;
    
    if (!subscribers.has(event)) {
        subscribers.set(event, []);
    }
    
    const handler = once ? createOnceHandler(callback, event) : callback;
    
    if (priority) {
        subscribers.get(event).unshift(handler);
    } else {
        subscribers.get(event).push(handler);
    }
    
    // Return unsubscribe function
    return () => off(event, handler);
}

/**
 * Unsubscribe from an event
 * @param {string} event - Event name
 * @param {Function} callback - Handler to remove
 */
export function off(event, callback) {
    const handlers = subscribers.get(event);
    if (handlers) {
        const index = handlers.indexOf(callback);
        if (index > -1) {
            handlers.splice(index, 1);
        }
        if (handlers.length === 0) {
            subscribers.delete(event);
        }
    }
}

/**
 * Subscribe to an event once
 * @param {string} event - Event name
 * @param {Function} callback - Handler function
 * @returns {Function} Unsubscribe function
 */
export function once(event, callback) {
    return on(event, callback, { once: true });
}

/**
 * Clear all subscribers for an event
 * @param {string} event - Event name (optional, clears all if not provided)
 */
export function clear(event) {
    if (event) {
        subscribers.delete(event);
    } else {
        subscribers.clear();
    }
}

/**
 * Wait for an event to occur
 * @param {string} event - Event name
 * @param {number} timeout - Optional timeout in ms
 * @returns {Promise} Promise that resolves with event payload
 */
export function waitFor(event, timeout = 0) {
    return new Promise((resolve, reject) => {
        let timeoutId;
        
        const unsubscribe = once(event, (payload) => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve(payload);
        });
        
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Event '${event}' timeout after ${timeout}ms`));
            }, timeout);
        }
    });
}

/**
 * Emit multiple events in sequence
 * @param {Array} events - Array of {event, payload} objects
 */
export function emitSequence(events) {
    events.forEach(({ event, payload }) => {
        emit(event, payload);
    });
}

/**
 * Create a scoped emitter with a prefix
 * @param {string} prefix - Event prefix
 * @returns {Object} Scoped emitter functions
 */
export function createScope(prefix) {
    return {
        emit: (event, payload, options) => emit(`${prefix}/${event}`, payload, options),
        on: (event, callback, options) => on(`${prefix}/${event}`, callback, options),
        off: (event, callback) => off(`${prefix}/${event}`, callback),
        once: (event, callback) => once(`${prefix}/${event}`, callback)
    };
}

// Private helper functions

function emitNow(event, payload) {
    // Get direct subscribers
    const handlers = subscribers.get(event) || [];
    
    // Get wildcard subscribers
    const wildcardHandlers = getWildcardHandlers(event);
    
    // Execute all handlers
    [...handlers, ...wildcardHandlers].forEach(handler => {
        try {
            handler(payload, event);
        } catch (error) {
            console.error(`Event handler error for '${event}':`, error);
            emit(EVT.APP_ERROR, { event, error });
        }
    });
}

function getWildcardHandlers(event) {
    const handlers = [];
    
    // Check for namespace wildcards (e.g., 'auth/*' matches 'auth/login')
    subscribers.forEach((callbacks, pattern) => {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
            if (regex.test(event)) {
                handlers.push(...callbacks);
            }
        }
    });
    
    return handlers;
}

function createOnceHandler(callback, event) {
    const handler = (payload, eventName) => {
        off(event, handler);
        callback(payload, eventName);
    };
    return handler;
}

function processQueue() {
    if (isProcessing || eventQueue.length === 0) return;
    
    isProcessing = true;
    
    requestAnimationFrame(() => {
        const batch = eventQueue.splice(0, 10); // Process up to 10 events per frame
        
        batch.forEach(({ event, payload }) => {
            emitNow(event, payload);
        });
        
        isProcessing = false;
        
        if (eventQueue.length > 0) {
            processQueue();
        }
    });
}