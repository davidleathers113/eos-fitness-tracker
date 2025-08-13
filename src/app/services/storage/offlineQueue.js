/**
 * Offline Queue
 * Manages operations that need to be synced when online
 */

import { STORAGE_KEYS, LIMITS } from '../../core/constants.js';
import { emit, EVT, on } from '../../core/events.js';
import { saveSettings } from '../api/settings.js';
import { addWorkout, updateWorkout } from '../api/workouts.js';

class OfflineQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.maxRetries = 3;
        this.syncInterval = null;
        
        // Load queue from storage
        this.loadQueue();
        
        // Listen for network events
        on(EVT.NETWORK_ONLINE, () => this.startAutoSync());
        on(EVT.NETWORK_OFFLINE, () => this.stopAutoSync());
        
        // Start auto-sync if online
        if (navigator.onLine) {
            this.startAutoSync();
        }
    }
    
    /**
     * Load queue from localStorage
     */
    loadQueue() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            this.queue = [];
        }
    }
    
    /**
     * Save queue to localStorage
     */
    saveQueue() {
        try {
            localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
            
            // Check if storage quota exceeded
            if (error.name === 'QuotaExceededError') {
                emit(EVT.APP_ERROR, {
                    type: 'storage',
                    message: 'Storage quota exceeded'
                });
            }
        }
    }
    
    /**
     * Add item to queue
     * @param {Object} item - Queue item
     */
    add(item) {
        const queueItem = {
            id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retries: 0,
            ...item
        };
        
        this.queue.push(queueItem);
        this.saveQueue();
        
        // Try to process immediately if online
        if (navigator.onLine && !this.isProcessing) {
            this.processQueue();
        }
    }
    
    /**
     * Remove item from queue
     * @param {string} id - Item ID
     */
    remove(id) {
        this.queue = this.queue.filter(item => item.id !== id);
        this.saveQueue();
    }
    
    /**
     * Clear entire queue
     */
    clear() {
        this.queue = [];
        this.saveQueue();
    }
    
    /**
     * Process queue items
     */
    async processQueue() {
        if (this.isProcessing || !navigator.onLine || this.queue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        // Process items in order
        while (this.queue.length > 0 && navigator.onLine) {
            const item = this.queue[0];
            
            try {
                const result = await this.processQueueItem(item);
                
                if (result.success) {
                    // Remove successful item
                    this.remove(item.id);
                } else if (result.retry === false) {
                    // Don't retry this item
                    this.remove(item.id);
                    emit(EVT.APP_ERROR, {
                        type: 'sync',
                        message: `Failed to sync: ${result.message}`
                    });
                } else {
                    // Increment retry count
                    item.retries++;
                    
                    if (item.retries >= this.maxRetries) {
                        // Max retries reached
                        this.remove(item.id);
                        emit(EVT.APP_ERROR, {
                            type: 'sync',
                            message: `Max retries reached for ${item.type}`
                        });
                    } else {
                        // Move to end of queue
                        this.queue.shift();
                        this.queue.push(item);
                        this.saveQueue();
                    }
                }
            } catch (error) {
                console.error('Queue processing error:', error);
                
                // Move to end and increment retries
                item.retries++;
                this.queue.shift();
                
                if (item.retries < this.maxRetries) {
                    this.queue.push(item);
                }
                
                this.saveQueue();
            }
        }
        
        this.isProcessing = false;
        
        // Emit sync complete if queue is empty
        if (this.queue.length === 0) {
            emit(EVT.APP_LOADING, false);
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        }
    }
    
    /**
     * Process individual queue item
     * @param {Object} item - Queue item
     * @returns {Promise<Object>} Process result
     */
    async processQueueItem(item) {
        switch (item.type) {
            case 'save-settings':
                return await saveSettings(item.data);
                
            case 'save-workout':
                return await addWorkout(item.data);
                
            case 'update-workout':
                return await updateWorkout(item.workoutId, item.data);
                
            default:
                console.warn('Unknown queue item type:', item.type);
                return { success: false, retry: false };
        }
    }
    
    /**
     * Start automatic sync
     */
    startAutoSync() {
        if (this.syncInterval) {
            return;
        }
        
        // Process immediately
        this.processQueue();
        
        // Set up periodic sync
        this.syncInterval = setInterval(() => {
            this.processQueue();
        }, LIMITS.SYNC_INTERVAL);
    }
    
    /**
     * Stop automatic sync
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    /**
     * Get queue status
     * @returns {Object} Queue status
     */
    getStatus() {
        return {
            count: this.queue.length,
            isProcessing: this.isProcessing,
            oldestItem: this.queue[0]?.timestamp,
            items: this.queue.map(item => ({
                type: item.type,
                timestamp: item.timestamp,
                retries: item.retries
            }))
        };
    }
    
    /**
     * Force sync now
     * @returns {Promise} Process promise
     */
    async forceSync() {
        if (navigator.onLine) {
            return this.processQueue();
        }
        
        return Promise.reject(new Error('Cannot sync while offline'));
    }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();

// Export convenience methods
export const queueOperation = (type, data) => offlineQueue.add({ type, data });
export const getQueueStatus = () => offlineQueue.getStatus();
export const forceSync = () => offlineQueue.forceSync();