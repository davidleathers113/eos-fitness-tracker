/**
 * Authentication API
 * Handles user registration, login, and auth management
 */

import { apiClient } from './client.js';
import { emit, EVT } from '../../core/events.js';
import { STORAGE_KEYS, SUCCESS_MESSAGES } from '../../core/constants.js';

/**
 * Register a new user
 * @param {string} userName - User's name
 * @returns {Promise<Object>} Registration result
 */
export async function registerUser(userName) {
    try {
        const response = await apiClient.post('/user-register', 
            { userName },
            { requireAuth: false }
        );
        
        if (!response.error && response.userId && response.token) {
            // Set authentication
            apiClient.setAuth(response.userId, response.token);
            
            // Emit event
            emit(EVT.AUTH_REGISTER, {
                userId: response.userId,
                userName: userName
            });
            
            return {
                success: true,
                userId: response.userId,
                token: response.token,
                message: SUCCESS_MESSAGES.REGISTRATION_SUCCESS
            };
        }
        
        return response;
    } catch (error) {
        console.error('Registration error:', error);
        return {
            error: true,
            message: error.message || 'Registration failed'
        };
    }
}

/**
 * Login user with ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Login result
 */
export async function loginUser(userId) {
    try {
        const response = await apiClient.post('/user-login',
            { userId },
            { requireAuth: false }
        );
        
        if (!response.error && response.token) {
            // Set authentication
            apiClient.setAuth(userId, response.token);
            
            // Emit event
            emit(EVT.AUTH_LOGIN, { userId });
            
            return {
                success: true,
                token: response.token,
                message: SUCCESS_MESSAGES.LOGIN_SUCCESS
            };
        }
        
        return response;
    } catch (error) {
        console.error('Login error:', error);
        return {
            error: true,
            message: error.message || 'Login failed'
        };
    }
}

/**
 * Logout user
 */
export function logout() {
    apiClient.clearAuth();
    emit(EVT.AUTH_LOGOUT);
    
    return {
        success: true,
        message: SUCCESS_MESSAGES.LOGOUT_SUCCESS
    };
}

/**
 * Check if user needs migration
 * @returns {boolean} Needs migration
 */
export function shouldMigrate() {
    try {
        // Check if migration is already complete
        const migrationComplete = localStorage.getItem(STORAGE_KEYS.MIGRATION_COMPLETE);
        if (migrationComplete === 'true') {
            return false;
        }
        
        // Check if there's local data to migrate
        const hasLocalSettings = localStorage.getItem(STORAGE_KEYS.MY_SETTINGS);
        const hasLocalWorkouts = localStorage.getItem(STORAGE_KEYS.WORKOUT_LOGS);
        
        return !!(hasLocalSettings || hasLocalWorkouts);
    } catch (error) {
        console.error('Migration check error:', error);
        return false;
    }
}

/**
 * Mark migration as complete
 */
export function markMigrationComplete() {
    try {
        localStorage.setItem(STORAGE_KEYS.MIGRATION_COMPLETE, 'true');
    } catch (error) {
        console.error('Failed to mark migration complete:', error);
    }
}

/**
 * Migrate local data to cloud
 * @param {Object} settings - Local settings data
 * @param {Object} workoutLogs - Local workout logs
 * @returns {Promise<Object>} Migration result
 */
export async function migrateData(settings, workoutLogs) {
    try {
        const response = await apiClient.post('/user-migrate', {
            settings,
            workoutLogs
        });
        
        if (!response.error) {
            markMigrationComplete();
            
            emit(EVT.DATA_MIGRATION_COMPLETE, {
                settingsCount: response.migration?.settings?.equipmentCount || 0,
                workoutsCount: response.migration?.workoutLogs?.totalWorkouts || 0
            });
            
            return {
                success: true,
                migration: response.migration,
                message: SUCCESS_MESSAGES.MIGRATION_SUCCESS
            };
        }
        
        return response;
    } catch (error) {
        console.error('Migration error:', error);
        emit(EVT.APP_ERROR, { 
            type: 'migration',
            error: error.message 
        });
        
        return {
            error: true,
            message: error.message || 'Migration failed'
        };
    }
}

/**
 * Get current user info
 * @returns {Object} User info
 */
export function getCurrentUser() {
    return {
        userId: apiClient.userId,
        isAuthenticated: apiClient.isAuthenticated,
        isOnline: apiClient.isOnline
    };
}

/**
 * Refresh authentication token
 * @returns {Promise<Object>} Refresh result
 */
export async function refreshToken() {
    if (!apiClient.userId) {
        return {
            error: true,
            message: 'No user ID available'
        };
    }
    
    try {
        const response = await apiClient.post('/user-refresh', {
            userId: apiClient.userId
        });
        
        if (!response.error && response.token) {
            apiClient.setAuth(apiClient.userId, response.token);
            
            return {
                success: true,
                token: response.token
            };
        }
        
        return response;
    } catch (error) {
        console.error('Token refresh error:', error);
        return {
            error: true,
            message: error.message || 'Token refresh failed'
        };
    }
}

// Export auth state getters
export const isAuthenticated = () => apiClient.isAuthenticated;
export const getUserId = () => apiClient.userId;
export const getToken = () => apiClient.token;