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

// ============================================
// Skeleton Loading Functions
// ============================================
function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    
    const header = document.createElement('div');
    header.className = 'skeleton-header';
    
    const title = document.createElement('div');
    title.className = 'skeleton skeleton-title';
    
    const badge = document.createElement('div');
    badge.className = 'skeleton skeleton-badge';
    
    header.appendChild(title);
    header.appendChild(badge);
    
    const text1 = document.createElement('div');
    text1.className = 'skeleton skeleton-text medium';
    
    const text2 = document.createElement('div');
    text2.className = 'skeleton skeleton-text long';
    
    const text3 = document.createElement('div');
    text3.className = 'skeleton skeleton-text short';
    
    const actions = document.createElement('div');
    actions.className = 'skeleton-actions';
    
    for (let i = 0; i < 3; i++) {
        const btn = document.createElement('div');
        btn.className = 'skeleton skeleton-button';
        actions.appendChild(btn);
    }
    
    card.appendChild(header);
    card.appendChild(text1);
    card.appendChild(text2);
    card.appendChild(text3);
    card.appendChild(actions);
    
    return card;
}

function showSkeletonLoading(container, count = 6) {
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create loading container
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    
    // Add skeleton cards
    for (let i = 0; i < count; i++) {
        loadingContainer.appendChild(createSkeletonCard());
    }
    
    container.appendChild(loadingContainer);
}

// ============================================
// Toast Notification System
// ============================================
let toastContainer = null;

function initToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

function showToast(message, type = 'info', duration = 4000) {
    const container = initToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    switch(type) {
        case 'success':
            icon.textContent = '✓';
            break;
        case 'error':
            icon.textContent = '⚠';
            break;
        case 'warning':
            icon.textContent = '!';
            break;
        default:
            icon.textContent = 'ℹ';
    }
    
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(text);
    
    container.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, duration);
    
    return toast;
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

// Modal Manager - Centralized modal control to prevent stacking
const modalManager = {
    activeModal: null,
    previousFocus: null,
    pendingAction: null,
    scrollPosition: 0,
    
    // Open a modal, closing any existing modal first
    open(modalId, options = {}) {
        // If same modal is already open, do nothing (idempotent)
        if (this.activeModal === modalId) {
            return;
        }
        
        // Close any existing modal first
        if (this.activeModal) {
            this.close(this.activeModal, { skipFocusRestore: true });
        }
        
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with id "${modalId}" not found`);
            return;
        }
        
        // Store current focus for restoration
        this.previousFocus = options.triggerElement || document.activeElement;
        
        // Lock body scroll
        this.scrollPosition = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scrollPosition}px`;
        document.body.style.width = '100%';
        document.body.classList.add('modal-open');
        
        // Make background inert
        const mainContent = document.getElementById('main-content');
        const mainHeader = document.querySelector('.main-header');
        const mainNav = document.querySelector('.main-nav');
        const mainFooter = document.querySelector('.main-footer');
        
        if (mainContent) mainContent.setAttribute('inert', '');
        if (mainHeader) mainHeader.setAttribute('inert', '');
        if (mainNav) mainNav.setAttribute('inert', '');
        if (mainFooter) mainFooter.setAttribute('inert', '');
        
        // Show the modal
        modal.classList.remove('hidden');
        modal.classList.add('active');
        this.activeModal = modalId;
        
        // Set ARIA attributes if provided
        if (options.labelledBy) {
            modal.setAttribute('aria-labelledby', options.labelledBy);
        }
        if (options.describedBy) {
            modal.setAttribute('aria-describedby', options.describedBy);
        }
        
        // Ensure modal has proper role
        if (!modal.hasAttribute('role')) {
            modal.setAttribute('role', 'dialog');
        }
        if (!modal.hasAttribute('aria-modal')) {
            modal.setAttribute('aria-modal', 'true');
        }
        
        // Set up focus trap
        if (typeof FocusTrap !== 'undefined' && FocusTrap.trapFocus) {
            FocusTrap.trapFocus(modal);
        }
        
        // Announce to screen reader
        const announcement = options.announcement || `${modalId.replace('-', ' ')} dialog opened`;
        announceToScreenReader(announcement);
        
        // Call open callback if provided
        if (options.onOpen) {
            options.onOpen(modal);
        }
    },
    
    // Close a specific modal or the active modal
    close(modalId, options = {}) {
        const targetId = modalId || this.activeModal;
        if (!targetId) return;
        
        const modal = document.getElementById(targetId);
        if (!modal) return;
        
        // Only proceed if this is the active modal
        if (targetId !== this.activeModal) {
            console.warn(`Attempted to close inactive modal: ${targetId}`);
            return;
        }
        
        // Hide the modal
        modal.classList.add('hidden');
        modal.classList.remove('active');
        
        // Release focus trap
        if (typeof FocusTrap !== 'undefined' && FocusTrap.releaseFocus) {
            FocusTrap.releaseFocus();
        }
        
        // Remove inert from background
        const mainContent = document.getElementById('main-content');
        const mainHeader = document.querySelector('.main-header');
        const mainNav = document.querySelector('.main-nav');
        const mainFooter = document.querySelector('.main-footer');
        
        if (mainContent) mainContent.removeAttribute('inert');
        if (mainHeader) mainHeader.removeAttribute('inert');
        if (mainNav) mainNav.removeAttribute('inert');
        if (mainFooter) mainFooter.removeAttribute('inert');
        
        // Unlock body scroll
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.classList.remove('modal-open');
        window.scrollTo(0, this.scrollPosition);
        
        // Restore focus if not skipped
        if (!options.skipFocusRestore && this.previousFocus) {
            try {
                if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
                    this.previousFocus.focus();
                }
            } catch (e) {
                console.warn('Could not restore focus:', e);
            }
        }
        
        // Clear state
        this.activeModal = null;
        this.previousFocus = null;
        
        // Announce to screen reader
        const announcement = options.announcement || `${targetId.replace('-', ' ')} dialog closed`;
        announceToScreenReader(announcement);
        
        // Call close callback if provided
        if (options.onClose) {
            options.onClose(modal);
        }
    },
    
    // Close the currently active modal
    closeActive() {
        if (this.activeModal) {
            this.close(this.activeModal);
        }
    },
    
    // Check if a modal is currently open
    isOpen(modalId) {
        return this.activeModal === modalId;
    },
    
    // Set pending action for auth flow
    setPendingAction(action, data = null) {
        this.pendingAction = { action, data, timestamp: Date.now() };
    },
    
    // Get and clear pending action
    consumePendingAction() {
        const action = this.pendingAction;
        this.pendingAction = null;
        return action;
    }
};

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
        // If any modal is open, close it first
        if (modalManager.activeModal) {
            event.preventDefault();
            modalManager.closeActive();
            return;
        }
        
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
            
            // Also focus the corresponding zone button for visual feedback
            const zoneButton = document.querySelector(`[data-zone="${zone}"]`);
            if (zoneButton) {
                zoneButton.focus();
            }
            
            announceToScreenReader(`Zone ${zone} selected`);
        }
    },
    
    // Show keyboard help modal
    showKeyboardHelp() {
        modalManager.open('keyboard-help-modal', {
            announcement: 'Keyboard shortcuts dialog opened',
            labelledBy: 'keyboard-help-title'
        });
    }
};

// Close keyboard help modal
function closeKeyboardHelp() {
    modalManager.close('keyboard-help-modal', {
        announcement: 'Keyboard shortcuts dialog closed'
    });
};

// Global keyboard event handler
function handleGlobalKeydown(event) {
    keyboardManager.handleShortcut(event);
}

// Skeleton card creator
function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.setAttribute('aria-hidden', 'true');
    
    card.innerHTML = `
        <div class="skeleton-header">
            <div class="skeleton-title"></div>
            <div class="skeleton-badge"></div>
        </div>
        <div class="skeleton-body">
            <div class="skeleton-type"></div>
            <div class="skeleton-muscles">
                <div class="skeleton-muscle-line"></div>
                <div class="skeleton-muscle-line"></div>
            </div>
            <div class="skeleton-settings"></div>
        </div>
        <div class="skeleton-actions">
            <div class="skeleton-button"></div>
            <div class="skeleton-button"></div>
            <div class="skeleton-button"></div>
        </div>
    `;
    
    return card;
}

// Incremental rendering manager for performance
const incrementalRenderer = {
    batchSize: 12,
    renderDelay: 16, // ~60fps
    
    async renderEquipmentBatches(equipment, container) {
        // Clear existing content
        container.innerHTML = '';
        
        if (equipment.length === 0) {
            const noResults = createEnhancedEmptyState();
            container.appendChild(noResults);
            return;
        }
        
        // Show skeleton loading for remaining items
        if (equipment.length > this.batchSize) {
            const skeletonFragment = document.createDocumentFragment();
            const skeletonCount = Math.min(equipment.length - this.batchSize, this.batchSize);
            
            for (let i = 0; i < skeletonCount; i++) {
                skeletonFragment.appendChild(createSkeletonCard());
            }
            container.appendChild(skeletonFragment);
        }
        
        // Render first batch synchronously for immediate feedback
        const firstBatch = equipment.slice(0, this.batchSize);
        const firstBatchFragment = document.createDocumentFragment();
        
        firstBatch.forEach(eq => {
            const card = createEquipmentCardSafe(eq);
            firstBatchFragment.appendChild(card);
        });
        
        // Insert first batch at the beginning
        container.insertBefore(firstBatchFragment, container.firstChild);
        
        // Render remaining batches asynchronously, replacing skeletons
        if (equipment.length > this.batchSize) {
            await this.renderRemainingBatches(equipment.slice(this.batchSize), container);
        }
    },
    
    async renderRemainingBatches(remainingEquipment, container) {
        let processedCount = 0;
        
        for (let i = 0; i < remainingEquipment.length; i += this.batchSize) {
            const batch = remainingEquipment.slice(i, i + this.batchSize);
            
            // Use requestIdleCallback for non-blocking rendering
            await new Promise(resolve => {
                const renderBatch = (deadline) => {
                    const fragment = document.createDocumentFragment();
                    
                    for (const equipment of batch) {
                        // Check if we still have time in this frame
                        if (deadline && deadline.timeRemaining() > 0) {
                            const card = createEquipmentCardSafe(equipment);
                            fragment.appendChild(card);
                        } else {
                            // If we run out of time, schedule the rest for later
                            break;
                        }
                    }
                    
                    if (fragment.children.length > 0) {
                        // Replace skeleton cards with real cards
                        const skeletons = container.querySelectorAll('.skeleton-card');
                        const fragmentChildren = Array.from(fragment.children);
                        
                        fragmentChildren.forEach((realCard, index) => {
                            if (skeletons[processedCount + index]) {
                                container.replaceChild(realCard, skeletons[processedCount + index]);
                            } else {
                                container.appendChild(realCard);
                            }
                        });
                        
                        processedCount += fragmentChildren.length;
                    }
                    
                    resolve();
                };
                
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(renderBatch);
                } else {
                    // Fallback for browsers without requestIdleCallback
                    setTimeout(() => renderBatch({ timeRemaining: () => 5 }), this.renderDelay);
                }
            });
        }
        
        // Remove any remaining skeleton cards
        const remainingSkeletons = container.querySelectorAll('.skeleton-card');
        remainingSkeletons.forEach(skeleton => skeleton.remove());
    }
};

// Sticky filters management
const stickyFiltersManager = {
    init() {
        const filtersSection = document.querySelector('.filters-section');
        if (!filtersSection) return;

        // Create a sentinel element above the filters to detect when it becomes sticky
        const sentinel = document.createElement('div');
        sentinel.className = 'sticky-sentinel';
        sentinel.style.height = '1px';
        sentinel.style.position = 'absolute';
        sentinel.style.top = '0';
        sentinel.style.left = '0';
        sentinel.style.width = '100%';
        
        // Insert sentinel before the filters section
        filtersSection.parentNode.insertBefore(sentinel, filtersSection);

        // Create intersection observer to detect when sentinel goes out of view
        const observer = new IntersectionObserver(
            ([entry]) => {
                // When sentinel is not intersecting, filters are sticky
                if (!entry.isIntersecting) {
                    filtersSection.classList.add('sticky');
                } else {
                    filtersSection.classList.remove('sticky');
                }
            },
            {
                rootMargin: '0px 0px -1px 0px', // Trigger just before leaving viewport
                threshold: 0
            }
        );

        observer.observe(sentinel);
    }
};

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

// Theme Manager
const themeManager = {
    currentTheme: 'auto',
    
    init() {
        // Get stored theme preference or default to auto
        this.currentTheme = localStorage.getItem('eos-theme-preference') || 'auto';
        
        // Apply theme immediately
        this.applyTheme(this.currentTheme);
        
        // Set up theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Update theme icon
        this.updateThemeIcon();
        
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (this.currentTheme === 'auto') {
                    this.updateThemeIcon();
                }
            });
        }
    },
    
    applyTheme(theme) {
        const html = document.documentElement;
        
        // Remove existing theme classes
        html.removeAttribute('data-theme');
        
        if (theme === 'light') {
            html.setAttribute('data-theme', 'light');
        } else if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        }
        // For 'auto', rely on CSS media query
        
        this.currentTheme = theme;
        localStorage.setItem('eos-theme-preference', theme);
    },
    
    toggleTheme() {
        const themes = ['auto', 'light', 'dark'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        
        this.applyTheme(nextTheme);
        this.updateThemeIcon();
        
        // Announce theme change
        const themeName = nextTheme === 'auto' ? 'automatic (follows system)' : nextTheme;
        announceToScreenReader(`Theme changed to ${themeName}`);
    },
    
    updateThemeIcon() {
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = themeToggle?.querySelector('.theme-icon');
        
        if (!themeIcon) return;
        
        let icon, label;
        
        if (this.currentTheme === 'light') {
            icon = '☀️';
            label = 'Switch to dark theme';
        } else if (this.currentTheme === 'dark') {
            icon = '🌙';
            label = 'Switch to automatic theme';
        } else { // auto
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            icon = prefersDark ? '🌓' : '🌞';
            label = 'Switch to light theme';
        }
        
        themeIcon.textContent = icon;
        themeToggle.setAttribute('aria-label', label);
        themeToggle.setAttribute('title', label);
    }
};

// Density Manager
const densityManager = {
    currentDensity: 'comfortable',
    
    init() {
        // Get stored density preference or default to comfortable
        this.currentDensity = localStorage.getItem('eos-density-preference') || 'comfortable';
        
        // Apply density immediately
        this.applyDensity(this.currentDensity);
        
        // Set up density toggle button
        const densityToggle = document.getElementById('density-toggle');
        if (densityToggle) {
            densityToggle.addEventListener('click', () => this.toggleDensity());
        }
        
        // Update density icon
        this.updateDensityIcon();
    },
    
    applyDensity(density) {
        const body = document.body;
        
        // Remove existing density classes
        body.classList.remove('density-comfortable', 'density-compact');
        
        // Add new density class
        body.classList.add(`density-${density}`);
        
        this.currentDensity = density;
        localStorage.setItem('eos-density-preference', density);
    },
    
    toggleDensity() {
        const newDensity = this.currentDensity === 'comfortable' ? 'compact' : 'comfortable';
        
        this.applyDensity(newDensity);
        this.updateDensityIcon();
        
        // Announce density change
        announceToScreenReader(`View density changed to ${newDensity}`);
    },
    
    updateDensityIcon() {
        const densityToggle = document.getElementById('density-toggle');
        const densityIcon = densityToggle?.querySelector('.density-icon');
        
        if (!densityIcon) return;
        
        let icon, label;
        
        if (this.currentDensity === 'comfortable') {
            icon = '⚏'; // comfortable spacing
            label = 'Switch to compact view';
        } else {
            icon = '⚌'; // compact spacing
            label = 'Switch to comfortable view';
        }
        
        densityIcon.textContent = icon;
        densityToggle.setAttribute('aria-label', label);
        densityToggle.setAttribute('title', label);
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

// Enhanced Empty State Creator
function createEnhancedEmptyState() {
    const container = document.createElement('div');
    container.className = 'no-results enhanced';
    
    // Icon
    const icon = document.createElement('span');
    icon.className = 'no-results-icon';
    icon.textContent = '🔍';
    icon.setAttribute('aria-hidden', 'true');
    
    // Title
    const title = document.createElement('h3');
    title.className = 'no-results-title';
    title.textContent = 'No Equipment Found';
    
    // Message
    const message = document.createElement('p');
    message.className = 'no-results-message';
    
    const hasActiveFilters = filterState.zone !== 'all' || 
                           filterState.muscle !== 'all' || 
                           filterState.search !== '';
    
    if (hasActiveFilters) {
        message.textContent = 'No equipment matches your current search and filter criteria. Try adjusting or clearing your filters to see more results.';
        
        // Active filters section
        const filtersSection = document.createElement('div');
        filtersSection.className = 'no-results-filters';
        
        const filtersTitle = document.createElement('h4');
        filtersTitle.textContent = 'Active Filters:';
        
        const filtersList = document.createElement('ul');
        filtersList.className = 'active-filters-list';
        
        if (filterState.zone !== 'all') {
            const zoneItem = document.createElement('li');
            zoneItem.textContent = `Zone: ${filterState.zone}`;
            filtersList.appendChild(zoneItem);
        }
        
        if (filterState.muscle !== 'all') {
            const muscleItem = document.createElement('li');
            muscleItem.textContent = `Muscle: ${filterState.muscle.charAt(0).toUpperCase() + filterState.muscle.slice(1)}`;
            filtersList.appendChild(muscleItem);
        }
        
        if (filterState.search) {
            const searchItem = document.createElement('li');
            searchItem.textContent = `Search: "${filterState.search}"`;
            filtersList.appendChild(searchItem);
        }
        
        filtersSection.appendChild(filtersTitle);
        filtersSection.appendChild(filtersList);
        container.appendChild(filtersSection);
        
    } else {
        message.textContent = 'It looks like there might be an issue loading the equipment database. Please try refreshing the page or check your internet connection.';
    }
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'no-results-actions';
    
    if (hasActiveFilters) {
        // Clear all filters button
        const clearAllBtn = document.createElement('button');
        clearAllBtn.className = 'no-results-btn';
        clearAllBtn.innerHTML = '<span>🗑️</span> Clear All Filters';
        clearAllBtn.addEventListener('click', () => {
            clearAllFilters();
            announceToScreenReader('All filters cleared, showing all equipment');
        });
        actions.appendChild(clearAllBtn);
        
        // Show all equipment button
        const showAllBtn = document.createElement('button');
        showAllBtn.className = 'no-results-btn secondary';
        showAllBtn.innerHTML = '<span>📋</span> Browse All Equipment';
        showAllBtn.addEventListener('click', () => {
            clearAllFilters();
            // Scroll to top smoothly
            document.querySelector('.main-content').scrollIntoView({ 
                behavior: 'smooth' 
            });
        });
        actions.appendChild(showAllBtn);
        
    } else {
        // Refresh page button
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'no-results-btn';
        refreshBtn.innerHTML = '<span>🔄</span> Refresh Page';
        refreshBtn.addEventListener('click', () => {
            window.location.reload();
        });
        actions.appendChild(refreshBtn);
    }
    
    // Assemble the empty state
    container.appendChild(icon);
    container.appendChild(title);
    container.appendChild(message);
    container.appendChild(actions);
    
    return container;
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
                
                // Don't auto-show modal if migration is in progress
                const isMigrationActive = modalManager.isOpen('migration-modal');
                
                if (isMigrationActive) {
                    // Set pending action and show inline message in migration modal
                    modalManager.setPendingAction('migration');
                    
                    // Update migration status to show auth needed
                    const statusEl = document.getElementById('migration-status');
                    if (statusEl) {
                        statusEl.textContent = 'Authentication required. Please log in to continue migration.';
                        statusEl.className = 'error';
                    }
                    
                    // Add a login button to migration modal if not already there
                    const migrationProgress = document.getElementById('migration-progress');
                    if (migrationProgress && !migrationProgress.querySelector('.auth-required-btn')) {
                        const authBtn = document.createElement('button');
                        authBtn.className = 'btn-primary auth-required-btn';
                        authBtn.textContent = 'Log in to Continue';
                        authBtn.onclick = () => {
                            modalManager.close('migration-modal', { skipFocusRestore: true });
                            showAuthenticationModal();
                        };
                        migrationProgress.appendChild(authBtn);
                    }
                } else if (typeof showAuthenticationModal === 'function') {
                    // Normal flow - show auth modal
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
    modalManager.open('auth-modal', {
        announcement: 'Authentication dialog opened',
        labelledBy: 'auth-title'
    });
    document.getElementById('auth-register').classList.remove('hidden');
    document.getElementById('auth-login').classList.add('hidden');
    document.getElementById('auth-loading').classList.add('hidden');
}

function hideAuthenticationModal() {
    modalManager.close('auth-modal', {
        announcement: 'Authentication dialog closed'
    });
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
    modalManager.open('migration-modal', {
        announcement: 'Data migration dialog opened',
        labelledBy: 'migration-title'
    });
    document.getElementById('migration-intro').classList.remove('hidden');
    document.getElementById('migration-progress').classList.add('hidden');
    document.getElementById('migration-complete').classList.add('hidden');
}

function hideMigrationModal() {
    modalManager.close('migration-modal', {
        announcement: 'Data migration dialog closed'
    });
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
        // Check if there's a pending migration
        const pendingAction = modalManager.consumePendingAction();
        
        if (pendingAction && pendingAction.action === 'migration') {
            // Close auth modal and restart migration
            hideAuthenticationModal();
            
            // Show migration modal and auto-start
            modalManager.open('migration-modal', {
                announcement: 'Resuming data migration',
                labelledBy: 'migration-title'
            });
            
            // Start migration after brief delay
            setTimeout(() => {
                startMigration();
            }, 500);
        } else {
            // Normal auth flow
            hideAuthenticationModal();
            updateUserStatus();
            await loadAllData(); // Reload data with authentication
        }
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
        // Check if there's a pending migration
        const pendingAction = modalManager.consumePendingAction();
        
        if (pendingAction && pendingAction.action === 'migration') {
            // Close auth modal and restart migration
            hideAuthenticationModal();
            
            // Show migration modal and auto-start
            modalManager.open('migration-modal', {
                announcement: 'Resuming data migration',
                labelledBy: 'migration-title'
            });
            
            // Start migration after brief delay
            setTimeout(() => {
                startMigration();
            }, 500);
        } else {
            // Normal auth flow
            hideAuthenticationModal();
            updateUserStatus();
            await loadAllData(); // Reload data with authentication
        }
    } else {
        // Show error and return to login form
        switchToLogin();
        showNotification(`Login failed: ${result.error}`, 'error');
    }
}

// Migration handlers
async function startMigration() {
    // Check if authenticated first
    if (!ApiClient.isAuthenticated) {
        // Store migration intent
        modalManager.setPendingAction('migration');
        
        // Add message to auth modal
        const authMessage = document.createElement('div');
        authMessage.id = 'auth-message';
        authMessage.className = 'auth-message info';
        authMessage.textContent = 'Please log in or create an account to migrate your local data to the cloud.';
        
        const authModal = document.getElementById('auth-modal');
        const modalContent = authModal?.querySelector('.modal-content');
        if (modalContent && !document.getElementById('auth-message')) {
            modalContent.insertBefore(authMessage, modalContent.firstChild.nextSibling);
        }
        
        // Close migration modal and show auth modal
        modalManager.close('migration-modal', { skipFocusRestore: true });
        modalManager.open('auth-modal', {
            announcement: 'Please log in to migrate your data to the cloud',
            labelledBy: 'auth-title'
        });
        
        return;
    }
    
    // If authenticated, proceed with migration
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
        // Store the currently focused element
        this.previousFocus = document.activeElement;
        this.activeModal = modal;
        
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
        // Use modalManager for all modal closing
        if (modalManager.activeModal) {
            event.preventDefault();
            modalManager.closeActive();
        } else {
            // Close any custom modals (like about dialog) that aren't managed
            const customModals = document.querySelectorAll('.modal[style*="block"]');
            customModals.forEach(modal => {
                modal.remove();
            });
        }
    }
}

// Screen reader announcements (using debounced version defined above)

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

// PWA Offline Queue System
class OfflineQueue {
    constructor() {
        this.queue = this.loadQueue();
        this.isProcessing = false;
    }
    
    loadQueue() {
        try {
            return JSON.parse(localStorage.getItem('eos-offline-queue') || '[]');
        } catch {
            return [];
        }
    }
    
    saveQueue() {
        try {
            localStorage.setItem('eos-offline-queue', JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }
    
    add(action) {
        const queueItem = {
            id: Date.now() + Math.random(),
            type: action.type,
            data: action.data,
            timestamp: new Date().toISOString(),
            retryCount: 0
        };
        
        this.queue.push(queueItem);
        this.saveQueue();
        
        // Try to process immediately if online
        if (navigator.onLine) {
            this.processQueue();
        }
        
        return queueItem.id;
    }
    
    remove(id) {
        this.queue = this.queue.filter(item => item.id !== id);
        this.saveQueue();
    }
    
    async processQueue() {
        if (this.isProcessing || !navigator.onLine || this.queue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        console.log(`Processing ${this.queue.length} queued actions...`);
        
        const itemsToProcess = [...this.queue];
        
        for (const item of itemsToProcess) {
            try {
                await this.processQueueItem(item);
                this.remove(item.id);
            } catch (error) {
                console.error('Failed to process queue item:', item, error);
                
                item.retryCount = (item.retryCount || 0) + 1;
                
                // Remove items that have failed too many times
                if (item.retryCount >= 3) {
                    console.warn('Removing failed queue item after 3 retries:', item);
                    this.remove(item.id);
                    showNotification(
                        'Some changes could not be synced and were discarded',
                        'error'
                    );
                }
            }
        }
        
        this.saveQueue();
        this.isProcessing = false;
        
        if (this.queue.length === 0) {
            showNotification('All changes synced successfully', 'success');
        }
    }
    
    async processQueueItem(item) {
        switch (item.type) {
            case 'save-settings':
                return await ApiClient.saveUserSettings(item.data);
            case 'save-workout':
                return await ApiClient.saveWorkoutLog(item.data);
            default:
                throw new Error(`Unknown queue item type: ${item.type}`);
        }
    }
    
    getQueueStatus() {
        return {
            count: this.queue.length,
            isProcessing: this.isProcessing,
            oldestItem: this.queue[0]?.timestamp
        };
    }
}

// Initialize offline queue
const offlineQueue = new OfflineQueue();

// PWA Install Prompt Handler
let deferredPrompt;
let installPromptShown = false;

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install prompt after user has used the app a bit
    setTimeout(() => {
        if (!installPromptShown && !window.matchMedia('(display-mode: standalone)').matches) {
            showInstallPrompt();
        }
    }, 30000); // Show after 30 seconds
});

window.addEventListener('appinstalled', (e) => {
    console.log('PWA was installed');
    showNotification('App installed successfully! 🎉', 'success');
    deferredPrompt = null;
});

function showInstallPrompt() {
    if (!deferredPrompt || installPromptShown) return;
    
    installPromptShown = true;
    
    showNotification(
        'Install EOS Fitness Tracker for a better experience',
        'info',
        10000,
        [{
            text: 'Install App',
            action: () => installPWA()
        }, {
            text: 'Maybe Later',
            action: () => {}
        }]
    );
}

async function installPWA() {
    if (!deferredPrompt) return;
    
    try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
    } catch (error) {
        console.error('Error showing install prompt:', error);
    }
    
    deferredPrompt = null;
}

// Enhanced offline detection with visual indicators
function updateOfflineStatus() {
    const syncStatus = document.getElementById('sync-status');
    const syncIndicator = syncStatus?.querySelector('.sync-indicator');
    const syncText = syncStatus?.querySelector('.sync-text');
    
    if (!syncStatus) return;
    
    const isOnline = navigator.onLine;
    const queueStatus = offlineQueue.getQueueStatus();
    
    if (isOnline) {
        syncIndicator.className = 'sync-indicator online';
        if (queueStatus.count > 0) {
            syncText.textContent = `Syncing (${queueStatus.count})`;
            syncStatus.title = 'Syncing pending changes...';
        } else {
            syncText.textContent = 'Online';
            syncStatus.title = 'Connected and up to date';
        }
    } else {
        syncIndicator.className = 'sync-indicator offline';
        if (queueStatus.count > 0) {
            syncText.textContent = `Offline (${queueStatus.count} pending)`;
            syncStatus.title = `${queueStatus.count} changes will sync when online`;
        } else {
            syncText.textContent = 'Offline';
            syncStatus.title = 'No internet connection';
        }
    }
    
    // Add/remove offline class to body for styling
    document.body.classList.toggle('is-offline', !isOnline);
}

// Listen for online/offline events
window.addEventListener('online', () => {
    ApiClient.updateNetworkStatus();
    updateUserStatus();
    updateOfflineStatus();
    
    // Process queued actions
    offlineQueue.processQueue();
    
    showNotification('Back online - data will sync', 'success');
});

window.addEventListener('offline', () => {
    ApiClient.updateNetworkStatus();
    updateUserStatus();
    updateOfflineStatus();
    showNotification('Offline mode - changes saved locally', 'warning');
});

// Periodically update offline status
setInterval(updateOfflineStatus, 5000);

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
    
    // Initialize theme and density managers
    themeManager.init();
    densityManager.init();
    
    // Show welcome toast on first visit with new design
    if (!localStorage.getItem('eos-design-welcomed')) {
        setTimeout(() => {
            showToast('Welcome! Experience the new premium design system.', 'success', 5000);
            localStorage.setItem('eos-design-welcomed', 'true');
        }, 2000);
    }
    
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
    updateOfflineStatus(); // Initialize offline status indicators
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
    
    // Enhanced search with debouncing and suggestions
    if (searchInput) {
        let suggestionContainer = null;
        
        // Create suggestions container
        function createSuggestionsContainer() {
            if (!suggestionContainer) {
                suggestionContainer = document.createElement('div');
                suggestionContainer.className = 'search-suggestions hidden';
                suggestionContainer.setAttribute('role', 'listbox');
                searchInput.parentElement.appendChild(suggestionContainer);
            }
            return suggestionContainer;
        }
        
        // Generate search suggestions
        function generateSuggestions(query) {
            if (!query || query.length < 2) return [];
            
            const suggestions = new Set();
            const lowerQuery = query.toLowerCase();
            
            // Add equipment names that match
            equipmentData.equipment.forEach(eq => {
                if (eq.name && eq.name.toLowerCase().includes(lowerQuery)) {
                    suggestions.add(eq.name);
                }
            });
            
            // Add muscle groups that match
            const muscleGroups = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'hamstrings', 'quadriceps', 'biceps', 'triceps'];
            muscleGroups.forEach(muscle => {
                if (muscle.includes(lowerQuery)) {
                    suggestions.add(muscle.charAt(0).toUpperCase() + muscle.slice(1));
                }
            });
            
            // Add zones that match
            Object.entries(equipmentData.metadata?.zones || {}).forEach(([zone, desc]) => {
                if (desc.toLowerCase().includes(lowerQuery)) {
                    suggestions.add(`Zone ${zone}: ${desc}`);
                }
            });
            
            return Array.from(suggestions).slice(0, 5); // Limit to 5 suggestions
        }
        
        // Show suggestions
        function showSuggestions(suggestions) {
            const container = createSuggestionsContainer();
            container.innerHTML = '';
            
            if (suggestions.length === 0) {
                container.classList.add('hidden');
                return;
            }
            
            suggestions.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.className = 'search-suggestion-item';
                item.setAttribute('role', 'option');
                item.setAttribute('tabindex', '-1');
                item.dataset.index = index;
                item.textContent = suggestion;
                
                item.addEventListener('click', () => {
                    searchInput.value = suggestion;
                    updateFilterState({ search: suggestion.toLowerCase() });
                    container.classList.add('hidden');
                });
                
                container.appendChild(item);
            });
            
            container.classList.remove('hidden');
        }
        
        const debouncedSearch = debounce(() => {
            const query = searchInput.value.toLowerCase();
            updateFilterState({ search: query });
            
            // Generate and show suggestions
            if (query.length >= 2) {
                const suggestions = generateSuggestions(query);
                showSuggestions(suggestions);
            } else if (suggestionContainer) {
                suggestionContainer.classList.add('hidden');
            }
        }, 150);
        
        searchInput.addEventListener('input', debouncedSearch);
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (suggestionContainer && !searchInput.contains(e.target) && !suggestionContainer.contains(e.target)) {
                suggestionContainer.classList.add('hidden');
            }
        });
        
        // Handle arrow key navigation in suggestions
        searchInput.addEventListener('keydown', (e) => {
            if (!suggestionContainer || suggestionContainer.classList.contains('hidden')) return;
            
            const items = suggestionContainer.querySelectorAll('.search-suggestion-item');
            let currentIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            } else if (e.key === 'Enter' && currentIndex >= 0) {
                e.preventDefault();
                items[currentIndex].click();
                return;
            } else {
                return;
            }
            
            items.forEach((item, index) => {
                item.classList.toggle('selected', index === currentIndex);
            });
        });
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
    
    // Initialize sticky filters
    stickyFiltersManager.init();
    
    // Keyboard help modal close button
    const keyboardHelpCloseBtn = document.querySelector('[data-action="close-keyboard-help"]');
    if (keyboardHelpCloseBtn) {
        keyboardHelpCloseBtn.addEventListener('click', closeKeyboardHelp);
    }
    
    // Keyboard help footer link
    const keyboardHelpLink = document.querySelector('[data-action="show-keyboard-help"]');
    if (keyboardHelpLink) {
        keyboardHelpLink.addEventListener('click', () => {
            keyboardManager.showKeyboardHelp();
        });
    }
    
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
async function displayEquipment() {
    const container = document.getElementById('equipment-list');
    if (!container) return;
    
    // Show skeleton loading if data not loaded yet
    if (!equipmentData.equipment) {
        showSkeletonLoading(container, 9);
        return;
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
    
    // Use incremental rendering for better performance
    await incrementalRenderer.renderEquipmentBatches(filtered, container);
    
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
            // Fallback to local storage and queue for sync
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
            
            // Queue for sync when online
            offlineQueue.add({
                type: 'save-workout',
                data: workout
            });
            
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
        
        // Fallback to localStorage and queue for sync
        try {
            workoutLogs.workouts.push(workout);
            localStorage.setItem('eosFitnessLogs', JSON.stringify(workoutLogs));
            
            // Queue for sync when online
            offlineQueue.add({
                type: 'save-workout',
                data: workout
            });
            
            showNotification('Workout saved locally - will sync when online', 'warning');
            currentWorkout = [];
            displayWorkoutBuilder();
        } catch (localError) {
            console.error('Local save also failed:', localError);
            showNotification('Failed to save workout', 'error');
        }
    }
}

// Enhanced settings save function with offline queue support
async function saveSettingsToCloud() {
    // Always save locally first
    saveSettingsToLocalBatched();
    
    if (!navigator.onLine) {
        // Queue for later sync when online
        offlineQueue.add({
            type: 'save-settings',
            data: mySettings
        });
        console.log('Settings queued for sync when online');
        return false;
    }
    
    try {
        const response = await ApiClient.saveSettings(mySettings);
        
        if (response.error) {
            console.warn('Cloud save failed:', response.message);
            // Queue for retry
            offlineQueue.add({
                type: 'save-settings',
                data: mySettings
            });
            return false;
        }
        
        showNotification('Settings synced to cloud', 'success');
        return true;
        
    } catch (error) {
        console.error('Error saving settings to cloud:', error);
        // Queue for retry when online
        offlineQueue.add({
            type: 'save-settings',
            data: mySettings
        });
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