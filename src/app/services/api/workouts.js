/**
 * Workouts API
 * Handles workout logs and history
 */

import { apiClient } from './client.js';
import { emit, EVT } from '../../core/events.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../../core/constants.js';

/**
 * Get workout logs from cloud
 * @returns {Promise<Object>} Workout logs data
 */
export async function getWorkoutLogs() {
    try {
        const response = await apiClient.get('/user-workouts');
        
        if (!response.error && response.workoutLogs) {
            return {
                success: true,
                workoutLogs: response.workoutLogs
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to load workout logs:', error);
        return {
            error: true,
            message: error.message || ERROR_MESSAGES.LOAD_FAILED
        };
    }
}

/**
 * Add a new workout
 * @param {Object} workout - Workout data
 * @returns {Promise<Object>} Add result
 */
export async function addWorkout(workout) {
    try {
        const response = await apiClient.post('/user-workouts', { workout });
        
        if (!response.error) {
            emit(EVT.WORKOUT_SAVED, workout);
            return {
                success: true,
                workoutId: response.workoutId,
                message: SUCCESS_MESSAGES.WORKOUT_SAVED
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to save workout:', error);
        return {
            error: true,
            message: error.message || ERROR_MESSAGES.SAVE_FAILED
        };
    }
}

/**
 * Update an existing workout
 * @param {string} workoutId - Workout ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Update result
 */
export async function updateWorkout(workoutId, updates) {
    try {
        const response = await apiClient.put(`/user-workouts/${workoutId}`, {
            updates
        });
        
        if (!response.error) {
            return {
                success: true,
                message: 'Workout updated'
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to update workout:', error);
        return {
            error: true,
            message: error.message || 'Update failed'
        };
    }
}

/**
 * Delete a workout
 * @param {string} workoutId - Workout ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteWorkout(workoutId) {
    try {
        const response = await apiClient.delete(`/user-workouts/${workoutId}`);
        
        if (!response.error) {
            return {
                success: true,
                message: 'Workout deleted'
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to delete workout:', error);
        return {
            error: true,
            message: error.message || 'Delete failed'
        };
    }
}

/**
 * Get workout statistics
 * @param {Object} options - Stats options
 * @returns {Promise<Object>} Statistics data
 */
export async function getWorkoutStats(options = {}) {
    const { 
        startDate,
        endDate,
        groupBy = 'week'
    } = options;
    
    try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('groupBy', groupBy);
        
        const response = await apiClient.get(`/user-workouts/stats?${params}`);
        
        if (!response.error && response.stats) {
            return {
                success: true,
                stats: response.stats
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to load workout stats:', error);
        return {
            error: true,
            message: error.message || 'Failed to load statistics'
        };
    }
}

/**
 * Save workout template
 * @param {Object} template - Template data
 * @returns {Promise<Object>} Save result
 */
export async function saveWorkoutTemplate(template) {
    try {
        const response = await apiClient.post('/user-workouts/templates', {
            template
        });
        
        if (!response.error) {
            return {
                success: true,
                templateId: response.templateId,
                message: 'Template saved'
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to save template:', error);
        return {
            error: true,
            message: error.message || 'Failed to save template'
        };
    }
}

/**
 * Get workout templates
 * @returns {Promise<Object>} Templates data
 */
export async function getWorkoutTemplates() {
    try {
        const response = await apiClient.get('/user-workouts/templates');
        
        if (!response.error && response.templates) {
            return {
                success: true,
                templates: response.templates
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to load templates:', error);
        return {
            error: true,
            message: error.message || 'Failed to load templates'
        };
    }
}