// EOS Fitness Tracker Application - Security-Hardened Version

// Global state management
let equipmentData = {};
let mySettings = {};
let workoutLogs = {};
let currentWorkout = [];
let currentView = 'equipment';
let selectedEquipment = null;
let filterState = {
    zone: 'all',
    muscle: 'all',
    search: ''
};

// Update filter state and sync to URL
function updateFilterState(newState) {
    const changed = Object.keys(newState).some(key => filterState[key] !== newState[key]);
    
    if (changed) {
        Object.assign(filterState, newState);
        urlStateManager.updateURL();
        updateFilterButtons();
        updateClearAllButton();
        updateFilterChips();
        displayEquipment();
    }
}

// Clear all filters and search
function clearAllFilters() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    updateFilterState({
        zone: 'all',
        muscle: 'all',
        search: ''
    });
    
    // Announce the action to screen readers
    announceToScreenReader('All filters cleared. Showing all equipment.');
}

// Update clear all button state
function updateClearAllButton() {
    const clearBtn = document.getElementById('clear-all-btn');
    if (clearBtn) {
        const hasActiveFilters = filterState.zone !== 'all' || 
                                filterState.muscle !== 'all' || 
                                filterState.search !== '';
        
        clearBtn.disabled = !hasActiveFilters;
        clearBtn.setAttribute('aria-label', hasActiveFilters ? 
            'Clear all active filters and search' : 
            'No active filters to clear');
    }
}

// Update filter chips display
function updateFilterChips() {
    const container = document.getElementById('filter-chips-container');
    const chipsDiv = document.getElementById('filter-chips');
    
    if (!container || !chipsDiv) return;
    
    // Clear existing chips
    chipsDiv.innerHTML = '';
    
    const activeFilters = [];
    
    // Add zone chip if not 'all'
    if (filterState.zone !== 'all') {
        activeFilters.push({
            type: 'zone',
            label: `Zone: ${filterState.zone}`,
            value: filterState.zone
        });
    }
    
    // Add muscle chip if not 'all'
    if (filterState.muscle !== 'all') {
        activeFilters.push({
            type: 'muscle',
            label: `Muscle: ${filterState.muscle.charAt(0).toUpperCase() + filterState.muscle.slice(1)}`,
            value: filterState.muscle
        });
    }
    
    // Add search chip if has text
    if (filterState.search) {
        activeFilters.push({
            type: 'search',
            label: `Search: "${filterState.search}"`,
            value: filterState.search
        });
    }
    
    // Show/hide container based on active filters
    if (activeFilters.length === 0) {
        container.classList.add('hidden');
        return;
    } else {
        container.classList.remove('hidden');
    }
    
    // Create chips
    activeFilters.forEach(filter => {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');
        
        const label = document.createElement('span');
        label.textContent = filter.label;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'filter-chip-remove';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', `Remove ${filter.label} filter`);
        removeBtn.setAttribute('title', `Remove ${filter.label} filter`);
        
        // Handle chip removal
        const removeFilter = () => {
            const searchInput = document.getElementById('search-input');
            
            if (filter.type === 'zone') {
                updateFilterState({ zone: 'all' });
            } else if (filter.type === 'muscle') {
                updateFilterState({ muscle: 'all' });
            } else if (filter.type === 'search') {
                if (searchInput) {
                    searchInput.value = '';
                }
                updateFilterState({ search: '' });
            }
        };
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFilter();
        });
        
        // Also allow Enter/Space on the chip itself
        chip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                removeFilter();
            }
        });
        
        chip.appendChild(label);
        chip.appendChild(removeBtn);
        chipsDiv.appendChild(chip);
    });
}

// Utility: Debounce function for search performance
function debounce(fn, wait = 150) {
    let t; 
    return (...args) => { 
        clearTimeout(t); 
        t = setTimeout(() => fn(...args), wait); 
    };
}

// Utility: Throttled announcements for screen readers
const announceToScreenReader = debounce((message) => {
    const announcements = document.getElementById('sr-announcements');
    if (announcements) {
        announcements.textContent = message;
    }
}, 300);

// Keyboard shortcuts manager
const keyboardManager = {
    // Check if we should handle keyboard shortcuts
    canHandleShortcuts() {
        // Don't handle shortcuts if:
        // - Any input has focus
        // - Any modal is open
        // - User is typing in contenteditable
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable
        );
        
        const isModalOpen = document.querySelector('.modal:not(.hidden), .modal-overlay:not(.hidden)');
        
        return !isInputFocused && !isModalOpen;
    },
    
    // Zone mapping for number keys
    zoneMap: {
        '1': 'A',
        '2': 'B', 
        '3': 'C',
        '4': 'D',
        '5': 'E',
        '6': 'F'
    },
    
    // Handle global keyboard shortcuts
    handleShortcut(event) {
        // Always handle Escape regardless of context
        if (event.key === 'Escape') {
            this.handleEscape(event);
            return;
        }
        
        // Only handle other shortcuts if context allows
        if (!this.canHandleShortcuts()) {
            return;
        }
        
        switch (event.key) {
            case '/':
                event.preventDefault();
                this.focusSearch();
                break;
                
            case '?':
                event.preventDefault();
                this.showKeyboardHelp();
                break;
                
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                event.preventDefault();
                this.selectZone(this.zoneMap[event.key]);
                break;
        }
    },
    
    // Handle Escape key context-aware behavior
    handleEscape(event) {
        const searchInput = document.getElementById('search-input');
        const activeElement = document.activeElement;
        
        // If search input is focused and has content, clear it
        if (activeElement === searchInput && searchInput.value) {
            event.preventDefault();
            searchInput.value = '';
            updateFilterState({ search: '' });
            announceToScreenReader('Search cleared');
            return;
        }
        
        // If any modal is open, close it
        const openModal = document.querySelector('.modal:not(.hidden), .modal-overlay:not(.hidden)');
        if (openModal) {
            event.preventDefault();
            closeModal();
            return;
        }
        
        // If search is focused but empty, blur it
        if (activeElement === searchInput) {
            event.preventDefault();
            searchInput.blur();
            return;
        }
    },
    
    // Focus search input
    focusSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select(); // Select existing text if any
            announceToScreenReader('Search focused');
        }
    },
    
    // Select a zone filter
    selectZone(zone) {
        if (currentView === 'equipment') {
            updateFilterState({ zone: zone });
            announceToScreenReader(`Zone ${zone} selected`);
        }
    },
    
    // Show keyboard help (placeholder for now)
    showKeyboardHelp() {
        announceToScreenReader('Keyboard shortcuts: Slash to search, 1-6 for zones A-F, Escape to clear or close');
        // We'll implement a proper help modal in the next task
    }
};

// Global keyboard event handler
function handleGlobalKeydown(event) {
    keyboardManager.handleShortcut(event);
}

// URL State Management
const urlStateManager = {
    // Update URL with current filter state
    updateURL: debounce(() => {
        const params = new URLSearchParams();
        
        if (filterState.zone !== 'all') {
            params.set('zone', filterState.zone);
        }
        if (filterState.muscle !== 'all') {
            params.set('muscle', filterState.muscle);
        }
        if (filterState.search) {
            params.set('search', filterState.search);
        }
        
        const url = new URL(window.location);
        url.search = params.toString();
        
        // Use pushState to update URL without page reload
        window.history.pushState({ filterState: { ...filterState } }, '', url);
        
        // Also persist to localStorage
        localStorage.setItem('eos-filter-state', JSON.stringify(filterState));
    }, 200),
    
    // Read filter state from URL parameters
    readFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        return {
            zone: params.get('zone') || 'all',
            muscle: params.get('muscle') || 'all',
            search: params.get('search') || ''
        };
    },
    
    // Read filter state from localStorage as fallback
    readFromStorage() {
        try {
            const stored = localStorage.getItem('eos-filter-state');
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    zone: parsed.zone || 'all',
                    muscle: parsed.muscle || 'all',
                    search: parsed.search || ''
                };
            }
        } catch (error) {
            console.warn('Error reading filter state from localStorage:', error);
        }
        return { zone: 'all', muscle: 'all', search: '' };
    },
    
    // Initialize filter state from URL or localStorage
    initializeState() {
        const urlState = this.readFromURL();
        const hasUrlParams = window.location.search.includes('zone') || 
                            window.location.search.includes('muscle') || 
                            window.location.search.includes('search');
        
        if (hasUrlParams) {
            return urlState;
        } else {
            return this.readFromStorage();
        }
    }
};

// Utility: Safe muscle data extraction
function safeMuscles(equipment) {
    return {
        primary: Array.isArray(equipment?.muscles?.primary) ? equipment.muscles.primary : [],
        secondary: Array.isArray(equipment?.muscles?.secondary) ? equipment.muscles.secondary : []
    };
}

// Utility: Escape HTML for text content (backup if not using DOM methods)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API Client Layer for Netlify Functions
const ApiClient = {
    // User identification and management
    userId: null,
    userToken: null,
    isOnline: navigator.onLine,
    isAuthenticated: false,
    
    // Initialize user authentication from localStorage
    initAuth() {
        this.userToken = localStorage.getItem('eos-auth-token');
        this.userId = localStorage.getItem('eos-user-id');
        
        if (this.userToken && this.isTokenValid()) {
            this.isAuthenticated = true;
            return true;
        } else {
            this.clearAuth();
            return false;
        }
    },

    // Check if current token is valid and not expired
    isTokenValid() {
        if (!this.userToken) return false;
        
        try {
            // JWT format: header.payload.signature - we need the payload (second segment)
            const segments = this.userToken.split('.');
            if (segments.length !== 3) {
                console.warn('Invalid JWT format: expected 3 segments');
                return false;
            }
            
            // Decode the payload (second segment) using base64url decoding
            const payloadBase64 = segments[1];
            const payload = JSON.parse(this.base64urlDecode(payloadBase64));
            
            // Check if token is expired (with 5 minute buffer for clock skew)
            const now = Date.now();
            const expirationBuffer = 5 * 60 * 1000; // 5 minutes
            
            if (payload.exp) {
                // JWT exp is in seconds, convert to milliseconds
                const expMs = payload.exp * 1000;
                if (now > (expMs - expirationBuffer)) {
                    console.warn('Authentication token expired');
                    return false;
                }
            }
            
            // Update userId from token if different (client-side hint only)
            if (payload.userId && payload.userId !== this.userId) {
                this.userId = payload.userId;
                localStorage.setItem('eos-user-id', this.userId);
            }
            
            return true;
        } catch (error) {
            console.error('Invalid token format:', error);
            return false;
        }
    },

    // Base64url decode (RFC 7515) - different from standard base64
    base64urlDecode(str) {
        // Add padding if needed
        let padded = str;
        const paddingNeeded = 4 - (str.length % 4);
        if (paddingNeeded !== 4) {
            padded += '='.repeat(paddingNeeded);
        }
        
        // Replace base64url characters with base64 equivalents
        const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
        
        return atob(base64);
    },

    // Store authentication data
    setAuth(userId, token) {
        this.userId = userId;
        this.userToken = token;
        this.isAuthenticated = true;
        
        localStorage.setItem('eos-user-id', userId);
        localStorage.setItem('eos-auth-token', token);
        localStorage.setItem('eos-auth-date', new Date().toISOString());
    },

    // Clear authentication data
    clearAuth() {
        this.userId = null;
        this.userToken = null;
        this.isAuthenticated = false;
        
        localStorage.removeItem('eos-auth-token');
        localStorage.removeItem('eos-user-id');
        localStorage.removeItem('eos-auth-date');
    },

    // Network status tracking
    updateNetworkStatus() {
        this.isOnline = navigator.onLine;
    },

    // Register new user and get authentication token
    async registerUser(userName) {
        try {
            const response = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'register',
                    userName: userName
                })
            });

            if (!response.ok) {
                throw new Error(`Registration failed: HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.user) {
                this.setAuth(data.user.userId, data.user.token);
                showNotification(`Welcome ${userName}! Account created successfully.`, 'success');
                return { success: true, user: data.user };
            } else {
                throw new Error(data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification(`Registration failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    },

    // Login existing user (generate new token)
    async loginUser(userId) {
        try {
            const response = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'login',
                    userId: userId
                })
            });

            if (!response.ok) {
                throw new Error(`Login failed: HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.user) {
                this.setAuth(data.user.userId, data.user.token);
                showNotification('Successfully logged in!', 'success');
                return { success: true, user: data.user };
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification(`Login failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    },

    // Generic API call with secure authentication, retry logic, and timeouts
    async makeRequest(endpoint, options = {}, retryCount = 0) {
        // Check authentication first
        if (!this.isAuthenticated && !this.initAuth()) {
            // For auth endpoint, allow unauthenticated requests
            if (!endpoint.includes('auth')) {
                throw new Error('Authentication required. Please log in or register.');
            }
        }
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        };

        // Add authentication header if we have a token
        if (this.userToken && this.isAuthenticated) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.userToken}`;
        }

        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        };

        try {
            const response = await fetch(`/.netlify/functions/${endpoint}`, requestOptions);
            clearTimeout(timeoutId);
            
            // Handle authentication errors
            if (response.status === 401) {
                console.warn('Authentication failed - token may be expired');
                this.clearAuth();
                
                // Show authentication prompt
                if (typeof showAuthenticationModal === 'function') {
                    showAuthenticationModal();
                }
                
                throw new Error('Authentication required. Please log in again.');
            }
            
            // Handle rate limiting with retry
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount) * 1000;
                
                if (retryCount < 3) {
                    console.warn(`Rate limited, retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return this.makeRequest(endpoint, options, retryCount + 1);
                } else {
                    throw new Error('Rate limit exceeded. Please try again later.');
                }
            }
            
            // Handle conflict errors (ETag mismatch)
            if (response.status === 409) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Conflict: Data was modified by another client. Please refresh and try again.');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Handle network errors with retry for GET requests
            if ((error.name === 'AbortError' || error.message.includes('fetch')) && 
                retryCount < 3 && 
                (!options.method || options.method === 'GET')) {
                
                const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
                console.warn(`Network error, retrying in ${waitTime}ms...`, error.message);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.makeRequest(endpoint, options, retryCount + 1);
            }
            
            console.error(`API Error (${endpoint}):`, error);
            
            // Return error object for handling by caller
            return {
                error: true,
                message: error.message,
                offline: !this.isOnline,
                retryable: retryCount < 3 && (!options.method || options.method === 'GET')
            };
        }
    },

    // Settings API methods
    async getSettings() {
        return await this.makeRequest('user-settings', { method: 'GET' });
    },

    async saveSettings(settings) {
        return await this.makeRequest('user-settings', {
            method: 'POST',
            body: JSON.stringify({ settings })
        });
    },

    // Workout logs API methods
    async getWorkoutLogs() {
        return await this.makeRequest('workout-logs', { method: 'GET' });
    },

    async saveWorkoutLogs(logs) {
        return await this.makeRequest('workout-logs', {
            method: 'POST',
            body: JSON.stringify({ logs })
        });
    },

    async addWorkout(workout) {
        return await this.makeRequest('workout-logs', {
            method: 'POST',
            body: JSON.stringify({ workout })
        });
    },

    async updateWorkout(workoutId, workout) {
        return await this.makeRequest('workout-logs', {
            method: 'PUT',
            body: JSON.stringify({ workoutId, workout })
        });
    },

    async deleteWorkout(workoutId) {
        return await this.makeRequest('workout-logs', {
            method: 'DELETE',
            body: JSON.stringify({ workoutId })
        });
    },

    // Export functionality
    async exportData(asDownload = false) {
        const endpoint = asDownload ? 
            'export-data?download=true' : 
            'export-data';
        return await this.makeRequest(endpoint, { method: 'GET' });
    },

    // Migration functionality
    async migrateData(localSettings, localWorkoutLogs) {
        return await this.makeRequest('migrate-data', {
            method: 'POST',
            body: JSON.stringify({
                localSettings,
                localWorkoutLogs,
                requestedUserId: this.userId
            })
        });
    },

    // Check if migration is needed
    shouldMigrate() {
        const migrationComplete = localStorage.getItem('eos-migration-complete');
        const hasLocalSettings = localStorage.getItem('eosFitnessSettings');
        const hasLocalLogs = localStorage.getItem('eosFitnessLogs');
        
        return !migrationComplete && (hasLocalSettings || hasLocalLogs);
    },

    // Mark migration as complete
    markMigrationComplete() {
        localStorage.setItem('eos-migration-complete', 'true');
        localStorage.setItem('eos-migration-date', new Date().toISOString());
    }
};

// Authentication UI Management
function showAuthenticationModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.remove('hidden');
    document.getElementById('auth-register').classList.remove('hidden');
    document.getElementById('auth-login').classList.add('hidden');
    document.getElementById('auth-loading').classList.add('hidden');
    
    // Set up focus trap and keyboard support
    FocusTrap.trapFocus(modal);
    announceToScreenReader('Authentication dialog opened');
}

function hideAuthenticationModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.add('hidden');
    
    // Release focus trap
    FocusTrap.releaseFocus();
    announceToScreenReader('Authentication dialog closed');
}

function switchToLogin() {
    document.getElementById('auth-register').classList.add('hidden');
    document.getElementById('auth-login').classList.remove('hidden');
    document.getElementById('auth-title').textContent = 'Login to Your Account';
}

function switchToRegister() {
    document.getElementById('auth-register').classList.remove('hidden');
    document.getElementById('auth-login').classList.add('hidden');
    document.getElementById('auth-title').textContent = 'Welcome to EOS Fitness Tracker';
}

function showAuthLoading() {
    document.getElementById('auth-register').classList.add('hidden');
    document.getElementById('auth-login').classList.add('hidden');
    document.getElementById('auth-loading').classList.remove('hidden');
}

// Migration UI Management
function showMigrationModal() {
    const modal = document.getElementById('migration-modal');
    modal.classList.remove('hidden');
    document.getElementById('migration-intro').classList.remove('hidden');
    document.getElementById('migration-progress').classList.add('hidden');
    document.getElementById('migration-complete').classList.add('hidden');
    
    // Set up focus trap and keyboard support
    FocusTrap.trapFocus(modal);
    announceToScreenReader('Data migration dialog opened');
}

function hideMigrationModal() {
    const modal = document.getElementById('migration-modal');
    modal.classList.add('hidden');
    
    // Release focus trap
    FocusTrap.releaseFocus();
    announceToScreenReader('Data migration dialog closed');
}

function showMigrationProgress() {
    document.getElementById('migration-intro').classList.add('hidden');
    document.getElementById('migration-progress').classList.remove('hidden');
}

function showMigrationComplete(summary) {
    document.getElementById('migration-progress').classList.add('hidden');
    document.getElementById('migration-complete').classList.remove('hidden');
    
    const summaryEl = document.getElementById('migration-summary');
    
    // Clear existing content safely
    while (summaryEl.firstChild) {
        summaryEl.removeChild(summaryEl.firstChild);
    }
    
    // Create settings summary item
    const settingsItem = document.createElement('div');
    settingsItem.className = 'summary-item';
    
    const settingsStrong = document.createElement('strong');
    settingsStrong.textContent = 'Settings:';
    settingsItem.appendChild(settingsStrong);
    
    const settingsStatus = document.createTextNode(` ${summary.settingsMigrated ? 'Migrated' : 'Skipped'}`);
    settingsItem.appendChild(settingsStatus);
    
    if (summary.equipmentCount) {
        const settingsCount = document.createTextNode(` (${summary.equipmentCount} equipment settings)`);
        settingsItem.appendChild(settingsCount);
    }
    
    // Create workout logs summary item
    const workoutItem = document.createElement('div');
    workoutItem.className = 'summary-item';
    
    const workoutStrong = document.createElement('strong');
    workoutStrong.textContent = 'Workout Logs:';
    workoutItem.appendChild(workoutStrong);
    
    const workoutStatus = document.createTextNode(` ${summary.workoutLogsMigrated ? 'Migrated' : 'Skipped'}`);
    workoutItem.appendChild(workoutStatus);
    
    if (summary.totalWorkouts) {
        const workoutCount = document.createTextNode(` (${summary.totalWorkouts} workouts)`);
        workoutItem.appendChild(workoutCount);
    }
    
    // Append both items to summary element
    summaryEl.appendChild(settingsItem);
    summaryEl.appendChild(workoutItem);
}

// Update user status in header
function updateUserStatus() {
    const userNameEl = document.getElementById('user-name');
    const authBtnEl = document.getElementById('auth-btn');
    const syncStatusEl = document.getElementById('sync-status');
    const syncIndicator = syncStatusEl.querySelector('.sync-indicator');
    const syncText = syncStatusEl.querySelector('.sync-text');
    
    if (ApiClient.isAuthenticated) {
        // Show user name if we have settings
        if (mySettings.user?.name) {
            userNameEl.textContent = mySettings.user.name;
            userNameEl.classList.remove('hidden');
        }
        
        // Update auth button to logout
        authBtnEl.textContent = 'Logout';
        authBtnEl.dataset.action = 'logout';
        
        // Update sync status
        if (ApiClient.isOnline) {
            syncIndicator.className = 'sync-indicator online';
            syncText.textContent = 'Synced';
        } else {
            syncIndicator.className = 'sync-indicator offline';
            syncText.textContent = 'Offline';
        }
    } else {
        // Hide user name
        userNameEl.classList.add('hidden');
        
        // Update auth button to login
        authBtnEl.textContent = 'Login';
        authBtnEl.dataset.action = 'show-auth-modal';
        
        // Update sync status to offline
        syncIndicator.className = 'sync-indicator offline';
        syncText.textContent = 'Not logged in';
    }
}

// Authentication form handlers
async function handleRegistration(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const userName = formData.get('userName');
    
    if (!userName || userName.trim().length < 2) {
        showNotification('Please enter a valid name (at least 2 characters)', 'error');
        return;
    }
    
    showAuthLoading();
    
    const result = await ApiClient.registerUser(userName.trim());
    
    if (result.success) {
        hideAuthenticationModal();
        updateUserStatus();
        await loadAllData(); // Reload data with authentication
    } else {
        // Show error and return to registration form
        switchToRegister();
        showNotification(`Registration failed: ${result.error}`, 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const userId = formData.get('userId');
    
    if (!userId || !userId.startsWith('user-')) {
        showNotification('Please enter a valid User ID', 'error');
        return;
    }
    
    showAuthLoading();
    
    const result = await ApiClient.loginUser(userId.trim());
    
    if (result.success) {
        hideAuthenticationModal();
        updateUserStatus();
        await loadAllData(); // Reload data with authentication
    } else {
        // Show error and return to login form
        switchToLogin();
        showNotification(`Login failed: ${result.error}`, 'error');
    }
}

// Migration handlers
async function startMigration() {
    showMigrationProgress();
    
    const statusEl = document.getElementById('migration-status');
    const progressEl = document.getElementById('migration-progress-fill');
    
    try {
        // Get local data
        statusEl.textContent = 'Reading local data...';
        progressEl.style.width = '25%';
        
        const localSettings = JSON.parse(localStorage.getItem('eosFitnessSettings') || 'null');
        const localWorkoutLogs = JSON.parse(localStorage.getItem('eosFitnessLogs') || 'null');
        
        // Migrate data
        statusEl.textContent = 'Uploading to cloud...';
        progressEl.style.width = '50%';
        
        const result = await ApiClient.migrateData(localSettings, localWorkoutLogs);
        
        if (result.error) {
            throw new Error(result.message);
        }
        
        statusEl.textContent = 'Finalizing migration...';
        progressEl.style.width = '75%';
        
        // Mark migration as complete
        ApiClient.markMigrationComplete();
        
        statusEl.textContent = 'Migration complete!';
        progressEl.style.width = '100%';
        
        // Show success
        setTimeout(() => {
            showMigrationComplete(result.migration || {});
        }, 1000);
        
    } catch (error) {
        console.error('Migration failed:', error);
        statusEl.textContent = `Migration failed: ${error.message}`;
        showNotification(`Migration failed: ${error.message}`, 'error');
        
        setTimeout(() => {
            hideMigrationModal();
        }, 3000);
    }
}

function skipMigration() {
    ApiClient.markMigrationComplete();
    hideMigrationModal();
    showNotification('Migration skipped. You can export your data anytime from Settings.', 'info');
}

function continueToApp() {
    hideMigrationModal();
    updateUserStatus();
    loadAllData(); // Reload with fresh cloud data
}

// Focus trap management for modals
const FocusTrap = {
    activeModal: null,
    previousFocus: null,
    
    // Get all focusable elements within a container
    getFocusableElements(container) {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'textarea:not([disabled])',
            'select:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])'
        ];
        
        return container.querySelectorAll(focusableSelectors.join(', '));
    },
    
    // Set up focus trap for a modal
    trapFocus(modal) {
        this.activeModal = modal;
        this.previousFocus = document.activeElement;
        
        const focusableElements = this.getFocusableElements(modal);
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
        
        // Add event listener for tab trapping
        modal.addEventListener('keydown', this.handleTabTrap.bind(this));
    },
    
    // Handle tab key to trap focus within modal
    handleTabTrap(event) {
        if (event.key !== 'Tab') return;
        
        const focusableElements = this.getFocusableElements(this.activeModal);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    },
    
    // Release focus trap and restore previous focus
    releaseFocus() {
        if (this.activeModal) {
            this.activeModal.removeEventListener('keydown', this.handleTabTrap.bind(this));
            this.activeModal = null;
        }
        
        if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
            this.previousFocus.focus();
        }
        this.previousFocus = null;
    }
};

// Global click handler for data-action buttons (replaces inline onclick handlers)
function handleGlobalClick(event) {
    const action = event.target.dataset.action;
    if (!action) return;
    
    event.preventDefault();
    
    switch (action) {
        case 'close-auth-modal':
            hideAuthenticationModal();
            break;
        case 'close-migration-modal':
            hideMigrationModal();
            break;
        case 'switch-to-login':
            switchToLogin();
            break;
        case 'switch-to-register':
            switchToRegister();
            break;
        case 'export-data':
            exportData();
            break;
        case 'show-settings':
            showView('settings');
            break;
        case 'show-about':
            showAboutDialog();
            break;
        case 'show-auth-modal':
            showAuthenticationModal();
            break;
        case 'logout':
            ApiClient.clearAuth();
            showNotification('Logged out successfully', 'info');
            updateUserStatus();
            showAuthenticationModal();
            break;
        default:
            console.warn('Unknown action:', action);
    }
}

// Global keyboard event handler
function handleGlobalKeydown(event) {
    // Handle Esc key to close modals
    if (event.key === 'Escape') {
        // Check which modal is open and close it
        const authModal = document.getElementById('auth-modal');
        const migrationModal = document.getElementById('migration-modal');
        
        if (authModal && !authModal.classList.contains('hidden')) {
            event.preventDefault();
            hideAuthenticationModal();
        } else if (migrationModal && !migrationModal.classList.contains('hidden')) {
            event.preventDefault();
            hideMigrationModal();
        }
        
        // Close any custom modals (like about dialog)
        const customModals = document.querySelectorAll('.modal[style*="block"]');
        customModals.forEach(modal => {
            modal.remove();
        });
    }
}

// Screen reader announcements
function announceToScreenReader(message) {
    const announcer = document.getElementById('sr-announcements');
    if (announcer) {
        announcer.textContent = message;
        // Clear after announcement to avoid repetition
        setTimeout(() => {
            announcer.textContent = '';
        }, 1000);
    }
}

// Show About dialog (replaces alert)
function showAboutDialog() {
    const aboutText = 'EOS Fitness Tracker\nVersion 2.0\nFor tracking equipment settings at EOS Fitness Lutz, FL';
    
    // Create a proper modal instead of using alert()
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const title = document.createElement('h2');
    title.textContent = 'About EOS Fitness Tracker';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    aboutText.split('\n').forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        body.appendChild(p);
    });
    
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Listen for online/offline events
window.addEventListener('online', () => {
    ApiClient.updateNetworkStatus();
    updateUserStatus();
    showNotification('Back online - data will sync', 'success');
});

window.addEventListener('offline', () => {
    ApiClient.updateNetworkStatus();
    updateUserStatus();
    showNotification('Offline mode - changes saved locally', 'warning');
});

// Utility: Batched localStorage saves (kept for offline fallback)
let pendingSave = null;
function saveSettingsToLocalBatched() {
    if (pendingSave) return;
    pendingSave = requestIdleCallback?.(flush, { timeout: 1000 }) || setTimeout(flush, 250);
    function flush() {
        try {
            localStorage.setItem('eosFitnessSettings', JSON.stringify(mySettings));
            pendingSave = null;
        } catch (error) {
            console.error('Failed to save settings:', error);
            showNotification('Failed to save settings', 'error');
        }
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing EOS Fitness Tracker (Secure Version)...');
    
    // Initialize authentication
    const isAuthenticated = ApiClient.initAuth();
    console.log('Authentication status:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
    
    // Set up authentication form listeners
    document.getElementById('register-form').addEventListener('submit', handleRegistration);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Set up migration form listeners
    document.getElementById('start-migration').addEventListener('click', startMigration);
    document.getElementById('skip-migration').addEventListener('click', skipMigration);
    document.getElementById('continue-to-app').addEventListener('click', continueToApp);
    
    // Set up modal and navigation event listeners using event delegation
    document.addEventListener('click', handleGlobalClick);
    
    // Add global keyboard event handling
    document.addEventListener('keydown', handleGlobalKeydown);
    
    // Load equipment database first (doesn't require auth)
    await loadEquipmentDatabase();
    
    // Check authentication and migration status
    if (!isAuthenticated) {
        // Check if user needs migration
        if (ApiClient.shouldMigrate()) {
            console.log('Migration needed - showing migration modal');
            showMigrationModal();
        } else {
            console.log('New user - showing authentication modal');
            showAuthenticationModal();
        }
        
        // Load default/offline data
        loadMySettingsOffline();
        loadWorkoutLogsOffline();
    } else {
        console.log('User authenticated - loading cloud data');
        // Load cloud data
        await loadMySettings();
        await loadWorkoutLogs();
    }
    
    // Update UI regardless of auth status
    updateUserStatus();
    setupEventListeners();
    displayEquipment();
    updateUI();
});

// Data Loading Functions
async function loadAllData() {
    await Promise.all([
        loadEquipmentDatabase(),
        loadMySettings(),
        loadWorkoutLogs()
    ]);
}

async function loadEquipmentDatabase() {
    try {
        const response = await fetch('database/equipment-database.json');
        if (response.ok) {
            const data = await response.json();
            // Validate equipment data structure
            if (validateEquipmentDatabase(data)) {
                equipmentData = data;
                console.log(`Loaded ${equipmentData.equipment.length} equipment items`);
            } else {
                throw new Error('Invalid equipment database structure');
            }
        } else {
            throw new Error('Equipment database not found');
        }
    } catch (error) {
        console.error('Error loading equipment database:', error);
        equipmentData = getDefaultEquipmentData();
        showNotification('Using default equipment data', 'warning');
    }
}

async function loadMySettings() {
    try {
        // Check if migration is needed first
        if (ApiClient.shouldMigrate()) {
            await performDataMigration();
        }

        // Load settings from API
        const response = await ApiClient.getSettings();
        
        if (response.error) {
            console.warn('API Error loading settings:', response.message);
            
            // Fallback to localStorage if API fails
            const localSettings = localStorage.getItem('eosFitnessSettings');
            if (localSettings) {
                const parsed = JSON.parse(localSettings);
                if (validateSettings(parsed)) {
                    mySettings = parsed;
                    showNotification('Using offline data - will sync when online', 'warning');
                    return;
                }
            }
            
            // Final fallback to default settings
            mySettings = getDefaultSettings();
            showNotification('Using default settings', 'info');
        } else {
            // Successfully loaded from API
            mySettings = response.settings;
            
            // Cache locally for offline use
            saveSettingsToLocalBatched();
            
            if (response.isNewUser) {
                showNotification('Welcome! Your settings will sync across devices.', 'success');
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        
        // Fallback to localStorage or defaults
        const localSettings = localStorage.getItem('eosFitnessSettings');
        if (localSettings) {
            try {
                const parsed = JSON.parse(localSettings);
                if (validateSettings(parsed)) {
                    mySettings = parsed;
                    showNotification('Offline mode - using local data', 'warning');
                    return;
                }
            } catch (parseError) {
                console.error('Error parsing local settings:', parseError);
            }
        }
        
        mySettings = getDefaultSettings();
        showNotification('Using default settings', 'info');
    }
}

async function loadWorkoutLogs() {
    try {
        // Load workout logs from API
        const response = await ApiClient.getWorkoutLogs();
        
        if (response.error) {
            console.warn('API Error loading workout logs:', response.message);
            
            // Fallback to localStorage if API fails
            const localLogs = localStorage.getItem('eosFitnessLogs');
            if (localLogs) {
                const parsed = JSON.parse(localLogs);
                if (validateWorkoutLogs(parsed)) {
                    workoutLogs = parsed;
                    return;
                }
            }
            
            // Final fallback to default logs
            workoutLogs = getDefaultWorkoutLogs();
        } else {
            // Successfully loaded from API
            workoutLogs = response.logs;
            
            // Cache locally for offline use
            try {
                localStorage.setItem('eosFitnessLogs', JSON.stringify(workoutLogs));
            } catch (error) {
                console.warn('Unable to cache workout logs locally:', error);
            }
        }
    } catch (error) {
        console.error('Error loading workout logs:', error);
        
        // Fallback to localStorage or defaults
        const localLogs = localStorage.getItem('eosFitnessLogs');
        if (localLogs) {
            try {
                const parsed = JSON.parse(localLogs);
                if (validateWorkoutLogs(parsed)) {
                    workoutLogs = parsed;
                    return;
                }
            } catch (parseError) {
                console.error('Error parsing local workout logs:', parseError);
            }
        }
        
        workoutLogs = getDefaultWorkoutLogs();
    }
}

// Offline Data Loading Functions (for non-authenticated users)
function loadMySettingsOffline() {
    try {
        const localSettings = localStorage.getItem('eosFitnessSettings');
        if (localSettings) {
            const parsed = JSON.parse(localSettings);
            if (validateSettings(parsed)) {
                mySettings = parsed;
                return;
            }
        }
    } catch (error) {
        console.error('Error loading offline settings:', error);
    }
    
    // Fallback to default settings
    mySettings = getDefaultSettings();
}

function loadWorkoutLogsOffline() {
    try {
        const localLogs = localStorage.getItem('eosFitnessLogs');
        if (localLogs) {
            const parsed = JSON.parse(localLogs);
            if (validateWorkoutLogs(parsed)) {
                workoutLogs = parsed;
                return;
            }
        }
    } catch (error) {
        console.error('Error loading offline workout logs:', error);
    }
    
    // Fallback to default logs
    workoutLogs = getDefaultWorkoutLogs();
}

// Data Migration Function
async function performDataMigration() {
    try {
        const localSettings = localStorage.getItem('eosFitnessSettings');
        const localLogs = localStorage.getItem('eosFitnessLogs');
        
        if (!localSettings && !localLogs) {
            // No data to migrate
            ApiClient.markMigrationComplete();
            return;
        }

        showNotification('Migrating your data to cloud storage...', 'info');

        let parsedSettings = null;
        let parsedLogs = null;

        // Parse and validate local data
        if (localSettings) {
            try {
                parsedSettings = JSON.parse(localSettings);
                if (!validateSettings(parsedSettings)) {
                    parsedSettings = null;
                    console.warn('Local settings invalid, skipping migration');
                }
            } catch (error) {
                console.error('Error parsing local settings for migration:', error);
            }
        }

        if (localLogs) {
            try {
                parsedLogs = JSON.parse(localLogs);
                if (!validateWorkoutLogs(parsedLogs)) {
                    parsedLogs = null;
                    console.warn('Local logs invalid, skipping migration');
                }
            } catch (error) {
                console.error('Error parsing local logs for migration:', error);
            }
        }

        // Perform migration
        const response = await ApiClient.migrateData(parsedSettings, parsedLogs);

        if (response.error) {
            console.error('Migration failed:', response.message);
            showNotification('Migration failed - using local data', 'error');
            return false;
        }

        // Migration successful
        ApiClient.markMigrationComplete();
        
        const settingsCount = response.migration.settings.equipmentCount || 0;
        const workoutsCount = response.migration.workoutLogs.totalWorkouts || 0;
        
        showNotification(
            `Migration complete! ${settingsCount} equipment settings and ${workoutsCount} workouts synced.`,
            'success'
        );

        console.log('Migration summary:', response.migration);
        return true;

    } catch (error) {
        console.error('Error during migration:', error);
        showNotification('Migration error - continuing with local data', 'error');
        return false;
    }
}

// Enhanced Validation Functions with Security Focus
function validateEquipmentDatabase(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.metadata || !Array.isArray(data.equipment)) return false;
    
    // Size limit check - max 100 equipment items
    if (data.equipment.length > 100) {
        console.warn('Equipment database too large:', data.equipment.length);
        return false;
    }
    
    // Validate each equipment item with strict schema
    return data.equipment.every(item => {
        if (!item || typeof item !== 'object') return false;
        
        // Remove dangerous properties
        delete item.__proto__;
        delete item.constructor;
        delete item.prototype;
        
        return item.id && 
               typeof item.id === 'string' &&
               item.id.length <= 50 && // Max length
               item.name && 
               typeof item.name === 'string' &&
               item.name.length <= 100 &&
               item.zone && 
               typeof item.zone === 'string' &&
               item.zone.length === 1 && // Single character zone
               item.muscles && 
               Array.isArray(item.muscles.primary) &&
               item.muscles.primary.length <= 10; // Max muscle groups
    });
}

function validateSettings(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Size limit check - max 10MB JSON string
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 10 * 1024 * 1024) {
        console.warn('Settings data too large:', jsonString.length);
        return false;
    }
    
    // Remove dangerous keys recursively
    const cleanData = structuredClone ? structuredClone(data) : JSON.parse(JSON.stringify(data));
    removeDangerousKeys(cleanData);
    
    // Validate structure
    if (cleanData.user && typeof cleanData.user !== 'object') return false;
    if (cleanData.equipment_settings && typeof cleanData.equipment_settings !== 'object') return false;
    if (cleanData.preferences && typeof cleanData.preferences !== 'object') return false;
    
    // Validate user data if present
    if (cleanData.user) {
        if (cleanData.user.name && (typeof cleanData.user.name !== 'string' || cleanData.user.name.length > 100)) {
            return false;
        }
        if (cleanData.user.experience_level && !['beginner', 'intermediate', 'advanced'].includes(cleanData.user.experience_level)) {
            return false;
        }
    }
    
    // Update original data with cleaned version
    Object.assign(data, cleanData);
    return true;
}

function validateWorkoutLogs(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.workouts)) return false;
    
    // Size limit check - max 1000 workouts
    if (data.workouts.length > 1000) {
        console.warn('Too many workouts:', data.workouts.length);
        return false;
    }
    
    // Clean data with structured clone if available
    const cleanData = structuredClone ? structuredClone(data) : JSON.parse(JSON.stringify(data));
    removeDangerousKeys(cleanData);
    
    // Validate each workout
    if (!cleanData.workouts.every(workout => {
        if (!workout || typeof workout !== 'object') return false;
        if (workout.id && (typeof workout.id !== 'string' || workout.id.length > 50)) return false;
        if (workout.exercises && !Array.isArray(workout.exercises)) return false;
        if (workout.exercises && workout.exercises.length > 50) return false; // Max exercises per workout
        return true;
    })) {
        return false;
    }
    
    // Update original data with cleaned version
    Object.assign(data, cleanData);
    return true;
}

// Helper function to recursively remove dangerous keys
function removeDangerousKeys(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key of ['__proto__', 'constructor', 'prototype']) {
        delete obj[key];
    }
    
    for (const value of Object.values(obj)) {
        if (typeof value === 'object' && value !== null) {
            removeDangerousKeys(value);
        }
    }
}

// Default Data Structures
function getDefaultEquipmentData() {
    return {
        metadata: {
            gym: "EOS Fitness Lutz",
            last_updated: new Date().toISOString(),
            version: "2.0",
            zones: {
                "A": "EGYM Smart Strength Area",
                "B": "Hammer Strength Plate-Loaded Area",
                "C": "Nautilus Selectorized Area",
                "D": "Free Weight Area",
                "E": "Cardio Deck",
                "F": "Functional Training Area"
            }
        },
        equipment: []
    };
}

function getDefaultSettings() {
    return {
        user: {
            name: "User",
            experience_level: "beginner",
            goals: [],
            typical_duration: 60
        },
        equipment_settings: {},
        preferences: {
            avoid: [],
            prefer: [],
            warm_up_time: 10,
            rest_between_sets: 90
        },
        quick_substitutes: {},
        last_updated: new Date().toISOString()
    };
}

function getDefaultWorkoutLogs() {
    return {
        workouts: [],
        stats: {
            total_workouts: 0,
            total_time_minutes: 0,
            favorite_equipment: [],
            average_workout_duration: 0
        },
        templates: [],
        last_updated: new Date().toISOString()
    };
}

// UI Setup and Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('[data-view]').forEach(button => {
        button.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            showView(view);
        });
    });
    
    // Initialize filter state from URL or localStorage
    const initialState = urlStateManager.initializeState();
    updateFilterState(initialState);
    
    // Apply initial state to search input
    const searchInput = document.getElementById('search-input');
    if (searchInput && initialState.search) {
        searchInput.value = initialState.search;
    }
    
    // Search with debouncing
    if (searchInput) {
        const debouncedSearch = debounce(() => {
            updateFilterState({ search: searchInput.value.toLowerCase() });
        }, 150);
        searchInput.addEventListener('input', debouncedSearch);
    }
    
    // Zone filters
    document.querySelectorAll('.zone-filter').forEach(button => {
        button.addEventListener('click', (e) => {
            updateFilterState({ zone: e.target.dataset.zone });
        });
    });
    
    // Muscle filters
    document.querySelectorAll('.muscle-filter').forEach(button => {
        button.addEventListener('click', (e) => {
            updateFilterState({ muscle: e.target.dataset.muscle });
        });
    });
    
    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.filterState) {
            // Restore state from history
            const restoredState = event.state.filterState;
            Object.assign(filterState, restoredState);
            
            // Update search input
            if (searchInput) {
                searchInput.value = restoredState.search || '';
            }
            
            updateFilterButtons();
            displayEquipment();
        } else {
            // No state in history, read from URL
            const urlState = urlStateManager.readFromURL();
            updateFilterState(urlState);
            
            if (searchInput) {
                searchInput.value = urlState.search || '';
            }
        }
    });
    
    // Clear all button
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllFilters);
        // Initialize button state
        updateClearAllButton();
    }
    
    // Initialize filter chips display
    updateFilterChips();
    
    // Modal close
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', closeModal);
    });
    
    // Export/Import
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    const importBtn = document.getElementById('import-data');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
    }
    
    const importFile = document.getElementById('import-file');
    if (importFile) {
        importFile.addEventListener('change', importData);
    }
}

// View Management
function showView(viewName) {
    currentView = viewName;
    
    // Hide all views using CSS classes
    document.querySelectorAll('.view').forEach(v => {
        v.classList.add('hidden');
    });
    
    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }
    
    // Update navigation with proper ARIA attributes
    document.querySelectorAll('[data-view]').forEach(button => {
        const isActive = button.dataset.view === viewName;
        button.classList.toggle('active', isActive);
        
        // Update aria-current for accessibility
        if (isActive) {
            button.setAttribute('aria-current', 'page');
        } else {
            button.removeAttribute('aria-current');
        }
    });
    
    // Load view-specific content
    switch(viewName) {
        case 'equipment':
            displayEquipment();
            break;
        case 'settings':
            displaySettings();
            break;
        case 'workout':
            displayWorkoutBuilder();
            break;
        case 'history':
            displayHistory();
            break;
        case 'substitutes':
            displaySubstitutes();
            break;
    }
}

// Equipment Display Functions
function displayEquipment() {
    const container = document.getElementById('equipment-list');
    if (!container || !equipmentData.equipment) return;
    
    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // Filter equipment
    let filtered = equipmentData.equipment;
    
    if (filterState.zone !== 'all') {
        filtered = filtered.filter(e => e.zone === filterState.zone);
    }
    
    if (filterState.muscle !== 'all') {
        filtered = filtered.filter(e => {
            const muscles = safeMuscles(e);
            return muscles.primary.includes(filterState.muscle) ||
                   muscles.secondary.includes(filterState.muscle);
        });
    }
    
    if (filterState.search) {
        filtered = filtered.filter(e => {
            const muscles = safeMuscles(e);
            return (e.name?.toLowerCase() || '').includes(filterState.search) ||
                   (e.id?.toLowerCase() || '').includes(filterState.search) ||
                   muscles.primary.some(m => m.includes(filterState.search)) ||
                   muscles.secondary.some(m => m.includes(filterState.search));
        });
    }
    
    // Display filtered equipment
    if (filtered.length === 0) {
        const noResults = document.createElement('p');
        noResults.className = 'no-results';
        noResults.textContent = 'No equipment found matching your filters';
        container.appendChild(noResults);
        return;
    }
    
    filtered.forEach(equipment => {
        const card = createEquipmentCardSafe(equipment);
        container.appendChild(card);
    });
    
    const statusMessage = `Showing ${filtered.length} of ${equipmentData.equipment.length} machines`;
    updateStatusBar(statusMessage);
    announceToScreenReader(statusMessage);
}

// Safe DOM-based equipment card creation
function createEquipmentCardSafe(equipment) {
    const card = document.createElement('div');
    card.className = 'equipment-card';
    card.dataset.zone = equipment.zone ?? '';

    // Header section
    const header = document.createElement('div');
    header.className = 'equipment-header';
    header.style.cursor = 'pointer';
    header.setAttribute('tabindex', '0');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-label', `View details for ${equipment.name ?? 'Unknown Equipment'}`);

    const h3 = document.createElement('h3');
    h3.textContent = equipment.name ?? 'Unknown Equipment';

    const badge = document.createElement('span');
    badge.className = `zone-badge zone-${equipment.zone ?? ''}`;
    badge.textContent = `Zone ${equipment.zone ?? '?'}`;

    header.appendChild(h3);
    header.appendChild(badge);
    
    // Make header clickable for details
    header.addEventListener('click', () => showEquipmentDetail(equipment.id));
    header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showEquipmentDetail(equipment.id);
        }
    });

    // Body section
    const body = document.createElement('div');
    body.className = 'equipment-body';

    const type = document.createElement('p');
    type.className = 'equipment-type';
    type.textContent = formatEquipmentType(equipment.type ?? '');

    const muscleGroups = document.createElement('div');
    muscleGroups.className = 'muscle-groups';
    
    const muscles = safeMuscles(equipment);
    const primary = document.createElement('span');
    primary.className = 'primary';
    primary.textContent = `Primary: ${muscles.primary.join(', ')}`;
    muscleGroups.appendChild(primary);
    
    if (muscles.secondary.length > 0) {
        const secondary = document.createElement('span');
        secondary.className = 'secondary';
        secondary.textContent = `Secondary: ${muscles.secondary.join(', ')}`;
        muscleGroups.appendChild(secondary);
    }

    body.appendChild(type);
    body.appendChild(muscleGroups);

    // User settings preview if exists
    const userSettings = mySettings.equipment_settings?.[equipment.id] || {};
    if (Object.keys(userSettings).length > 0) {
        const settingsPreview = document.createElement('div');
        settingsPreview.className = 'user-settings-preview';
        
        if (userSettings.last_weight) {
            const weight = document.createElement('span');
            weight.className = 'weight';
            weight.textContent = `💪 ${userSettings.last_weight}`;
            settingsPreview.appendChild(weight);
        }
        
        if (userSettings.last_used) {
            const lastUsed = document.createElement('span');
            lastUsed.className = 'last-used';
            lastUsed.textContent = `📅 ${formatDate(userSettings.last_used)}`;
            settingsPreview.appendChild(lastUsed);
        }
        
        body.appendChild(settingsPreview);
    }

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'equipment-actions';

    const btnDetail = document.createElement('button');
    btnDetail.className = 'btn-detail';
    btnDetail.textContent = 'Details';
    btnDetail.addEventListener('click', (e) => {
        e.stopPropagation();
        showEquipmentDetail(equipment.id);
    });

    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn-add';
    btnAdd.textContent = 'Add to workout';
    btnAdd.addEventListener('click', (e) => {
        e.stopPropagation();
        addToWorkout(equipment.id);
    });

    const btnSub = document.createElement('button');
    btnSub.className = 'btn-substitute';
    btnSub.textContent = 'Substitutes';
    btnSub.addEventListener('click', (e) => {
        e.stopPropagation();
        findSubstitutes(equipment.id);
    });

    actions.appendChild(btnDetail);
    actions.appendChild(btnAdd);
    actions.appendChild(btnSub);

    // Assemble card
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);

    return card;
}

// Safe Equipment Detail Modal
function showEquipmentDetail(equipmentId) {
    const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
    if (!equipment) return;
    
    selectedEquipment = equipment;
    const userSettings = mySettings.equipment_settings?.[equipmentId] || {};
    
    const modal = document.getElementById('equipment-modal');
    if (!modal) return;
    
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    
    // Clear content safely
    while (content.firstChild) {
        content.removeChild(content.firstChild);
    }
    
    // Build modal content with DOM methods
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const h2 = document.createElement('h2');
    h2.textContent = equipment.name ?? 'Unknown Equipment';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeModal);
    
    modalHeader.appendChild(h2);
    modalHeader.appendChild(closeBtn);
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    const detailGrid = document.createElement('div');
    detailGrid.className = 'detail-grid';
    
    // Equipment info section
    const infoSection = createDetailSection('Equipment Information', [
        { label: 'Zone', value: `${equipment.zone} - ${equipmentData.metadata.zones?.[equipment.zone] || 'Unknown'}` },
        { label: 'Type', value: formatEquipmentType(equipment.type ?? '') },
        { label: 'Movement Pattern', value: formatPattern(equipment.pattern ?? '') },
        { label: 'Primary Muscles', value: safeMuscles(equipment).primary.join(', ') }
    ]);
    
    const muscles = safeMuscles(equipment);
    if (muscles.secondary.length > 0) {
        const secondaryP = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = 'Secondary Muscles:';
        secondaryP.appendChild(strong);
        secondaryP.appendChild(document.createTextNode(` ${muscles.secondary.join(', ')}`));
        infoSection.appendChild(secondaryP);
    }
    
    // Settings form section
    const settingsSection = createSettingsForm(equipmentId, userSettings);
    
    detailGrid.appendChild(infoSection);
    detailGrid.appendChild(settingsSection);
    
    modalBody.appendChild(detailGrid);
    content.appendChild(modalHeader);
    content.appendChild(modalBody);
    
    modal.style.display = 'block';
}

function createDetailSection(title, items) {
    const section = document.createElement('div');
    section.className = 'detail-section';
    
    const h3 = document.createElement('h3');
    h3.textContent = title;
    section.appendChild(h3);
    
    items.forEach(item => {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = `${item.label}:`;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(` ${item.value}`));
        section.appendChild(p);
    });
    
    return section;
}

function createSettingsForm(equipmentId, userSettings) {
    const section = document.createElement('div');
    section.className = 'detail-section';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'My Settings';
    section.appendChild(h3);
    
    const form = document.createElement('form');
    form.id = 'settings-form';
    form.addEventListener('submit', (e) => saveEquipmentSettings(e, equipmentId));
    
    // Last weight input
    const weightGroup = createFormGroup('Last Weight Used:', 'last_weight', 
        userSettings.last_weight || '', 'e.g., 100 lbs or 45 per side');
    
    // Seat position input
    const seatGroup = createFormGroup('Seat/Position Settings:', 'seat_position',
        userSettings.seat_position || '', 'e.g., Seat height 4, Back angle 45°');
    
    // Notes textarea
    const notesGroup = document.createElement('div');
    notesGroup.className = 'form-group';
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes:';
    const notesTextarea = document.createElement('textarea');
    notesTextarea.name = 'notes';
    notesTextarea.rows = 3;
    notesTextarea.value = userSettings.notes || '';
    notesGroup.appendChild(notesLabel);
    notesGroup.appendChild(notesTextarea);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Save Settings';
    
    form.appendChild(weightGroup);
    form.appendChild(seatGroup);
    form.appendChild(notesGroup);
    form.appendChild(submitBtn);
    
    section.appendChild(form);
    return section;
}

function createFormGroup(labelText, inputName, inputValue, placeholder) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.name = inputName;
    input.value = inputValue;
    input.placeholder = placeholder;
    
    group.appendChild(label);
    group.appendChild(input);
    
    return group;
}

// Settings Management
function saveEquipmentSettings(event, equipmentId) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    if (!mySettings.equipment_settings) {
        mySettings.equipment_settings = {};
    }
    
    if (!mySettings.equipment_settings[equipmentId]) {
        mySettings.equipment_settings[equipmentId] = {};
    }
    
    mySettings.equipment_settings[equipmentId] = {
        last_weight: formData.get('last_weight'),
        seat_position: formData.get('seat_position'),
        notes: formData.get('notes'),
        last_used: new Date().toISOString().split('T')[0]
    };
    
    mySettings.last_updated = new Date().toISOString();
    saveSettingsToCloud();
    
    showNotification('Settings saved successfully!', 'success');
    displayEquipment(); // Refresh to show updated settings
}

// Safe Settings Display
function displaySettings() {
    const container = document.getElementById('settings-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'User Preferences';
    panel.appendChild(h2);
    
    // Create preferences form
    const form = document.createElement('form');
    form.id = 'user-preferences-form';
    form.addEventListener('submit', saveUserPreferences);
    
    // Name input
    const nameGroup = createFormGroup('Your Name:', 'name', 
        mySettings.user?.name || '', '');
    nameGroup.querySelector('input').required = true;
    
    // Experience level select
    const expGroup = document.createElement('div');
    expGroup.className = 'form-group';
    const expLabel = document.createElement('label');
    expLabel.textContent = 'Experience Level:';
    const expSelect = document.createElement('select');
    expSelect.name = 'experience_level';
    ['beginner', 'intermediate', 'advanced'].forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level.charAt(0).toUpperCase() + level.slice(1);
        option.selected = mySettings.user?.experience_level === level;
        expSelect.appendChild(option);
    });
    expGroup.appendChild(expLabel);
    expGroup.appendChild(expSelect);
    
    // Duration input
    const durationGroup = createNumberInput('Typical Workout Duration (minutes):', 
        'typical_duration', mySettings.user?.typical_duration || 60, 15, 180);
    
    // Rest time input
    const restGroup = createNumberInput('Rest Between Sets (seconds):', 
        'rest_between_sets', mySettings.preferences?.rest_between_sets || 90, 30, 300);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Save Preferences';
    
    form.appendChild(nameGroup);
    form.appendChild(expGroup);
    form.appendChild(durationGroup);
    form.appendChild(restGroup);
    form.appendChild(submitBtn);
    
    panel.appendChild(form);
    
    // Data management section
    const dataSection = createDataManagementSection();
    panel.appendChild(dataSection);
    
    container.appendChild(panel);
}

function createNumberInput(labelText, inputName, value, min, max) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.name = inputName;
    input.value = value;
    input.min = min;
    input.max = max;
    
    group.appendChild(label);
    group.appendChild(input);
    
    return group;
}

function createDataManagementSection() {
    const section = document.createElement('div');
    section.className = 'data-management';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Data Management';
    section.appendChild(h3);
    
    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn-secondary';
    exportBtn.textContent = 'Export All Data';
    exportBtn.addEventListener('click', exportData);
    
    // Import button
    const importBtn = document.createElement('button');
    importBtn.className = 'btn-secondary';
    importBtn.textContent = 'Import Data';
    importBtn.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    
    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'import-file-input';
    fileInput.style.display = 'none';
    fileInput.accept = '.json';
    fileInput.addEventListener('change', importData);
    
    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-danger';
    resetBtn.textContent = 'Reset All Data';
    resetBtn.addEventListener('click', resetData);
    
    section.appendChild(exportBtn);
    section.appendChild(importBtn);
    section.appendChild(fileInput);
    section.appendChild(resetBtn);
    
    return section;
}

function saveUserPreferences(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    if (!mySettings.user) mySettings.user = {};
    if (!mySettings.preferences) mySettings.preferences = {};
    
    mySettings.user.name = formData.get('name');
    mySettings.user.experience_level = formData.get('experience_level');
    mySettings.user.typical_duration = parseInt(formData.get('typical_duration'));
    mySettings.preferences.rest_between_sets = parseInt(formData.get('rest_between_sets'));
    
    mySettings.last_updated = new Date().toISOString();
    saveSettingsToCloud();
    
    showNotification('Preferences saved successfully!', 'success');
}

// Safe Workout Builder Display
function displayWorkoutBuilder() {
    const container = document.getElementById('workout-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const builder = document.createElement('div');
    builder.className = 'workout-builder';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Current Workout';
    builder.appendChild(h2);
    
    const workoutList = document.createElement('div');
    workoutList.id = 'current-workout-list';
    
    if (currentWorkout.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No exercises added yet. Browse equipment to add exercises.';
        workoutList.appendChild(emptyState);
    } else {
        currentWorkout.forEach((exercise, index) => {
            const card = createWorkoutExerciseCardSafe(exercise, index);
            workoutList.appendChild(card);
        });
    }
    
    builder.appendChild(workoutList);
    
    // Add workout actions if exercises exist
    if (currentWorkout.length > 0) {
        const actions = createWorkoutActions();
        builder.appendChild(actions);
    }
    
    // Add templates section
    const templates = createWorkoutTemplates();
    builder.appendChild(templates);
    
    container.appendChild(builder);
}

function createWorkoutExerciseCardSafe(exercise, index) {
    const card = document.createElement('div');
    card.className = 'workout-exercise-card';
    
    const info = document.createElement('div');
    info.className = 'exercise-info';
    
    const h4 = document.createElement('h4');
    h4.textContent = exercise.name ?? 'Unknown Exercise';
    
    const badge = document.createElement('span');
    badge.className = `zone-badge zone-${exercise.zone ?? ''}`;
    badge.textContent = `Zone ${exercise.zone ?? '?'}`;
    
    info.appendChild(h4);
    info.appendChild(badge);
    
    const actions = document.createElement('div');
    actions.className = 'exercise-actions';
    
    const upBtn = document.createElement('button');
    upBtn.textContent = '↑';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveExerciseUp(index));
    
    const downBtn = document.createElement('button');
    downBtn.textContent = '↓';
    downBtn.disabled = index === currentWorkout.length - 1;
    downBtn.addEventListener('click', () => moveExerciseDown(index));
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeFromWorkout(index));
    
    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(removeBtn);
    
    card.appendChild(info);
    card.appendChild(actions);
    
    return card;
}

function createWorkoutActions() {
    const actions = document.createElement('div');
    actions.className = 'workout-actions';
    
    const optimizeBtn = document.createElement('button');
    optimizeBtn.className = 'btn-secondary';
    optimizeBtn.textContent = 'Optimize Route';
    optimizeBtn.addEventListener('click', optimizeRoute);
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Save Workout';
    saveBtn.addEventListener('click', saveWorkout);
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-danger';
    clearBtn.textContent = 'Clear All';
    clearBtn.addEventListener('click', clearWorkout);
    
    actions.appendChild(optimizeBtn);
    actions.appendChild(saveBtn);
    actions.appendChild(clearBtn);
    
    return actions;
}

function createWorkoutTemplates() {
    const templates = document.createElement('div');
    templates.className = 'workout-templates';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Load Template';
    templates.appendChild(h3);
    
    const templateList = document.createElement('div');
    templateList.className = 'template-list';
    
    (workoutLogs.templates || []).forEach(template => {
        const btn = document.createElement('button');
        btn.className = 'template-btn';
        btn.textContent = `${template.name} (${template.equipment_sequence.length} exercises)`;
        btn.addEventListener('click', () => loadTemplate(template.name));
        templateList.appendChild(btn);
    });
    
    templates.appendChild(templateList);
    
    return templates;
}

// Workout Management Functions
function addToWorkout(equipmentId) {
    const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
    if (!equipment) return;
    
    // Check if already in workout
    if (currentWorkout.find(e => e.id === equipmentId)) {
        showNotification('Equipment already in workout', 'warning');
        return;
    }
    
    currentWorkout.push({
        id: equipment.id,
        name: equipment.name,
        zone: equipment.zone,
        muscles: equipment.muscles
    });
    
    showNotification(`Added ${equipment.name} to workout`, 'success');
    
    // Update UI if on workout view
    if (currentView === 'workout') {
        displayWorkoutBuilder();
    }
}

function removeFromWorkout(index) {
    currentWorkout.splice(index, 1);
    displayWorkoutBuilder();
}

function moveExerciseUp(index) {
    if (index > 0) {
        [currentWorkout[index], currentWorkout[index - 1]] = [currentWorkout[index - 1], currentWorkout[index]];
        displayWorkoutBuilder();
    }
}

function moveExerciseDown(index) {
    if (index < currentWorkout.length - 1) {
        [currentWorkout[index], currentWorkout[index + 1]] = [currentWorkout[index + 1], currentWorkout[index]];
        displayWorkoutBuilder();
    }
}

function clearWorkout() {
    if (confirm('Clear all exercises from current workout?')) {
        currentWorkout = [];
        displayWorkoutBuilder();
    }
}

function optimizeRoute() {
    // Group exercises by zone to minimize walking
    currentWorkout.sort((a, b) => (a.zone || '').localeCompare(b.zone || ''));
    displayWorkoutBuilder();
    showNotification('Workout route optimized by zone', 'success');
}

async function saveWorkout() {
    if (currentWorkout.length === 0) {
        showNotification('No exercises to save', 'warning');
        return;
    }
    
    const workoutName = prompt('Enter a name for this workout:');
    if (!workoutName) return;
    
    const workout = {
        id: `workout-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        name: workoutName,
        exercises: currentWorkout.map(e => ({
            equipment_id: e.id,
            equipment_name: e.name,
            sets: []
        })),
        duration_minutes: 0,
        zones_visited: [...new Set(currentWorkout.map(e => e.zone))],
        notes: ''
    };
    
    try {
        // Save workout via API
        showNotification('Saving workout...', 'info');
        const response = await ApiClient.addWorkout(workout);
        
        if (response.error) {
            // Fallback to local storage
            console.warn('API save failed, using localStorage:', response.message);
            workoutLogs.workouts.push(workout);
            
            // Add as template locally
            const existingTemplate = workoutLogs.templates.find(t => t.name === workoutName);
            if (!existingTemplate) {
                workoutLogs.templates.push({
                    name: workoutName,
                    equipment_sequence: currentWorkout.map(e => e.id),
                    target_duration: mySettings.user?.typical_duration || 60
                });
            }
            
            localStorage.setItem('eosFitnessLogs', JSON.stringify(workoutLogs));
            showNotification('Workout saved locally - will sync when online', 'warning');
        } else {
            // Successfully saved to cloud
            // Refresh data to get updated statistics
            await loadWorkoutLogs();
            showNotification('Workout saved to cloud!', 'success');
        }
        
        // Clear current workout and refresh display
        currentWorkout = [];
        displayWorkoutBuilder();
        
    } catch (error) {
        console.error('Error saving workout:', error);
        
        // Fallback to localStorage
        try {
            workoutLogs.workouts.push(workout);
            localStorage.setItem('eosFitnessLogs', JSON.stringify(workoutLogs));
            showNotification('Workout saved locally due to error', 'warning');
            currentWorkout = [];
            displayWorkoutBuilder();
        } catch (localError) {
            console.error('Local save also failed:', localError);
            showNotification('Failed to save workout', 'error');
        }
    }
}

// Enhanced settings save function
async function saveSettingsToCloud() {
    try {
        const response = await ApiClient.saveSettings(mySettings);
        
        if (response.error) {
            console.warn('Cloud save failed:', response.message);
            // Keep using local batched save as fallback
            saveSettingsToLocalBatched();
            return false;
        }
        
        // Also save locally for offline access
        saveSettingsToLocalBatched();
        
        showNotification('Settings synced to cloud', 'success');
        return true;
        
    } catch (error) {
        console.error('Error saving settings to cloud:', error);
        // Fallback to local save
        saveSettingsToLocalBatched();
        return false;
    }
}

function loadTemplate(templateName) {
    const template = workoutLogs.templates.find(t => t.name === templateName);
    if (!template) return;
    
    currentWorkout = [];
    
    template.equipment_sequence.forEach(equipmentId => {
        const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
        if (equipment) {
            currentWorkout.push({
                id: equipment.id,
                name: equipment.name,
                zone: equipment.zone,
                muscles: equipment.muscles
            });
        }
    });
    
    displayWorkoutBuilder();
    showNotification(`Loaded template: ${templateName}`, 'success');
}

// Substitution Algorithm with Safe Access
function findSubstitutes(equipmentId) {
    const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
    if (!equipment) return;
    
    // Calculate match scores for all other equipment
    const substitutes = equipmentData.equipment
        .filter(e => e.id !== equipmentId)
        .map(e => ({
            equipment: e,
            score: calculateMatchScoreSafe(equipment, e)
        }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 matches
    
    displaySubstitutesModalSafe(equipment, substitutes);
}

function calculateMatchScoreSafe(a, b) {
    let score = 0;
    const ma = safeMuscles(a), mb = safeMuscles(b);
    
    // Same movement pattern = highest score
    if (a.pattern && a.pattern === b.pattern) score += 50;
    
    // Primary muscle overlap
    score += ma.primary.filter(m => mb.primary.includes(m)).length * 30;
    
    // Secondary muscle overlap
    score += ma.secondary.filter(m => mb.secondary.includes(m)).length * 10;
    
    // Zone proximity bonus
    const az = (a.zone || '').charCodeAt(0);
    const bz = (b.zone || '').charCodeAt(0);
    if (Number.isFinite(az) && Number.isFinite(bz)) {
        const d = Math.abs(az - bz);
        score += d === 0 ? 20 : d === 1 ? 10 : 0;
    }
    
    // Equipment type similarity
    if (a.type && a.type === b.type) score += 15;
    
    return score;
}

function displaySubstitutesModalSafe(equipment, substitutes) {
    const modal = document.getElementById('substitutes-modal') || createModal('substitutes-modal');
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    
    // Clear content safely
    while (content.firstChild) {
        content.removeChild(content.firstChild);
    }
    
    // Build modal header
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const h2 = document.createElement('h2');
    h2.textContent = `Substitutes for ${equipment.name ?? 'Equipment'}`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeModal);
    
    header.appendChild(h2);
    header.appendChild(closeBtn);
    
    // Build modal body
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Original equipment section
    const originalSection = document.createElement('div');
    originalSection.className = 'original-equipment';
    
    const h3Original = document.createElement('h3');
    h3Original.textContent = 'Original Equipment';
    
    const pName = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = equipment.name ?? 'Unknown';
    pName.appendChild(strong);
    
    const pDetails = document.createElement('p');
    const muscles = safeMuscles(equipment);
    pDetails.textContent = `Zone ${equipment.zone ?? '?'} | ${muscles.primary.join(', ')}`;
    
    originalSection.appendChild(h3Original);
    originalSection.appendChild(pName);
    originalSection.appendChild(pDetails);
    
    // Substitutes list
    const subList = document.createElement('div');
    subList.className = 'substitute-list';
    
    const h3Subs = document.createElement('h3');
    h3Subs.textContent = 'Best Substitutes';
    subList.appendChild(h3Subs);
    
    if (substitutes.length > 0) {
        substitutes.forEach(sub => {
            const item = createSubstituteItem(sub);
            subList.appendChild(item);
        });
    } else {
        const noSubs = document.createElement('p');
        noSubs.textContent = 'No suitable substitutes found';
        subList.appendChild(noSubs);
    }
    
    body.appendChild(originalSection);
    body.appendChild(subList);
    
    content.appendChild(header);
    content.appendChild(body);
    
    modal.style.display = 'block';
}

function createSubstituteItem(sub) {
    const item = document.createElement('div');
    item.className = 'substitute-item';
    item.addEventListener('click', () => showEquipmentDetail(sub.equipment.id));
    
    const info = document.createElement('div');
    info.className = 'substitute-info';
    
    const h4 = document.createElement('h4');
    h4.textContent = sub.equipment.name ?? 'Unknown';
    
    const p = document.createElement('p');
    const muscles = safeMuscles(sub.equipment);
    p.textContent = `Zone ${sub.equipment.zone ?? '?'} | ${muscles.primary.join(', ')}`;
    
    info.appendChild(h4);
    info.appendChild(p);
    
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'match-score';
    
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'score';
    scoreSpan.textContent = `${Math.round(sub.score)}%`;
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = 'Match';
    
    scoreDiv.appendChild(scoreSpan);
    scoreDiv.appendChild(labelSpan);
    
    item.appendChild(info);
    item.appendChild(scoreDiv);
    
    return item;
}

// Safe Substitutes View
function displaySubstitutes() {
    const container = document.getElementById('substitutes-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const panel = document.createElement('div');
    panel.className = 'substitutes-panel';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Quick Substitute Finder';
    panel.appendChild(h2);
    
    const p = document.createElement('p');
    p.textContent = 'Select any equipment to find the best alternatives when it\'s busy.';
    panel.appendChild(p);
    
    const quickSubs = document.createElement('div');
    quickSubs.className = 'quick-substitutes';
    
    Object.entries(mySettings.quick_substitutes || {}).forEach(([equipId, subs]) => {
        const equipment = equipmentData.equipment.find(e => e.id === equipId);
        if (!equipment) return;
        
        const group = createQuickSubGroup(equipment, subs);
        quickSubs.appendChild(group);
    });
    
    panel.appendChild(quickSubs);
    container.appendChild(panel);
}

function createQuickSubGroup(equipment, subs) {
    const group = document.createElement('div');
    group.className = 'quick-sub-group';
    
    const h3 = document.createElement('h3');
    h3.textContent = equipment.name ?? 'Unknown';
    group.appendChild(h3);
    
    const subList = document.createElement('div');
    subList.className = 'sub-list';
    
    subs.forEach(subId => {
        const sub = equipmentData.equipment.find(e => e.id === subId);
        if (sub) {
            const btn = document.createElement('button');
            btn.className = 'sub-btn';
            btn.textContent = `${sub.name} (Zone ${sub.zone ?? '?'})`;
            btn.addEventListener('click', () => showEquipmentDetail(subId));
            subList.appendChild(btn);
        }
    });
    
    group.appendChild(subList);
    return group;
}

// Safe History Display
function displayHistory() {
    const container = document.getElementById('history-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const panel = document.createElement('div');
    panel.className = 'history-panel';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Workout History';
    panel.appendChild(h2);
    
    // Stats summary
    const stats = createStatsCards();
    panel.appendChild(stats);
    
    // Workout history
    const history = createWorkoutHistory();
    panel.appendChild(history);
    
    container.appendChild(panel);
}

function createStatsCards() {
    const summary = document.createElement('div');
    summary.className = 'stats-summary';
    
    const stats = [
        { value: workoutLogs.stats?.total_workouts || 0, label: 'Total Workouts' },
        { value: workoutLogs.stats?.average_workout_duration || 0, label: 'Avg Duration (min)' },
        { value: workoutLogs.stats?.weekly_frequency || 0, label: 'Weekly Frequency' }
    ];
    
    stats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        
        const value = document.createElement('span');
        value.className = 'stat-value';
        value.textContent = stat.value.toString();
        
        const label = document.createElement('span');
        label.className = 'stat-label';
        label.textContent = stat.label;
        
        card.appendChild(value);
        card.appendChild(label);
        summary.appendChild(card);
    });
    
    return summary;
}

function createWorkoutHistory() {
    const history = document.createElement('div');
    history.className = 'workout-history';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Recent Workouts';
    history.appendChild(h3);
    
    const recentWorkouts = (workoutLogs.workouts || []).slice(-10).reverse();
    
    if (recentWorkouts.length > 0) {
        recentWorkouts.forEach(workout => {
            const card = createHistoryCard(workout);
            history.appendChild(card);
        });
    } else {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No workout history yet. Start tracking your workouts!';
        history.appendChild(empty);
    }
    
    return history;
}

function createHistoryCard(workout) {
    const card = document.createElement('div');
    card.className = 'history-card';
    
    const header = document.createElement('div');
    header.className = 'workout-header';
    
    const h4 = document.createElement('h4');
    h4.textContent = `${workout.type || 'Workout'} - ${formatDate(workout.date)}`;
    
    const duration = document.createElement('span');
    duration.className = 'duration';
    duration.textContent = `${workout.duration_minutes} min`;
    
    header.appendChild(h4);
    header.appendChild(duration);
    
    const summary = document.createElement('div');
    summary.className = 'workout-summary';
    
    const p = document.createElement('p');
    p.textContent = `${workout.exercises.length} exercises in zones ${workout.zones_visited.join(', ')}`;
    summary.appendChild(p);
    
    if (workout.notes) {
        const notes = document.createElement('p');
        notes.className = 'notes';
        notes.textContent = workout.notes;
        summary.appendChild(notes);
    }
    
    card.appendChild(header);
    card.appendChild(summary);
    
    return card;
}

// Export/Import Functions with Memory Management
function exportData() {
    const exportData = {
        version: '2.0',
        exported_at: new Date().toISOString(),
        settings: mySettings,
        workout_logs: workoutLogs,
        equipment_database: equipmentData
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `eos-fitness-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    // Revoke URL after download starts
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showNotification('Data exported successfully!', 'success');
}

function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Remove dangerous keys
            for (const key of ['__proto__', 'constructor', 'prototype']) {
                delete importedData[key];
            }
            
            // Validate and import settings
            if (importedData.settings && validateSettings(importedData.settings)) {
                mySettings = importedData.settings;
                saveSettingsToLocalBatched();
            }
            
            // Validate and import workout logs
            if (importedData.workout_logs && validateWorkoutLogs(importedData.workout_logs)) {
                workoutLogs = importedData.workout_logs;
                localStorage.setItem('eosFitnessLogs', JSON.stringify(workoutLogs));
            }
            
            // Validate and import equipment database
            if (importedData.equipment_database && validateEquipmentDatabase(importedData.equipment_database)) {
                equipmentData = importedData.equipment_database;
            }
            
            showNotification('Data imported successfully!', 'success');
            setTimeout(() => location.reload(), 1000); // Refresh after notification shows
        } catch (error) {
            showNotification('Error importing data. Please check the file format.', 'error');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
}

function resetData() {
    if (!confirm('This will reset all your settings and workout data. Are you sure?')) return;
    
    localStorage.removeItem('eosFitnessSettings');
    localStorage.removeItem('eosFitnessLogs');
    
    mySettings = getDefaultSettings();
    workoutLogs = getDefaultWorkoutLogs();
    
    showNotification('All data has been reset', 'success');
    setTimeout(() => location.reload(), 1000);
}

// Utility Functions
function formatEquipmentType(type) {
    const typeMap = {
        'ai_assisted': 'AI-Assisted',
        'plate_loaded': 'Plate-Loaded',
        'selectorized': 'Selectorized',
        'cable': 'Cable Machine',
        'free_weight': 'Free Weight',
        'bodyweight': 'Bodyweight'
    };
    return typeMap[type] || type || 'Unknown';
}

function formatPattern(pattern) {
    if (!pattern) return 'Unknown';
    return pattern.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        const date = new Date(dateString);
        const today = new Date();
        const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
    } catch {
        return dateString;
    }
}

function updateFilterButtons() {
    document.querySelectorAll('.zone-filter').forEach(button => {
        const isActive = button.dataset.zone === filterState.zone;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive.toString());
    });
    
    document.querySelectorAll('.muscle-filter').forEach(button => {
        const isActive = button.dataset.muscle === filterState.muscle;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive.toString());
    });
}

function updateUI() {
    updateLastUpdated();
    updateStatusBar('Ready');
}

function updateLastUpdated() {
    const element = document.getElementById('last-updated');
    if (element && mySettings.last_updated) {
        element.textContent = `Last updated: ${formatDate(mySettings.last_updated)}`;
    }
}

function updateStatusBar(message) {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

function showNotification(message, type = 'info') {
    // Get the notification container or fall back to body
    const container = document.getElementById('notification-container') || document.body;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    notification.textContent = message;
    
    // Add to container
    container.appendChild(notification);
    
    // Announce to screen readers
    announceToScreenReader(`${type}: ${message}`);
    
    // Show notification with animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto-hide after 5 seconds (longer for accessibility)
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Add close button for manual dismissal
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'notification-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    notification.appendChild(closeBtn);
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

function createModal(id) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    modal.appendChild(content);
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    return modal;
}

// Initialize modals if they don't exist
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('equipment-modal')) {
        createModal('equipment-modal');
    }
    if (!document.getElementById('substitutes-modal')) {
        createModal('substitutes-modal');
    }
});

// Export functions for global access (minimize these in production)
window.showView = showView;
window.showEquipmentDetail = showEquipmentDetail;
window.saveEquipmentSettings = saveEquipmentSettings;
window.addToWorkout = addToWorkout;
window.removeFromWorkout = removeFromWorkout;
window.moveExerciseUp = moveExerciseUp;
window.moveExerciseDown = moveExerciseDown;
window.findSubstitutes = findSubstitutes;
window.optimizeRoute = optimizeRoute;
window.saveWorkout = saveWorkout;
window.clearWorkout = clearWorkout;
window.loadTemplate = loadTemplate;
window.exportData = exportData;
window.importData = importData;
window.resetData = resetData;
window.closeModal = closeModal;
window.saveUserPreferences = saveUserPreferences;