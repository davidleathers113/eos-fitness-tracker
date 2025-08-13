/**
 * URL State Management
 * Synchronizes app state with URL for deep linking and history
 */

import { getState, setState } from '../core/store.js';
import { emit, EVT } from '../core/events.js';
import { STORAGE_KEYS, VIEWS } from '../core/constants.js';

class URLStateManager {
    constructor() {
        this.initialized = false;
        this.ignoreNextPopState = false;
    }
    
    /**
     * Initialize URL state management
     */
    init() {
        if (this.initialized) return;
        
        // Listen for browser back/forward
        window.addEventListener('popstate', (event) => {
            if (this.ignoreNextPopState) {
                this.ignoreNextPopState = false;
                return;
            }
            
            this.handlePopState(event);
        });
        
        // Read initial state from URL
        const initialState = this.readFromURL();
        if (initialState) {
            this.applyURLState(initialState);
        }
        
        this.initialized = true;
    }
    
    /**
     * Read state from URL
     * @returns {Object} URL state
     */
    readFromURL() {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash.slice(1); // Remove #
        
        const state = {};
        
        // Read view from hash or params
        if (hash && Object.values(VIEWS).includes(hash)) {
            state.view = hash;
        } else if (params.has('view')) {
            state.view = params.get('view');
        }
        
        // Read filter state
        if (params.has('zone')) {
            state.zone = params.get('zone');
        }
        
        if (params.has('muscle')) {
            state.muscle = params.get('muscle');
        }
        
        if (params.has('search')) {
            state.search = params.get('search');
        }
        
        // Read equipment ID for detail view
        if (params.has('equipment')) {
            state.equipmentId = params.get('equipment');
        }
        
        // Read workout ID
        if (params.has('workout')) {
            state.workoutId = params.get('workout');
        }
        
        // Read import flag
        if (params.has('import')) {
            state.import = params.get('import');
        }
        
        return Object.keys(state).length > 0 ? state : null;
    }
    
    /**
     * Update URL with current state
     * @param {Object} options - Update options
     */
    updateURL(options = {}) {
        const {
            replace = false,
            includeFilters = true,
            includeView = true
        } = options;
        
        const state = getState();
        const params = new URLSearchParams();
        
        // Add view
        if (includeView && state.currentView && state.currentView !== VIEWS.EQUIPMENT) {
            params.set('view', state.currentView);
        }
        
        // Add filters (only if on equipment view)
        if (includeFilters && state.currentView === VIEWS.EQUIPMENT) {
            if (state.filter.zone && state.filter.zone !== 'all') {
                params.set('zone', state.filter.zone);
            }
            
            if (state.filter.muscle && state.filter.muscle !== 'all') {
                params.set('muscle', state.filter.muscle);
            }
            
            if (state.filter.search) {
                params.set('search', state.filter.search);
            }
        }
        
        // Add selected equipment
        if (state.selectedEquipment) {
            params.set('equipment', state.selectedEquipment);
        }
        
        // Build URL
        let url = window.location.pathname;
        const paramString = params.toString();
        
        if (paramString) {
            url += '?' + paramString;
        }
        
        // Use hash for view if no params
        if (!paramString && state.currentView && state.currentView !== VIEWS.EQUIPMENT) {
            url += '#' + state.currentView;
        }
        
        // Update browser history
        if (replace) {
            window.history.replaceState({ appState: state }, '', url);
        } else {
            window.history.pushState({ appState: state }, '', url);
        }
        
        // Save to localStorage as backup
        this.saveToStorage(state);
    }
    
    /**
     * Apply state from URL
     * @param {Object} urlState - State from URL
     */
    applyURLState(urlState) {
        // Apply view
        if (urlState.view) {
            setState({ currentView: urlState.view });
            emit(EVT.VIEW_CHANGED, urlState.view);
        }
        
        // Apply filters
        if (urlState.zone || urlState.muscle || urlState.search) {
            const filter = {
                zone: urlState.zone || 'all',
                muscle: urlState.muscle || 'all',
                search: urlState.search || ''
            };
            
            setState({ filter });
            emit(EVT.FILTERS_CHANGED, filter);
        }
        
        // Apply selected equipment
        if (urlState.equipmentId) {
            setState({ selectedEquipment: urlState.equipmentId });
            emit(EVT.EQUIPMENT_SELECTED, urlState.equipmentId);
        }
        
        // Handle import
        if (urlState.import) {
            emit(EVT.DATA_IMPORT, { type: urlState.import });
        }
    }
    
    /**
     * Handle browser back/forward
     * @param {PopStateEvent} event - Popstate event
     */
    handlePopState(event) {
        if (event.state && event.state.appState) {
            // Restore from history state
            this.applyURLState(event.state.appState);
        } else {
            // Read from URL
            const urlState = this.readFromURL();
            if (urlState) {
                this.applyURLState(urlState);
            }
        }
    }
    
    /**
     * Save state to localStorage
     * @param {Object} state - State to save
     */
    saveToStorage(state) {
        try {
            const viewState = {
                view: state.currentView,
                filter: state.filter,
                timestamp: Date.now()
            };
            
            localStorage.setItem(STORAGE_KEYS.VIEW_STATE, JSON.stringify(viewState));
        } catch (error) {
            console.error('Failed to save view state:', error);
        }
    }
    
    /**
     * Read state from localStorage
     * @returns {Object|null} Stored state
     */
    readFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.VIEW_STATE);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to read view state:', error);
        }
        
        return null;
    }
    
    /**
     * Clear URL parameters
     * @param {boolean} keepView - Keep view in URL
     */
    clearURL(keepView = false) {
        const state = getState();
        let url = window.location.pathname;
        
        if (keepView && state.currentView && state.currentView !== VIEWS.EQUIPMENT) {
            url += '#' + state.currentView;
        }
        
        window.history.replaceState(null, '', url);
    }
    
    /**
     * Navigate to a view
     * @param {string} view - View name
     * @param {Object} params - Additional parameters
     */
    navigateTo(view, params = {}) {
        setState({ currentView: view });
        
        if (params.equipmentId) {
            setState({ selectedEquipment: params.equipmentId });
        }
        
        this.updateURL({ includeView: true });
        emit(EVT.VIEW_CHANGED, view);
    }
    
    /**
     * Go back in history
     */
    goBack() {
        window.history.back();
    }
    
    /**
     * Go forward in history
     */
    goForward() {
        window.history.forward();
    }
    
    /**
     * Get shareable URL for current state
     * @returns {string} Shareable URL
     */
    getShareableURL() {
        const state = getState();
        const url = new URL(window.location.href);
        
        // Clear existing params
        url.search = '';
        url.hash = '';
        
        // Add current state
        if (state.currentView && state.currentView !== VIEWS.EQUIPMENT) {
            url.searchParams.set('view', state.currentView);
        }
        
        if (state.currentView === VIEWS.EQUIPMENT) {
            if (state.filter.zone && state.filter.zone !== 'all') {
                url.searchParams.set('zone', state.filter.zone);
            }
            
            if (state.filter.muscle && state.filter.muscle !== 'all') {
                url.searchParams.set('muscle', state.filter.muscle);
            }
            
            if (state.selectedEquipment) {
                url.searchParams.set('equipment', state.selectedEquipment);
            }
        }
        
        return url.toString();
    }
}

// Export singleton instance
export const urlStateManager = new URLStateManager();

// Export convenience methods
export const initURLState = () => urlStateManager.init();
export const updateURL = (options) => urlStateManager.updateURL(options);
export const navigateTo = (view, params) => urlStateManager.navigateTo(view, params);
export const getShareableURL = () => urlStateManager.getShareableURL();