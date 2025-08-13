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
import { getCurrentUser } from './services/api/auth.js';
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
        // Initialize authentication (bound to apiClient instance)
        const isAuthenticated = await apiClient.initAuth();
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
     * Load equipment database with enhanced error handling
     */
    async loadEquipmentDatabase() {
        try {
            const response = await fetch('/database/equipment-database.json');
            
            if (!response.ok) {
                throw new Error(`Failed to load equipment: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate data structure
            if (!data.equipment || !Array.isArray(data.equipment)) {
                throw new Error('Invalid equipment data format');
            }
            
            // Cache for offline use
            try {
                storage.set('equipment-database', data);
            } catch (cacheError) {
                console.warn('Failed to cache equipment data:', cacheError);
            }
            
            setState({ equipment: data });
            emit(EVT.EQUIPMENT_LOADED, data);
            
        } catch (error) {
            console.error('Failed to load equipment database:', error);
            
            // Try local backup
            const localData = storage.get('equipment-database');
            if (localData && localData.equipment) {
                console.log('Using cached equipment data');
                setState({ equipment: localData });
                emit(EVT.EQUIPMENT_LOADED, localData);
                
                // Show notification that we're using cached data
                emit(EVT.NOTIFICATION, {
                    message: 'Using cached equipment data. Some information may be outdated.',
                    type: 'warning'
                });
            } else {
                // Critical failure - show error to user
                emit(EVT.ERROR, {
                    message: 'Unable to load equipment data. Please check your connection and refresh.',
                    type: 'error'
                });
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
        // Navigation and UI controls
        document.addEventListener('click', (e) => {
            // Navigation buttons
            const navBtn = e.target.closest('.nav-btn');
            if (navBtn) {
                const view = navBtn.dataset.view;
                this.navigateToView(view);
                return;
            }
            
            // Theme toggle
            if (e.target.id === 'theme-toggle' || e.target.closest('#theme-toggle')) {
                this.toggleTheme();
                return;
            }
            
            // Density toggle
            if (e.target.id === 'density-toggle' || e.target.closest('#density-toggle')) {
                this.toggleDensity();
                return;
            }
            
            // Auth button
            if (e.target.id === 'auth-btn') {
                this.handleAuthClick();
                return;
            }
            
            // Footer action buttons
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                this.handleAction(action);
                return;
            }
            
            // ESC key to close modals
            if (e.target.classList.contains('modal')) {
                if (e.target === e.currentTarget) {
                    e.target.classList.add('hidden');
                    e.target.classList.remove('active');
                }
            }
        });
        
        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active:not(.hidden)');
                if (activeModal) {
                    activeModal.classList.add('hidden');
                    activeModal.classList.remove('active');
                }
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
        
        // Listen for equipment selection
        on('equipment/select', (equipmentId) => {
            this.showEquipmentDetail(equipmentId);
        });
        
        // Listen for keyboard help request
        on('keyboard/help', () => {
            this.showKeyboardHelp();
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
        // Don't clear main content - just show loading in the equipment list
        const equipmentList = getById(DOM_IDS.EQUIPMENT_LIST);
        if (equipmentList) {
            showSkeletonLoading(equipmentList, {
                type: 'cards',
                count: 6,
                clear: false  // Don't clear existing HTML
            });
        }
        
        // Update status bar
        const statusBar = getById('status-bar');
        if (statusBar) {
            statusBar.textContent = 'Loading application...';
            statusBar.classList.add('loading');
        }
    }
    
    /**
     * Hide app loading state
     */
    hideAppLoading() {
        const equipmentList = getById(DOM_IDS.EQUIPMENT_LIST);
        if (equipmentList) {
            hideSkeletonLoading(equipmentList);
        }
        
        // Update status bar
        const statusBar = getById('status-bar');
        if (statusBar) {
            statusBar.textContent = 'Ready';
            statusBar.classList.remove('loading');
        }
    }
    
    /**
     * Toggle theme
     */
    toggleTheme() {
        const currentTheme = getState().theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.body.dataset.theme = newTheme;
        setState({ theme: newTheme });
        storage.set(STORAGE_KEYS.THEME, newTheme);
        
        // Update icon
        const themeIcon = document.querySelector('#theme-toggle .theme-icon');
        if (themeIcon) {
            themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
        
        announce(`Switched to ${newTheme} theme`);
    }
    
    /**
     * Toggle density
     */
    toggleDensity() {
        const currentDensity = getState().density || 'comfortable';
        const newDensity = currentDensity === 'comfortable' ? 'compact' : 'comfortable';
        
        document.body.dataset.density = newDensity;
        setState({ density: newDensity });
        storage.set(STORAGE_KEYS.DENSITY, newDensity);
        
        announce(`Switched to ${newDensity} view`);
    }
    
    /**
     * Handle auth button click
     */
    handleAuthClick() {
        const user = getCurrentUser();
        if (user.isAuthenticated) {
            // Logout
            emit(EVT.AUTH_LOGOUT);
            showSuccess('Logged out successfully');
        } else {
            // Show auth modal
            this.showAuthModal();
        }
    }
    
    /**
     * Show auth modal
     */
    showAuthModal() {
        const modal = getById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
            
            // Focus first input
            const firstInput = modal.querySelector('input');
            if (firstInput) firstInput.focus();
        }
    }
    
    /**
     * Show keyboard help modal
     */
    showKeyboardHelp() {
        const modal = getById('keyboard-help-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }
    }
    
    /**
     * Show equipment detail modal
     */
    showEquipmentDetail(equipmentId) {
        try {
            console.log('Opening equipment detail for:', equipmentId);
            
            const state = getState();
            const equipment = state.equipment.equipment.find(e => e.id === equipmentId);
            
            if (!equipment) {
                showError('Equipment not found');
                console.error('Equipment not found with ID:', equipmentId);
                return;
            }
            
            const modal = getById('equipment-modal');
            if (!modal) {
                console.error('Modal element not found');
                return;
            }
            
            // Format settings display
            let settingsHtml = 'No settings saved yet';
            if (equipment.settings) {
                if (typeof equipment.settings === 'object') {
                    const settingsList = [];
                    if (equipment.settings.automatic !== undefined) {
                        settingsList.push(`Automatic: ${equipment.settings.automatic ? 'Yes' : 'No'}`);
                    }
                    if (equipment.settings.note) {
                        settingsList.push(`Note: ${equipment.settings.note}`);
                    }
                    if (equipment.settings.weight) {
                        settingsList.push(`Weight: ${equipment.settings.weight}`);
                    }
                    if (equipment.settings.reps) {
                        settingsList.push(`Reps: ${equipment.settings.reps}`);
                    }
                    if (equipment.settings.seat) {
                        settingsList.push(`Seat: ${equipment.settings.seat}`);
                    }
                    settingsHtml = settingsList.length > 0 ? settingsList.join('<br>') : 'No specific settings';
                } else {
                    settingsHtml = equipment.settings;
                }
            }
            
            // Format type display
            const typeDisplay = equipment.type ? equipment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
            
            // Format pattern display
            const patternDisplay = equipment.pattern ? equipment.pattern.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
            
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div class="modal-header">
                        <h2>${equipment.name}</h2>
                        <button class="modal-close" data-action="close-equipment-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="equipment-detail-info">
                            <p><strong>Zone:</strong> ${equipment.zone} - ${state.equipment.metadata?.zones?.[equipment.zone] || ''}</p>
                            <p><strong>Type:</strong> ${typeDisplay}</p>
                            <p><strong>Movement Pattern:</strong> ${patternDisplay}</p>
                            <p><strong>Primary Muscles:</strong> ${(equipment.muscles?.primary || []).join(', ')}</p>
                            <p><strong>Secondary Muscles:</strong> ${(equipment.muscles?.secondary || []).join(', ')}</p>
                        </div>
                        <div class="equipment-settings">
                            <h3>Equipment Settings</h3>
                            <p>${settingsHtml}</p>
                        </div>
                        ${equipment.programming ? `
                        <div class="equipment-programming">
                            <h3>Programming Recommendations</h3>
                            ${equipment.programming.strength ? `<p><strong>Strength:</strong> ${equipment.programming.strength}</p>` : ''}
                            ${equipment.programming.hypertrophy ? `<p><strong>Hypertrophy:</strong> ${equipment.programming.hypertrophy}</p>` : ''}
                            ${equipment.programming.endurance ? `<p><strong>Endurance:</strong> ${equipment.programming.endurance}</p>` : ''}
                        </div>
                        ` : ''}
                    </div>
                `;
                
                // Add event listener to close button
                const closeBtn = modalContent.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        modal.classList.add('hidden');
                        modal.classList.remove('active');
                    });
                }
            }
            
            modal.classList.remove('hidden');
            modal.classList.add('active');
            
            console.log('Modal opened successfully');
            
        } catch (error) {
            console.error('Error showing equipment detail:', error);
            showError('Failed to show equipment details');
        }
    }
    
    /**
     * Handle footer action buttons
     */
    handleAction(action) {
        switch (action) {
            case 'export-data':
                this.exportData();
                break;
            case 'show-settings':
                this.navigateToView('settings');
                break;
            case 'show-keyboard-help':
                this.showKeyboardHelp();
                break;
            case 'show-about':
                this.showAbout();
                break;
            case 'close-auth-modal':
            case 'close-keyboard-help':
            case 'close-migration-modal':
            case 'close-equipment-modal':
                const modal = document.querySelector('.modal:not(.hidden), .modal-overlay:not(.hidden)');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('active');
                }
                break;
            case 'switch-to-login':
                getById('auth-register')?.classList.add('hidden');
                getById('auth-login')?.classList.remove('hidden');
                break;
            case 'switch-to-register':
                getById('auth-login')?.classList.add('hidden');
                getById('auth-register')?.classList.remove('hidden');
                break;
        }
    }
    
    /**
     * Export data
     */
    async exportData() {
        try {
            const state = getState();
            const exportData = {
                settings: state.settings,
                workoutLogs: state.workoutLogs,
                timestamp: new Date().toISOString(),
                version: '2.0.0'
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eos-fitness-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showSuccess('Data exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            showError('Failed to export data');
        }
    }
    
    /**
     * Show about modal
     */
    showAbout() {
        showToast('EOS Fitness Tracker v2.0 - Personal Equipment Settings Manager', { type: 'info', duration: 5000 });
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