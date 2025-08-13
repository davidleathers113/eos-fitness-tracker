/**
 * PWA Service
 * Handles Progressive Web App features
 */

import { emit, EVT } from '../core/events.js';

class PWAService {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isStandalone = false;
        this.serviceWorkerRegistration = null;
    }
    
    /**
     * Initialize PWA features
     */
    async init() {
        // Check if already installed
        this.checkInstallStatus();
        
        // Listen for install prompt
        this.setupInstallPrompt();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Listen for app installed event
        this.setupInstalledListener();
        
        // Setup update check
        this.setupUpdateCheck();
    }
    
    /**
     * Check if app is installed
     */
    checkInstallStatus() {
        // Check if running in standalone mode
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone ||
                           document.referrer.includes('android-app://');
        
        // Check if installed (for browsers that support it)
        if ('getInstalledRelatedApps' in navigator) {
            navigator.getInstalledRelatedApps().then(apps => {
                this.isInstalled = apps.length > 0;
            });
        }
    }
    
    /**
     * Setup install prompt listener
     */
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            
            // Emit event for UI to handle
            emit('pwa/install-available');
        });
    }
    
    /**
     * Setup installed listener
     */
    setupInstalledListener() {
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            
            emit('pwa/installed');
        });
    }
    
    /**
     * Register service worker
     */
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
        }
        
        try {
            this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', this.serviceWorkerRegistration.scope);
            
            // Check for updates
            this.serviceWorkerRegistration.addEventListener('updatefound', () => {
                const newWorker = this.serviceWorkerRegistration.installing;
                
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New content available
                            emit('pwa/update-available');
                        }
                    });
                }
            });
            
            // Handle controller change
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    
    /**
     * Setup periodic update check
     */
    setupUpdateCheck() {
        // Check for updates every hour
        setInterval(() => {
            this.checkForUpdates();
        }, 60 * 60 * 1000);
        
        // Also check on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkForUpdates();
            }
        });
    }
    
    /**
     * Check for app updates
     */
    async checkForUpdates() {
        if (!this.serviceWorkerRegistration) return;
        
        try {
            await this.serviceWorkerRegistration.update();
        } catch (error) {
            console.error('Update check failed:', error);
        }
    }
    
    /**
     * Prompt user to install app
     * @returns {Promise<boolean>} Install accepted
     */
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('Install prompt not available');
            return false;
        }
        
        // Show the prompt
        this.deferredPrompt.prompt();
        
        // Wait for the user to respond
        const { outcome } = await this.deferredPrompt.userChoice;
        
        // Clear the deferred prompt
        this.deferredPrompt = null;
        
        // Emit result
        emit('pwa/install-' + outcome);
        
        return outcome === 'accepted';
    }
    
    /**
     * Skip waiting and activate new service worker
     */
    skipWaiting() {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
    }
    
    /**
     * Get install status
     * @returns {Object} Install status
     */
    getInstallStatus() {
        return {
            canInstall: !!this.deferredPrompt,
            isInstalled: this.isInstalled,
            isStandalone: this.isStandalone
        };
    }
    
    /**
     * Request persistent storage
     * @returns {Promise<boolean>} Granted
     */
    async requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persist();
            
            if (isPersisted) {
                console.log('Storage will persist');
                emit('pwa/storage-persisted');
            }
            
            return isPersisted;
        }
        
        return false;
    }
    
    /**
     * Get storage estimate
     * @returns {Promise<Object>} Storage info
     */
    async getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0,
                percentage: estimate.quota ? (estimate.usage / estimate.quota * 100) : 0
            };
        }
        
        return {
            usage: 0,
            quota: 0,
            percentage: 0
        };
    }
    
    /**
     * Request notification permission
     * @returns {Promise<string>} Permission state
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        
        if (Notification.permission === 'granted') {
            return 'granted';
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                emit('pwa/notifications-enabled');
            }
            
            return permission;
        }
        
        return Notification.permission;
    }
    
    /**
     * Show notification
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     */
    async showNotification(title, options = {}) {
        if (Notification.permission !== 'granted') {
            return;
        }
        
        const defaultOptions = {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            tag: 'eos-fitness',
            requireInteraction: false,
            ...options
        };
        
        if (this.serviceWorkerRegistration) {
            // Use service worker to show notification
            await this.serviceWorkerRegistration.showNotification(title, defaultOptions);
        } else {
            // Fallback to Notification API
            new Notification(title, defaultOptions);
        }
    }
    
    /**
     * Clear badge
     */
    async clearBadge() {
        if ('clearAppBadge' in navigator) {
            await navigator.clearAppBadge();
        }
    }
    
    /**
     * Set badge
     * @param {number} count - Badge count
     */
    async setBadge(count) {
        if ('setAppBadge' in navigator) {
            await navigator.setAppBadge(count);
        }
    }
}

// Export singleton instance
export const pwaService = new PWAService();

// Export convenience methods
export const initPWA = () => pwaService.init();
export const promptInstall = () => pwaService.promptInstall();
export const getInstallStatus = () => pwaService.getInstallStatus();
export const requestNotificationPermission = () => pwaService.requestNotificationPermission();
export const showNotification = (title, options) => pwaService.showNotification(title, options);