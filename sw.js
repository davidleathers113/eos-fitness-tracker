// EOS Fitness Tracker - Service Worker
// Implements comprehensive caching strategy for PWA functionality

const CACHE_NAME = 'eos-fitness-tracker-v3';
const DYNAMIC_CACHE_NAME = 'eos-fitness-dynamic-v3';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/src/app/index.js',
    '/styles/tokens.css?v=2.1.0',
    '/styles/base.css?v=2.1.0',
    '/styles/layout.css?v=2.1.0',
    '/styles/components.css?v=2.1.0',
    '/styles/features.css?v=2.1.0',
    '/styles/pwa.css?v=2.1.0',
    '/manifest.json',
    '/database/equipment-database.json',
    // Fallback offline page
    '/offline.html'
];

// Network-only paths (never cache)
const NETWORK_ONLY_PATHS = [
    '/netlify/functions/',
    '/api/',
    '/.netlify/'
];

// Cache strategies
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Static assets cached successfully');
                // Force activation of new service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old cache versions
                        if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Cache cleanup complete');
                // Take control of all pages immediately
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('Service Worker: Activation failed:', error);
            })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const path = url.pathname;
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Network-only for excluded paths
    if (NETWORK_ONLY_PATHS.some(excludedPath => path.includes(excludedPath))) {
        event.respondWith(
            handleNetworkOnly(event.request)
        );
        return;
    }
    
    // Determine caching strategy based on request type
    const strategy = getCachingStrategy(event.request);
    
    switch (strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
            event.respondWith(handleCacheFirst(event.request));
            break;
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
            event.respondWith(handleStaleWhileRevalidate(event.request));
            break;
        case CACHE_STRATEGIES.NETWORK_FIRST:
            event.respondWith(handleNetworkFirst(event.request));
            break;
        case CACHE_STRATEGIES.NETWORK_ONLY:
            event.respondWith(handleNetworkOnly(event.request));
            break;
        default:
            event.respondWith(handleCacheFirst(event.request));
    }
});

// Determine caching strategy based on request
function getCachingStrategy(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Static assets: cache-first
    if (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.png') || 
        path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif') || 
        path.endsWith('.ico') || path.endsWith('.svg')) {
        return CACHE_STRATEGIES.CACHE_FIRST;
    }
    
    // Equipment database: stale-while-revalidate
    if (path.includes('equipment-database.json')) {
        return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
    }
    
    // User data (settings, workout logs): network-first
    if (path.includes('my-settings.json') || path.includes('workout-logs.json')) {
        return CACHE_STRATEGIES.NETWORK_FIRST;
    }
    
    // HTML pages: stale-while-revalidate
    if (path.endsWith('.html') || path === '/' || path === '') {
        return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
    }
    
    // Auth endpoints: network-only
    if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
        return CACHE_STRATEGIES.NETWORK_ONLY;
    }
    
    // Default to cache-first for other requests
    return CACHE_STRATEGIES.CACHE_FIRST;
}

// Cache-first strategy
async function handleCacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Cache-first failed:', error);
        
        // Try to return cached version as fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/offline.html');
        }
        
        throw error;
    }
}

// Network-first strategy
async function handleNetworkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Network-first failed, trying cache:', error);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

// Stale-while-revalidate strategy
async function handleStaleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await caches.match(request);
    
    // Always try to update in the background
    const networkResponsePromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((error) => {
            console.error('Background update failed:', error);
        });
    
    // Return cached version immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // If no cache, wait for network
    try {
        return await networkResponsePromise;
    } catch (error) {
        console.error('Stale-while-revalidate failed:', error);
        
        // Return offline fallback for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/offline.html');
        }
        
        throw error;
    }
}

// Network-only strategy
async function handleNetworkOnly(request) {
    try {
        return await fetch(request);
    } catch (error) {
        console.error('Network-only request failed:', error);
        
        // For HTML requests, return offline page
        if (request.headers.get('accept')?.includes('text/html')) {
            const offlinePage = await caches.match('/offline.html');
            if (offlinePage) {
                return offlinePage;
            }
        }
        
        throw error;
    }
}

// Handle background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync triggered');
        event.waitUntil(doBackgroundSync());
    }
});

// Background sync implementation
async function doBackgroundSync() {
    try {
        // Check if there are any queued actions
        const queuedActions = await getQueuedActions();
        
        for (const action of queuedActions) {
            try {
                await processQueuedAction(action);
                await removeQueuedAction(action.id);
            } catch (error) {
                console.error('Failed to process queued action:', action, error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Queue management functions
async function getQueuedActions() {
    try {
        const cache = await caches.open('action-queue');
        const response = await cache.match('/action-queue');
        if (response) {
            return await response.json();
        }
    } catch (error) {
        console.error('Failed to get queued actions:', error);
    }
    return [];
}

async function processQueuedAction(action) {
    // Process different types of queued actions
    switch (action.type) {
        case 'save-settings':
            return await syncUserSettings(action.data);
        case 'save-workout':
            return await syncWorkoutLog(action.data);
        default:
            console.warn('Unknown action type:', action.type);
    }
}

async function removeQueuedAction(actionId) {
    try {
        const actions = await getQueuedActions();
        const filteredActions = actions.filter(action => action.id !== actionId);
        
        const cache = await caches.open('action-queue');
        await cache.put('/action-queue', new Response(JSON.stringify(filteredActions)));
    } catch (error) {
        console.error('Failed to remove queued action:', error);
    }
}

// Sync functions
async function syncUserSettings(settingsData) {
    const response = await fetch('/netlify/functions/user-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
    });
    
    if (!response.ok) {
        throw new Error('Failed to sync user settings');
    }
    
    return response.json();
}

async function syncWorkoutLog(workoutData) {
    const response = await fetch('/netlify/functions/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData)
    });
    
    if (!response.ok) {
        throw new Error('Failed to sync workout log');
    }
    
    return response.json();
}

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New workout reminder',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Open App',
                icon: '/icons/checkmark.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icons/xmark.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('EOS Fitness Tracker', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('Service Worker: Loaded and ready');