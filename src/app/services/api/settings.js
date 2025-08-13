/**
 * Settings API
 * Handles user settings and preferences
 */

import { apiClient } from './client.js';
import { emit, EVT } from '../../core/events.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../../core/constants.js';

/**
 * Get user settings from cloud
 * @returns {Promise<Object>} Settings data
 */
export async function getSettings() {
    try {
        const response = await apiClient.get('/user-settings');
        
        if (!response.error && response.settings) {
            emit(EVT.SETTINGS_LOADED, response.settings);
            return {
                success: true,
                settings: response.settings
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to load settings:', error);
        return {
            error: true,
            message: error.message || ERROR_MESSAGES.LOAD_FAILED
        };
    }
}

/**
 * Save user settings to cloud
 * @param {Object} settings - Settings to save
 * @returns {Promise<Object>} Save result
 */
export async function saveSettings(settings) {
    try {
        const response = await apiClient.put('/user-settings', { settings });
        
        if (!response.error) {
            emit(EVT.SETTINGS_SAVED, settings);
            return {
                success: true,
                message: SUCCESS_MESSAGES.SETTINGS_SAVED
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to save settings:', error);
        return {
            error: true,
            message: error.message || ERROR_MESSAGES.SAVE_FAILED
        };
    }
}

/**
 * Update specific equipment settings
 * @param {string} equipmentId - Equipment ID
 * @param {Object} settings - Equipment settings
 * @returns {Promise<Object>} Update result
 */
export async function updateEquipmentSettings(equipmentId, settings) {
    try {
        const response = await apiClient.put(`/user-settings/equipment/${equipmentId}`, {
            settings
        });
        
        if (!response.error) {
            emit(EVT.EQUIPMENT_SETTINGS_SAVED, { equipmentId, settings });
            return {
                success: true,
                message: 'Equipment settings updated'
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to update equipment settings:', error);
        return {
            error: true,
            message: error.message || 'Failed to update equipment settings'
        };
    }
}

/**
 * Export user data
 * @returns {Promise<Object>} Export result with data
 */
export async function exportUserData() {
    try {
        const response = await apiClient.get('/user-export');
        
        if (!response.error && response.data) {
            emit(EVT.DATA_EXPORT, response.data);
            return {
                success: true,
                data: response.data,
                message: SUCCESS_MESSAGES.DATA_EXPORTED
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to export data:', error);
        return {
            error: true,
            message: error.message || 'Export failed'
        };
    }
}

/**
 * Reset user data
 * @param {Object} options - Reset options
 * @returns {Promise<Object>} Reset result
 */
export async function resetUserData(options = {}) {
    const { 
        resetSettings = true,
        resetWorkouts = true,
        keepPreferences = false 
    } = options;
    
    try {
        const response = await apiClient.post('/user-reset', {
            resetSettings,
            resetWorkouts,
            keepPreferences
        });
        
        if (!response.error) {
            emit(EVT.DATA_RESET, { options });
            return {
                success: true,
                message: SUCCESS_MESSAGES.DATA_RESET
            };
        }
        
        return response;
    } catch (error) {
        console.error('Failed to reset data:', error);
        return {
            error: true,
            message: error.message || 'Reset failed'
        };
    }
}