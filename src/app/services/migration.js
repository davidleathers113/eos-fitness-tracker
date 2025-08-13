/**
 * Data Migration Service
 * Handles migration from local storage to cloud storage
 */

import { storage } from './storage/localStorage.js';
import { migrateData as apiMigrateData, markMigrationComplete } from './api/auth.js';
import { STORAGE_KEYS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../core/constants.js';
import { emit, EVT } from '../core/events.js';
import { validateSettings } from '../features/settings/data.js';
import { validateWorkoutLogs } from '../features/workout/data.js';

/**
 * Check if migration is needed
 * @returns {boolean} Needs migration
 */
export function needsMigration() {
    // Check if already migrated
    const migrationComplete = storage.get(STORAGE_KEYS.MIGRATION_COMPLETE);
    if (migrationComplete === true || migrationComplete === 'true') {
        return false;
    }
    
    // Check for local data
    const hasSettings = storage.get(STORAGE_KEYS.MY_SETTINGS) !== null;
    const hasWorkouts = storage.get(STORAGE_KEYS.WORKOUT_LOGS) !== null;
    
    return hasSettings || hasWorkouts;
}

/**
 * Perform data migration
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Migration result
 */
export async function performMigration(onProgress = () => {}) {
    try {
        emit(EVT.DATA_MIGRATION_START);
        onProgress(0, 'Starting migration...');
        
        // Load local data
        const localSettings = storage.get(STORAGE_KEYS.MY_SETTINGS);
        const localWorkoutLogs = storage.get(STORAGE_KEYS.WORKOUT_LOGS);
        
        if (!localSettings && !localWorkoutLogs) {
            // No data to migrate
            markMigrationComplete();
            return {
                success: true,
                message: 'No data to migrate',
                migrated: {
                    settings: 0,
                    workouts: 0
                }
            };
        }
        
        onProgress(25, 'Validating data...');
        
        // Validate data
        let validSettings = null;
        let validWorkoutLogs = null;
        
        if (localSettings) {
            const settingsValidation = validateSettings(localSettings);
            if (settingsValidation.isValid) {
                validSettings = settingsValidation.cleaned;
            } else {
                console.warn('Invalid settings data:', settingsValidation.errors);
            }
        }
        
        if (localWorkoutLogs) {
            const logsValidation = validateWorkoutLogs(localWorkoutLogs);
            if (logsValidation.isValid) {
                validWorkoutLogs = logsValidation.cleaned;
            } else {
                console.warn('Invalid workout logs:', logsValidation.errors);
            }
        }
        
        if (!validSettings && !validWorkoutLogs) {
            return {
                error: true,
                message: ERROR_MESSAGES.INVALID_DATA
            };
        }
        
        onProgress(50, 'Uploading to cloud...');
        
        // Perform migration via API
        const result = await apiMigrateData(validSettings, validWorkoutLogs);
        
        if (result.error) {
            throw new Error(result.message || ERROR_MESSAGES.MIGRATION_FAILED);
        }
        
        onProgress(75, 'Cleaning up local data...');
        
        // Clean up local data after successful migration
        storage.remove(STORAGE_KEYS.MY_SETTINGS);
        storage.remove(STORAGE_KEYS.WORKOUT_LOGS);
        
        onProgress(100, 'Migration complete!');
        
        emit(EVT.DATA_MIGRATION_COMPLETE, {
            settingsCount: result.migration?.settings?.equipmentCount || 0,
            workoutsCount: result.migration?.workoutLogs?.totalWorkouts || 0
        });
        
        return {
            success: true,
            message: SUCCESS_MESSAGES.MIGRATION_SUCCESS,
            migrated: {
                settings: result.migration?.settings?.equipmentCount || 0,
                workouts: result.migration?.workoutLogs?.totalWorkouts || 0
            }
        };
        
    } catch (error) {
        console.error('Migration error:', error);
        
        emit(EVT.APP_ERROR, {
            type: 'migration',
            error: error.message
        });
        
        return {
            error: true,
            message: error.message || ERROR_MESSAGES.MIGRATION_FAILED
        };
    }
}

/**
 * Skip migration
 */
export function skipMigration() {
    markMigrationComplete();
    emit(EVT.DATA_MIGRATION_COMPLETE, {
        skipped: true
    });
}

/**
 * Create backup of local data before migration
 * @returns {Object} Backup data
 */
export function createBackup() {
    const backup = {
        timestamp: new Date().toISOString(),
        settings: storage.get(STORAGE_KEYS.MY_SETTINGS),
        workoutLogs: storage.get(STORAGE_KEYS.WORKOUT_LOGS),
        preferences: storage.get(STORAGE_KEYS.USER_PREFERENCES)
    };
    
    // Store backup
    storage.set('backup_' + backup.timestamp, backup);
    
    return backup;
}

/**
 * Restore from backup
 * @param {string} timestamp - Backup timestamp
 * @returns {boolean} Success
 */
export function restoreBackup(timestamp) {
    const backup = storage.get('backup_' + timestamp);
    
    if (!backup) {
        return false;
    }
    
    try {
        if (backup.settings) {
            storage.set(STORAGE_KEYS.MY_SETTINGS, backup.settings);
        }
        if (backup.workoutLogs) {
            storage.set(STORAGE_KEYS.WORKOUT_LOGS, backup.workoutLogs);
        }
        if (backup.preferences) {
            storage.set(STORAGE_KEYS.USER_PREFERENCES, backup.preferences);
        }
        
        return true;
    } catch (error) {
        console.error('Restore error:', error);
        return false;
    }
}

/**
 * Get list of available backups
 * @returns {Array} Backup list
 */
export function getBackups() {
    const backups = [];
    const keys = storage.keys();
    
    keys.forEach(key => {
        if (key.startsWith('backup_')) {
            const timestamp = key.replace('backup_', '');
            const backup = storage.get(key);
            
            if (backup) {
                backups.push({
                    timestamp,
                    date: new Date(timestamp),
                    hasSettings: !!backup.settings,
                    hasWorkouts: !!backup.workoutLogs
                });
            }
        }
    });
    
    return backups.sort((a, b) => b.date - a.date);
}

/**
 * Delete old backups
 * @param {number} daysToKeep - Number of days to keep
 */
export function cleanupBackups(daysToKeep = 7) {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const keys = storage.keys();
    
    keys.forEach(key => {
        if (key.startsWith('backup_')) {
            const timestamp = key.replace('backup_', '');
            const date = new Date(timestamp);
            
            if (date.getTime() < cutoff) {
                storage.remove(key);
            }
        }
    });
}