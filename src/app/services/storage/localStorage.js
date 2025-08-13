/**
 * LocalStorage Wrapper
 * Safe localStorage operations with fallbacks
 */

import { STORAGE_KEYS, ERROR_MESSAGES } from '../../core/constants.js';
import { emit, EVT } from '../../core/events.js';

class LocalStorageService {
    constructor() {
        this.isAvailable = this.checkAvailability();
        this.cache = new Map();
    }
    
    /**
     * Check if localStorage is available
     * @returns {boolean} Is available
     */
    checkAvailability() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage not available:', e);
            return false;
        }
    }
    
    /**
     * Get item from storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Stored value or default
     */
    get(key, defaultValue = null) {
        try {
            if (!this.isAvailable) {
                return this.cache.get(key) || defaultValue;
            }
            
            const item = localStorage.getItem(key);
            if (item === null) {
                return defaultValue;
            }
            
            // Try to parse JSON
            try {
                return JSON.parse(item);
            } catch {
                // Return as string if not JSON
                return item;
            }
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }
    
    /**
     * Set item in storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} Success
     */
    set(key, value) {
        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            
            if (!this.isAvailable) {
                this.cache.set(key, value);
                return true;
            }
            
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            
            if (error.name === 'QuotaExceededError') {
                emit(EVT.APP_ERROR, {
                    type: 'storage',
                    message: ERROR_MESSAGES.QUOTA_EXCEEDED
                });
                
                // Try to clear old data
                this.clearOldData();
                
                // Retry once
                try {
                    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
                    localStorage.setItem(key, serialized);
                    return true;
                } catch {
                    // Fall back to cache
                    this.cache.set(key, value);
                    return false;
                }
            }
            
            // Fall back to cache
            this.cache.set(key, value);
            return false;
        }
    }
    
    /**
     * Remove item from storage
     * @param {string} key - Storage key
     * @returns {boolean} Success
     */
    remove(key) {
        try {
            if (this.isAvailable) {
                localStorage.removeItem(key);
            }
            this.cache.delete(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }
    
    /**
     * Clear all storage
     * @param {Array} preserve - Keys to preserve
     * @returns {boolean} Success
     */
    clear(preserve = []) {
        try {
            if (this.isAvailable) {
                if (preserve.length > 0) {
                    // Preserve specific keys
                    const preserved = {};
                    preserve.forEach(key => {
                        const value = localStorage.getItem(key);
                        if (value !== null) {
                            preserved[key] = value;
                        }
                    });
                    
                    localStorage.clear();
                    
                    // Restore preserved keys
                    Object.entries(preserved).forEach(([key, value]) => {
                        localStorage.setItem(key, value);
                    });
                } else {
                    localStorage.clear();
                }
            }
            
            this.cache.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }
    
    /**
     * Get all keys
     * @returns {Array} Storage keys
     */
    keys() {
        if (!this.isAvailable) {
            return Array.from(this.cache.keys());
        }
        
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        return keys;
    }
    
    /**
     * Get storage size
     * @returns {number} Approximate size in bytes
     */
    getSize() {
        if (!this.isAvailable) {
            let size = 0;
            this.cache.forEach((value, key) => {
                size += key.length + JSON.stringify(value).length;
            });
            return size;
        }
        
        let size = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                size += localStorage[key].length + key.length;
            }
        }
        return size;
    }
    
    /**
     * Clear old data to free up space
     */
    clearOldData() {
        try {
            // Clear old workout logs (keep last 30 days)
            const workoutLogs = this.get(STORAGE_KEYS.WORKOUT_LOGS, {});
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            const filteredLogs = {};
            Object.entries(workoutLogs).forEach(([date, log]) => {
                if (new Date(date).getTime() > thirtyDaysAgo) {
                    filteredLogs[date] = log;
                }
            });
            
            if (Object.keys(filteredLogs).length < Object.keys(workoutLogs).length) {
                this.set(STORAGE_KEYS.WORKOUT_LOGS, filteredLogs);
            }
            
            // Clear offline queue if too large
            const queue = this.get(STORAGE_KEYS.OFFLINE_QUEUE, []);
            if (queue.length > 100) {
                this.set(STORAGE_KEYS.OFFLINE_QUEUE, queue.slice(-50));
            }
        } catch (error) {
            console.error('Failed to clear old data:', error);
        }
    }
    
    /**
     * Export all data
     * @returns {Object} All stored data
     */
    exportAll() {
        const data = {};
        
        if (this.isAvailable) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                data[key] = this.get(key);
            }
        } else {
            this.cache.forEach((value, key) => {
                data[key] = value;
            });
        }
        
        return data;
    }
    
    /**
     * Import data
     * @param {Object} data - Data to import
     * @returns {boolean} Success
     */
    importAll(data) {
        try {
            Object.entries(data).forEach(([key, value]) => {
                this.set(key, value);
            });
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    }
}

// Export singleton instance
export const storage = new LocalStorageService();

// Export convenience methods
export const getStoredValue = (key, defaultValue) => storage.get(key, defaultValue);
export const setStoredValue = (key, value) => storage.set(key, value);
export const removeStoredValue = (key) => storage.remove(key);
export const clearStorage = (preserve) => storage.clear(preserve);