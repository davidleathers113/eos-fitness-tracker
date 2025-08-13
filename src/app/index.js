/**
 * Application Bootstrap
 * Initializes and wires all modules together
 */

// Core imports
import { getState, setState, subscribe } from './core/store.js';
import { emit, on, EVT } from './core/events.js';
import { DOM_IDS, VIEWS, STORAGE_KEYS } from './core/constants.js';
import { $, getById, announce } from './core/dom.js';

// Service imports
import { apiClient } from './services/api/client.js';
import { initAuth, getCurrentUser } from './services/api/auth.js';
import { getSettings } from './services/api/settings.js';
import { getWorkoutLogs } from './services/api/workouts.js';
import { offlineQueue } from './services/storage/offlineQueue.js';
import { storage } from './services/storage/localStorage.js';
import { needsMigration, performMigration } from './services/migration.js';
import { initURLState, updateURL } from './services/urlState.js';
import { initPWA } from './services/pwa.js';

// UI imports
import { modalManager } from './ui/modal/manager.js';
import { showToast, showSuccess, showError } from './ui/notifications/toast.js';
import { showSkeletonLoading, hideSkeletonLoading } from './ui/loading/skeletons.js';

// Feature imports
import { initEquipmentView } from './features/equipment/view.js';
import { initFilters } from './features/filters/widgets.js';
import { initWorkoutBuilder } from './features/workout/builder.js';
import { initSettingsView } from './features/settings/view.js';
import { initAuthUI } from './features/auth/ui.js';
import { initHistory } from './features/workout/history.js';
import { initSubstitutes } from './features/equipment/substitutes.js';

// Data imports
import { getDefaultSettings } from './features/settings/data.js';
import { getDefaultWorkoutLogs } from './features/workout/data.js';
import { getDefaultEquipmentData } from './features/equipment/data.js';

/**
 * Main application class
 */
class EOSFitnessApp {
    constructor() {
        this.initialized = false;
        this.dataLoaded = false;
    }
    
    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;
        
        console.log('Initializing EOS Fitness Tracker...');
        
        try {
            // Show loading state
            this.showAppLoading();
            
            // Initialize core services
            await this.initializeServices();
            
            // Initialize UI managers
            this.initializeUI();
            
            // Load application data
            await this.loadApplicationData();
            
            // Initialize features
            this.initializeFeatures();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize routing
            initURLState();
            
            // Check for migration
            await this.checkMigration();
            
            // Hide loading state
            this.hideAppLoading();
            
            // Mark as initialized
            this.initialized = true;
            
            // Emit ready event
            emit(EVT.APP_READY);
            
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleInitError(error);
        }
    }
    
    /**
     * Initialize core services
     */
    async initializeServices() {
        // Initialize authentication
        const isAuthenticated = await initAuth();
        console.log('Auth initialized:', isAuthenticated);
        
        // Initialize PWA features
        await initPWA();
        console.log('PWA features initialized');
        
        // Update network status
        apiClient.updateNetworkStatus();
        
        // Setup network listeners
        window.addEventListener('online', () => {
            apiClient.updateNetworkStatus();
            showSuccess('Connection restored');
        });
        
        window.addEventListener('offline', () => {
            apiClient.updateNetworkStatus();
            showError('Connection lost - working offline');
        });
    }
    
    /**
     * Initialize UI managers
     */
    initializeUI() {
        // Initialize modal manager
        modalManager.init();
        
        // Initialize theme and density from storage
        this.initializeTheme();
        this.initializeDensity();
        
        // Initialize keyboard shortcuts
        this.initializeKeyboard();
    }
    
    /**
     * Initialize theme
     */
    initializeTheme() {
        const savedTheme = storage.get(STORAGE_KEYS.THEME, 'light');
        document.body.dataset.theme = savedTheme;
        setState({ theme: savedTheme });
    }
    
    /**
     * Initialize density
     */
    initializeDensity() {
        const savedDensity = storage.get(STORAGE_KEYS.DENSITY, 'comfortable');
        document.body.dataset.density = savedDensity;
        setState({ density: savedDensity });
    }
    
    /**
     * Initialize keyboard shortcuts
     */
    initializeKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Global shortcuts
            if (e.key === '/' && !this.isInputFocused()) {
                e.preventDefault();
                const searchInput = getById(DOM_IDS.SEARCH_INPUT);
                if (searchInput) searchInput.focus();
            }
            
            if (e.key === '?' && !this.isInputFocused()) {
                e.preventDefault();
                emit('keyboard/help');
            }
            
            // Zone shortcuts (1-6)
            if (!this.isInputFocused() && /^[1-6]$/.test(e.key)) {
                const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
                const zone = zones[parseInt(e.key) - 1];
                setState({ filter: { ...getState().filter, zone } });
                emit(EVT.FILTERS_CHANGED, { zone });
            }
        });
    }
    
    /**
     * Check if an input is focused
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
        );
    }
    
    /**
     * Load application data
     */
    async loadApplicationData() {
        try {
            // Load equipment database
            await this.loadEquipmentDatabase();
            
            // Load user data if authenticated
            const user = getCurrentUser();
            if (user.isAuthenticated) {
                await this.loadUserData();
            } else {
                // Load from local storage
                this.loadLocalData();
            }
            
            this.dataLoaded = true;
            emit(EVT.APP_LOADED);
            
        } catch (error) {
            console.error('Failed to load application data:', error);
            showError('Failed to load data. Using defaults.');
            
            // Use default data
            setState({
                equipment: getDefaultEquipmentData(),
                settings: getDefaultSettings(),
                workoutLogs: getDefaultWorkoutLogs()
            });
        }
    }
    
    /**
     * Load equipment database
     */
    async loadEquipmentDatabase() {
        try {
            const response = await fetch('/data/equipment-database.json');
            if (!response.ok) throw new Error('Failed to load equipment database');
            
            const data = await response.json();
            setState({ equipment: data });
            emit(EVT.EQUIPMENT_LOADED, data);
            
        } catch (error) {
            console.error('Failed to load equipment database:', error);
            
            // Try local backup
            const localData = storage.get('equipment-database');
            if (localData) {
                setState({ equipment: localData });
                emit(EVT.EQUIPMENT_LOADED, localData);
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Load user data from API
     */
    async loadUserData() {
        const [settingsResult, workoutsResult] = await Promise.all([
            getSettings(),
            getWorkoutLogs()
        ]);
        
        if (settingsResult.success) {
            setState({ settings: settingsResult.settings });
            emit(EVT.SETTINGS_LOADED, settingsResult.settings);
        }
        
        if (workoutsResult.success) {
            setState({ workoutLogs: workoutsResult.workoutLogs });
        }
    }
    
    /**
     * Load local data
     */
    loadLocalData() {
        const settings = storage.get(STORAGE_KEYS.MY_SETTINGS, getDefaultSettings());
        const workoutLogs = storage.get(STORAGE_KEYS.WORKOUT_LOGS, getDefaultWorkoutLogs());
        
        setState({
            settings,
            workoutLogs
        });
    }
    
    /**
     * Initialize features
     */
    initializeFeatures() {
        // Initialize all feature modules
        initEquipmentView();
        initFilters();
        initWorkoutBuilder();
        initSettingsView();
        initAuthUI();
        initHistory();
        initSubstitutes();
        
        console.log('Features initialized');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            const navBtn = e.target.closest('.nav-btn');
            if (navBtn) {
                const view = navBtn.dataset.view;
                this.navigateToView(view);
            }
        });
        
        // Listen for view changes
        on(EVT.VIEW_CHANGED, (view) => {
            this.updateActiveView(view);
        });
        
        // Listen for filter changes
        on(EVT.FILTERS_CHANGED, () => {
            updateURL({ includeFilters: true });
        });
        
        // Listen for errors
        on(EVT.APP_ERROR, (error) => {
            console.error('Application error:', error);
            showError(error.message || 'An error occurred');
        });
    }
    
    /**
     * Navigate to a view
     */
    navigateToView(view) {
        if (!Object.values(VIEWS).includes(view)) {
            console.warn('Invalid view:', view);
            return;
        }
        
        setState({ currentView: view });
        emit(EVT.VIEW_CHANGED, view);
        updateURL({ includeView: true });
    }
    
    /**
     * Update active view
     */
    updateActiveView(view) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Update view containers
        document.querySelectorAll('.view').forEach(viewEl => {
            const viewName = viewEl.id.replace('-view', '');
            viewEl.classList.toggle('hidden', viewName !== view);
        });
        
        // Announce for screen readers
        announce(`Switched to ${view} view`);
    }
    
    /**
     * Check for data migration
     */
    async checkMigration() {
        if (needsMigration()) {
            const user = getCurrentUser();
            if (user.isAuthenticated) {
                // Perform automatic migration
                const result = await performMigration();
                if (result.success) {
                    showSuccess(`Migrated ${result.migrated.settings} settings and ${result.migrated.workouts} workouts`);
                }
            } else {
                // Show migration prompt
                emit('migration/needed');
            }
        }
    }
    
    /**
     * Show app loading state
     */
    showAppLoading() {
        const mainContent = getById(DOM_IDS.MAIN_CONTENT);
        if (mainContent) {
            showSkeletonLoading(mainContent, {
                type: 'cards',
                count: 6
            });
        }
    }
    
    /**
     * Hide app loading state
     */
    hideAppLoading() {
        const mainContent = getById(DOM_IDS.MAIN_CONTENT);
        if (mainContent) {
            hideSkeletonLoading(mainContent);
        }
    }
    
    /**
     * Handle initialization error
     */
    handleInitError(error) {
        console.error('Initialization error:', error);
        
        const mainContent = getById(DOM_IDS.MAIN_CONTENT);
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-state">
                    <h2>Failed to Load Application</h2>
                    <p>${error.message || 'An unexpected error occurred'}</p>
                    <button onclick="location.reload()">Reload Page</button>
                </div>
            `;
        }
    }
}

// Create and export app instance
export const app = new EOSFitnessApp();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Export for global access (temporary bridge)
window.EOSApp = {
    // Minimal bridge for HTML onclick handlers
    navigateTo: (view) => app.navigateToView(view),
    showToast: (message, type) => showToast(message, { type }),
    getState: () => getState(),
    emit: (event, data) => emit(event, data)
};