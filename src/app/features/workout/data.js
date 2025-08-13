/**
 * Workout Data Validation and Utilities
 */

import { LIMITS } from '../../core/constants.js';

/**
 * Validate workout logs data structure
 * @param {Object} data - Workout logs to validate
 * @returns {Object} Validation result
 */
export function validateWorkoutLogs(data) {
    const errors = [];
    const cleaned = {};
    
    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Workout logs must be an object'],
            cleaned: getDefaultWorkoutLogs()
        };
    }
    
    // Validate each workout entry
    Object.entries(data).forEach(([date, workout]) => {
        // Validate date key
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            errors.push(`Invalid date key: ${date}`);
            return;
        }
        
        // Validate workout data
        const validatedWorkout = validateWorkout(workout);
        if (validatedWorkout.isValid) {
            cleaned[date] = validatedWorkout.cleaned;
        } else {
            errors.push(`Invalid workout for ${date}: ${validatedWorkout.errors.join(', ')}`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Validate individual workout
 * @param {Object} workout - Workout to validate
 * @returns {Object} Validation result
 */
export function validateWorkout(workout) {
    const errors = [];
    const cleaned = {};
    
    if (!workout || typeof workout !== 'object') {
        return {
            isValid: false,
            errors: ['Workout must be an object'],
            cleaned: null
        };
    }
    
    // Validate workout ID
    if (workout.id) {
        cleaned.id = String(workout.id);
    } else {
        cleaned.id = generateWorkoutId();
    }
    
    // Validate name
    if (workout.name) {
        const name = String(workout.name).trim();
        if (name.length > LIMITS.MAX_WORKOUT_NAME) {
            errors.push(`Workout name must be less than ${LIMITS.MAX_WORKOUT_NAME} characters`);
        } else {
            cleaned.name = name;
        }
    } else {
        cleaned.name = 'Workout';
    }
    
    // Validate date
    if (workout.date) {
        const date = new Date(workout.date);
        if (isNaN(date.getTime())) {
            errors.push('Invalid workout date');
        } else {
            cleaned.date = date.toISOString();
        }
    } else {
        cleaned.date = new Date().toISOString();
    }
    
    // Validate start and end times
    if (workout.startTime) {
        const startTime = new Date(workout.startTime);
        if (isNaN(startTime.getTime())) {
            errors.push('Invalid start time');
        } else {
            cleaned.startTime = startTime.toISOString();
        }
    }
    
    if (workout.endTime) {
        const endTime = new Date(workout.endTime);
        if (isNaN(endTime.getTime())) {
            errors.push('Invalid end time');
        } else {
            cleaned.endTime = endTime.toISOString();
        }
    }
    
    // Validate duration
    if (workout.duration) {
        const duration = parseInt(workout.duration);
        if (isNaN(duration) || duration < 0) {
            errors.push('Invalid duration');
        } else {
            cleaned.duration = duration;
        }
    } else if (cleaned.startTime && cleaned.endTime) {
        cleaned.duration = new Date(cleaned.endTime) - new Date(cleaned.startTime);
    }
    
    // Validate exercises
    if (workout.exercises) {
        if (!Array.isArray(workout.exercises)) {
            errors.push('Exercises must be an array');
        } else {
            cleaned.exercises = [];
            
            if (workout.exercises.length > LIMITS.MAX_WORKOUT_EXERCISES) {
                errors.push(`Too many exercises (max ${LIMITS.MAX_WORKOUT_EXERCISES})`);
            } else {
                workout.exercises.forEach((exercise, index) => {
                    const validatedExercise = validateExercise(exercise);
                    if (validatedExercise.isValid) {
                        cleaned.exercises.push(validatedExercise.cleaned);
                    } else {
                        errors.push(`Invalid exercise ${index}: ${validatedExercise.errors.join(', ')}`);
                    }
                });
            }
        }
    } else {
        cleaned.exercises = [];
    }
    
    // Validate notes
    if (workout.notes) {
        const notes = String(workout.notes).trim();
        if (notes.length > LIMITS.MAX_NOTES_LENGTH) {
            errors.push(`Notes must be less than ${LIMITS.MAX_NOTES_LENGTH} characters`);
        } else {
            cleaned.notes = notes;
        }
    }
    
    // Validate stats
    if (workout.stats) {
        cleaned.stats = validateWorkoutStats(workout.stats);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Validate exercise data
 * @param {Object} exercise - Exercise to validate
 * @returns {Object} Validation result
 */
export function validateExercise(exercise) {
    const errors = [];
    const cleaned = {};
    
    if (!exercise || typeof exercise !== 'object') {
        return {
            isValid: false,
            errors: ['Exercise must be an object'],
            cleaned: null
        };
    }
    
    // Validate equipment ID
    if (!exercise.equipmentId) {
        errors.push('Equipment ID is required');
    } else {
        cleaned.equipmentId = String(exercise.equipmentId);
    }
    
    // Validate name
    if (exercise.name) {
        cleaned.name = String(exercise.name).trim();
    }
    
    // Validate sets
    if (exercise.sets) {
        if (!Array.isArray(exercise.sets)) {
            errors.push('Sets must be an array');
        } else {
            cleaned.sets = [];
            
            exercise.sets.forEach((set, index) => {
                const validatedSet = validateSet(set);
                if (validatedSet.isValid) {
                    cleaned.sets.push(validatedSet.cleaned);
                } else {
                    errors.push(`Invalid set ${index}: ${validatedSet.errors.join(', ')}`);
                }
            });
        }
    } else {
        cleaned.sets = [];
    }
    
    // Validate order
    if ('order' in exercise) {
        const order = parseInt(exercise.order);
        if (!isNaN(order) && order >= 0) {
            cleaned.order = order;
        }
    }
    
    // Validate completed flag
    if ('completed' in exercise) {
        cleaned.completed = Boolean(exercise.completed);
    }
    
    // Validate skipped flag
    if ('skipped' in exercise) {
        cleaned.skipped = Boolean(exercise.skipped);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Validate set data
 * @param {Object} set - Set to validate
 * @returns {Object} Validation result
 */
export function validateSet(set) {
    const errors = [];
    const cleaned = {};
    
    if (!set || typeof set !== 'object') {
        return {
            isValid: false,
            errors: ['Set must be an object'],
            cleaned: null
        };
    }
    
    // Validate weight
    if ('weight' in set) {
        const weight = parseFloat(set.weight);
        if (isNaN(weight) || weight < 0 || weight > 2000) {
            errors.push('Weight must be between 0 and 2000');
        } else {
            cleaned.weight = weight;
        }
    }
    
    // Validate reps
    if ('reps' in set) {
        const reps = parseInt(set.reps);
        if (isNaN(reps) || reps < 0 || reps > 1000) {
            errors.push('Reps must be between 0 and 1000');
        } else {
            cleaned.reps = reps;
        }
    }
    
    // Validate time (for timed exercises)
    if ('time' in set) {
        const time = parseInt(set.time);
        if (isNaN(time) || time < 0) {
            errors.push('Time must be positive');
        } else {
            cleaned.time = time;
        }
    }
    
    // Validate distance (for cardio)
    if ('distance' in set) {
        const distance = parseFloat(set.distance);
        if (isNaN(distance) || distance < 0) {
            errors.push('Distance must be positive');
        } else {
            cleaned.distance = distance;
        }
    }
    
    // Validate completed flag
    if ('completed' in set) {
        cleaned.completed = Boolean(set.completed);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned
    };
}

/**
 * Validate workout statistics
 * @param {Object} stats - Stats to validate
 * @returns {Object} Cleaned stats
 */
export function validateWorkoutStats(stats) {
    const cleaned = {};
    
    if (!stats || typeof stats !== 'object') {
        return {};
    }
    
    // Validate total exercises
    if ('totalExercises' in stats) {
        const total = parseInt(stats.totalExercises);
        if (!isNaN(total) && total >= 0) {
            cleaned.totalExercises = total;
        }
    }
    
    // Validate completed exercises
    if ('completedExercises' in stats) {
        const completed = parseInt(stats.completedExercises);
        if (!isNaN(completed) && completed >= 0) {
            cleaned.completedExercises = completed;
        }
    }
    
    // Validate total sets
    if ('totalSets' in stats) {
        const sets = parseInt(stats.totalSets);
        if (!isNaN(sets) && sets >= 0) {
            cleaned.totalSets = sets;
        }
    }
    
    // Validate total reps
    if ('totalReps' in stats) {
        const reps = parseInt(stats.totalReps);
        if (!isNaN(reps) && reps >= 0) {
            cleaned.totalReps = reps;
        }
    }
    
    // Validate total weight
    if ('totalWeight' in stats) {
        const weight = parseFloat(stats.totalWeight);
        if (!isNaN(weight) && weight >= 0) {
            cleaned.totalWeight = weight;
        }
    }
    
    // Validate calories
    if ('calories' in stats) {
        const calories = parseInt(stats.calories);
        if (!isNaN(calories) && calories >= 0) {
            cleaned.calories = calories;
        }
    }
    
    return cleaned;
}

/**
 * Get default workout logs
 * @returns {Object} Default workout logs
 */
export function getDefaultWorkoutLogs() {
    return {};
}

/**
 * Generate workout ID
 * @returns {string} Workout ID
 */
export function generateWorkoutId() {
    return `workout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate workout statistics
 * @param {Object} workout - Workout data
 * @returns {Object} Calculated stats
 */
export function calculateWorkoutStats(workout) {
    const stats = {
        totalExercises: 0,
        completedExercises: 0,
        totalSets: 0,
        completedSets: 0,
        totalReps: 0,
        totalWeight: 0,
        muscleGroups: new Set()
    };
    
    if (!workout || !workout.exercises) {
        return stats;
    }
    
    workout.exercises.forEach(exercise => {
        stats.totalExercises++;
        
        if (exercise.completed) {
            stats.completedExercises++;
        }
        
        if (exercise.sets) {
            exercise.sets.forEach(set => {
                stats.totalSets++;
                
                if (set.completed) {
                    stats.completedSets++;
                    
                    if (set.reps) {
                        stats.totalReps += set.reps;
                        
                        if (set.weight) {
                            stats.totalWeight += set.weight * set.reps;
                        }
                    }
                }
            });
        }
        
        if (exercise.muscleGroups) {
            exercise.muscleGroups.forEach(group => {
                stats.muscleGroups.add(group);
            });
        }
    });
    
    stats.muscleGroups = Array.from(stats.muscleGroups);
    
    return stats;
}

/**
 * Format workout duration
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '0:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}