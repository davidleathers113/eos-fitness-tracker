/**
 * Settings Data Validation and Utilities
 */

import { LIMITS, DEFAULTS } from '../../core/constants.js';

/**
 * Validate settings data structure
 * @param {Object} data - Settings data to validate
 * @returns {Object} Validation result
 */
export function validateSettings(data) {
    const errors = [];
    const cleaned = {};
    
    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Settings must be an object'],
            cleaned: getDefaultSettings()
        };
    }
    
    // Validate equipment settings
    if (data.equipment) {
        if (typeof data.equipment !== 'object') {
            errors.push('Equipment settings must be an object');
        } else {
            cleaned.equipment = {};
            
            Object.entries(data.equipment).forEach(([id, settings]) => {
                const validatedEquipment = validateEquipmentSettings(settings);
                if (validatedEquipment.isValid) {
                    cleaned.equipment[id] = validatedEquipment.cleaned;
                } else {
                    errors.push(`Invalid settings for equipment ${id}: ${validatedEquipment.errors.join(', ')}`);
                }
            });
        }
    } else {
        cleaned.equipment = {};
    }
    
    // Validate user preferences
    if (data.user) {
        const validatedUser = validateUserPreferences(data.user);
        if (validatedUser.isValid) {
            cleaned.user = validatedUser.cleaned;
        } else {
            errors.push(...validatedUser.errors);
        }
    } else {
        cleaned.user = getDefaultUserPreferences();
    }
    
    // Validate workout preferences
    if (data.workout) {
        const validatedWorkout = validateWorkoutPreferences(data.workout);
        if (validatedWorkout.isValid) {
            cleaned.workout = validatedWorkout.cleaned;
        } else {
            errors.push(...validatedWorkout.errors);
        }
    } else {
        cleaned.workout = getDefaultWorkoutPreferences();
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Validate individual equipment settings
 * @param {Object} settings - Equipment settings
 * @returns {Object} Validation result
 */
export function validateEquipmentSettings(settings) {
    const errors = [];
    const cleaned = {};
    
    if (!settings || typeof settings !== 'object') {
        return {
            isValid: false,
            errors: ['Equipment settings must be an object'],
            cleaned: {}
        };
    }
    
    // Validate weight
    if ('weight' in settings) {
        const weight = parseFloat(settings.weight);
        if (isNaN(weight) || weight < 0 || weight > 1000) {
            errors.push('Weight must be between 0 and 1000');
        } else {
            cleaned.weight = weight;
        }
    }
    
    // Validate reps
    if ('reps' in settings) {
        const reps = parseInt(settings.reps);
        if (isNaN(reps) || reps < 1 || reps > 100) {
            errors.push('Reps must be between 1 and 100');
        } else {
            cleaned.reps = reps;
        }
    }
    
    // Validate sets
    if ('sets' in settings) {
        const sets = parseInt(settings.sets);
        if (isNaN(sets) || sets < 1 || sets > 20) {
            errors.push('Sets must be between 1 and 20');
        } else {
            cleaned.sets = sets;
        }
    }
    
    // Validate seat position
    if ('seatPosition' in settings) {
        const position = parseInt(settings.seatPosition);
        if (isNaN(position) || position < 1 || position > 20) {
            errors.push('Seat position must be between 1 and 20');
        } else {
            cleaned.seatPosition = position;
        }
    }
    
    // Validate notes
    if ('notes' in settings) {
        const notes = String(settings.notes).trim();
        if (notes.length > LIMITS.MAX_NOTES_LENGTH) {
            errors.push(`Notes must be less than ${LIMITS.MAX_NOTES_LENGTH} characters`);
        } else {
            cleaned.notes = notes;
        }
    }
    
    // Validate last used date
    if ('lastUsed' in settings) {
        const date = new Date(settings.lastUsed);
        if (isNaN(date.getTime())) {
            errors.push('Invalid last used date');
        } else {
            cleaned.lastUsed = date.toISOString();
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Validate user preferences
 * @param {Object} user - User preferences
 * @returns {Object} Validation result
 */
export function validateUserPreferences(user) {
    const errors = [];
    const cleaned = {};
    
    if (!user || typeof user !== 'object') {
        return {
            isValid: false,
            errors: ['User preferences must be an object'],
            cleaned: getDefaultUserPreferences()
        };
    }
    
    // Validate name
    if ('name' in user) {
        const name = String(user.name).trim();
        if (name.length === 0 || name.length > 100) {
            errors.push('Name must be between 1 and 100 characters');
        } else {
            cleaned.name = name;
        }
    }
    
    // Validate email (optional)
    if ('email' in user && user.email) {
        const email = String(user.email).trim().toLowerCase();
        if (!email.includes('@') || email.length > 255) {
            errors.push('Invalid email address');
        } else {
            cleaned.email = email;
        }
    }
    
    // Validate gym location
    if ('gymLocation' in user) {
        cleaned.gymLocation = String(user.gymLocation).trim();
    }
    
    // Validate fitness goals
    if ('fitnessGoals' in user && Array.isArray(user.fitnessGoals)) {
        cleaned.fitnessGoals = user.fitnessGoals
            .filter(goal => typeof goal === 'string')
            .map(goal => goal.trim())
            .slice(0, 10); // Max 10 goals
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Validate workout preferences
 * @param {Object} workout - Workout preferences
 * @returns {Object} Validation result
 */
export function validateWorkoutPreferences(workout) {
    const errors = [];
    const cleaned = {};
    
    if (!workout || typeof workout !== 'object') {
        return {
            isValid: false,
            errors: ['Workout preferences must be an object'],
            cleaned: getDefaultWorkoutPreferences()
        };
    }
    
    // Validate default rest time
    if ('defaultRestTime' in workout) {
        const restTime = parseInt(workout.defaultRestTime);
        if (isNaN(restTime) || restTime < 0 || restTime > 600) {
            errors.push('Rest time must be between 0 and 600 seconds');
        } else {
            cleaned.defaultRestTime = restTime;
        }
    }
    
    // Validate default work time
    if ('defaultWorkTime' in workout) {
        const workTime = parseInt(workout.defaultWorkTime);
        if (isNaN(workTime) || workTime < 10 || workTime > 300) {
            errors.push('Work time must be between 10 and 300 seconds');
        } else {
            cleaned.defaultWorkTime = workTime;
        }
    }
    
    // Validate auto-start
    if ('autoStart' in workout) {
        cleaned.autoStart = Boolean(workout.autoStart);
    }
    
    // Validate sound alerts
    if ('soundAlerts' in workout) {
        cleaned.soundAlerts = Boolean(workout.soundAlerts);
    }
    
    // Validate vibration alerts
    if ('vibrationAlerts' in workout) {
        cleaned.vibrationAlerts = Boolean(workout.vibrationAlerts);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Get default settings
 * @returns {Object} Default settings
 */
export function getDefaultSettings() {
    return {
        equipment: {},
        user: getDefaultUserPreferences(),
        workout: getDefaultWorkoutPreferences(),
        version: '2.0.0',
        lastModified: new Date().toISOString()
    };
}

/**
 * Get default user preferences
 * @returns {Object} Default user preferences
 */
export function getDefaultUserPreferences() {
    return {
        name: '',
        email: '',
        gymLocation: 'EOS Fitness Lutz, FL',
        fitnessGoals: [],
        joinDate: new Date().toISOString()
    };
}

/**
 * Get default workout preferences
 * @returns {Object} Default workout preferences
 */
export function getDefaultWorkoutPreferences() {
    return {
        defaultRestTime: DEFAULTS.REST_TIME,
        defaultWorkTime: DEFAULTS.WORK_TIME,
        defaultSets: DEFAULTS.TARGET_SETS,
        defaultReps: DEFAULTS.TARGET_REPS,
        autoStart: false,
        soundAlerts: true,
        vibrationAlerts: false,
        showTimer: true,
        trackCalories: false
    };
}

/**
 * Merge settings with defaults
 * @param {Object} settings - User settings
 * @returns {Object} Merged settings
 */
export function mergeWithDefaults(settings) {
    const defaults = getDefaultSettings();
    
    return {
        ...defaults,
        ...settings,
        user: {
            ...defaults.user,
            ...(settings.user || {})
        },
        workout: {
            ...defaults.workout,
            ...(settings.workout || {})
        }
    };
}

/**
 * Remove dangerous keys from settings
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
export function removeDangerousKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const cleaned = {};
    
    Object.keys(obj).forEach(key => {
        if (!dangerous.includes(key) && !key.startsWith('$')) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                cleaned[key] = removeDangerousKeys(obj[key]);
            } else {
                cleaned[key] = obj[key];
            }
        }
    });
    
    return cleaned;
}