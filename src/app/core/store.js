/**
 * Core Store - Minimal state management for the application
 * No external dependencies - pure JavaScript
 */

// Application state
const state = {
    equipment: {
        metadata: {},
        items: []
    },
    settings: {},
    workoutLogs: {},
    currentWorkout: [],
    currentView: 'equipment',
    filter: {
        zone: 'all',
        muscle: 'all',
        search: ''
    },
    user: {
        id: null,
        token: null,
        isAuthenticated: false,
        isOnline: navigator.onLine
    },
    selectedEquipment: null
};

// State change listeners
const listeners = new Map();

/**
 * Get current state (read-only)
 * @returns {Object} Current application state
 */
export function getState() {
    // Return a frozen copy to prevent direct mutations
    return Object.freeze(JSON.parse(JSON.stringify(state)));
}

/**
 * Update state with partial updates
 * @param {Object} patch - Partial state to merge
 * @param {string} topic - Optional topic for targeted listeners
 */
export function setState(patch, topic = '*') {
    // Deep merge for nested objects
    Object.keys(patch).forEach(key => {
        if (typeof patch[key] === 'object' && patch[key] !== null && !Array.isArray(patch[key])) {
            state[key] = { ...state[key], ...patch[key] };
        } else {
            state[key] = patch[key];
        }
    });
    
    // Notify listeners
    notifyListeners(topic);
}

/**
 * Subscribe to state changes
 * @param {string} topic - Topic to subscribe to (* for all)
 * @param {Function} callback - Function to call on state change
 * @returns {Function} Unsubscribe function
 */
export function subscribe(topic, callback) {
    if (!listeners.has(topic)) {
        listeners.set(topic, new Set());
    }
    
    listeners.get(topic).add(callback);
    
    // Return unsubscribe function
    return () => {
        const topicListeners = listeners.get(topic);
        if (topicListeners) {
            topicListeners.delete(callback);
            if (topicListeners.size === 0) {
                listeners.delete(topic);
            }
        }
    };
}

/**
 * Notify listeners of state changes
 * @param {string} topic - Topic that changed
 */
function notifyListeners(topic) {
    // Notify specific topic listeners
    if (listeners.has(topic)) {
        listeners.get(topic).forEach(callback => {
            try {
                callback(state);
            } catch (error) {
                console.error('Store listener error:', error);
            }
        });
    }
    
    // Always notify wildcard listeners
    if (topic !== '*' && listeners.has('*')) {
        listeners.get('*').forEach(callback => {
            try {
                callback(state);
            } catch (error) {
                console.error('Store wildcard listener error:', error);
            }
        });
    }
}

/**
 * Reset store to initial state
 * Useful for testing or logout scenarios
 */
export function resetStore() {
    Object.assign(state, {
        equipment: { metadata: {}, items: [] },
        settings: {},
        workoutLogs: {},
        currentWorkout: [],
        currentView: 'equipment',
        filter: { zone: 'all', muscle: 'all', search: '' },
        user: { id: null, token: null, isAuthenticated: false, isOnline: navigator.onLine },
        selectedEquipment: null
    });
    
    notifyListeners('*');
}

/**
 * Get a specific slice of state
 * @param {string} key - State key to retrieve
 * @returns {*} State value
 */
export function getStateSlice(key) {
    return state[key];
}

/**
 * Update a specific slice of state
 * @param {string} key - State key to update
 * @param {*} value - New value
 */
export function setStateSlice(key, value) {
    state[key] = value;
    notifyListeners(key);
}