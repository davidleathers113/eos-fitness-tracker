/**
 * Application Constants
 * Central location for all magic numbers, strings, and configuration
 */

// API Configuration
export const API = {
    BASE_URL: '/.netlify/functions',
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

// Storage Keys
export const STORAGE_KEYS = {
    MY_SETTINGS: 'mySettings',
    WORKOUT_LOGS: 'workoutLogs',
    FILTER_STATE: 'filterState',
    AUTH_TOKEN: 'authToken',
    USER_ID: 'userId',
    MIGRATION_COMPLETE: 'migrationComplete',
    THEME: 'theme',
    DENSITY: 'density',
    VIEW_STATE: 'viewState',
    OFFLINE_QUEUE: 'offlineQueue',
    LAST_SYNC: 'lastSync',
    USER_PREFERENCES: 'userPreferences'
};

// UI Limits
export const LIMITS = {
    SEARCH_MIN_LENGTH: 2,
    SEARCH_MAX_LENGTH: 100,
    SKELETON_COUNT: 6,
    TOAST_DURATION: 4000,
    TOAST_MAX_VISIBLE: 3,
    DEBOUNCE_WAIT: 150,
    THROTTLE_WAIT: 100,
    MAX_EQUIPMENT_NAME: 50,
    MAX_NOTES_LENGTH: 500,
    MAX_WORKOUT_NAME: 100,
    MAX_SUBSTITUTES: 10,
    MAX_SUGGESTIONS: 8,
    INCREMENTAL_RENDER_BATCH: 20,
    ANIMATION_DURATION: 300,
    MODAL_ANIMATION_DURATION: 200,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_WORKOUT_EXERCISES: 50,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    SYNC_INTERVAL: 5 * 60 * 1000 // 5 minutes
};

// Equipment Zones
export const ZONES = {
    ALL: 'all',
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
    E: 'E',
    F: 'F'
};

// Zone Descriptions
export const ZONE_INFO = {
    A: 'EGYM Smart Strength',
    B: 'Hammer Strength',
    C: 'Nautilus',
    D: 'Free Weights',
    E: 'Cardio Deck',
    F: 'Functional Training'
};

// Muscle Groups
export const MUSCLE_GROUPS = {
    ALL: 'all',
    CHEST: 'chest',
    BACK: 'back',
    SHOULDERS: 'shoulders',
    LEGS: 'legs',
    ARMS: 'arms',
    CORE: 'core',
    CARDIO: 'cardio'
};

// Movement Patterns
export const MOVEMENT_PATTERNS = {
    PUSH: 'push',
    PULL: 'pull',
    PRESS: 'press',
    ROW: 'row',
    FLY: 'fly',
    CURL: 'curl',
    EXTENSION: 'extension',
    SQUAT: 'squat',
    LUNGE: 'lunge',
    DEADLIFT: 'deadlift',
    ROTATION: 'rotation',
    ISOLATION: 'isolation',
    COMPOUND: 'compound'
};

// Equipment Types
export const EQUIPMENT_TYPES = {
    MACHINE: 'machine',
    BARBELL: 'barbell',
    DUMBBELL: 'dumbbell',
    CABLE: 'cable',
    BODYWEIGHT: 'bodyweight',
    CARDIO: 'cardio',
    FUNCTIONAL: 'functional',
    PLATE_LOADED: 'plate-loaded',
    SELECTORIZED: 'selectorized',
    SMART: 'smart'
};

// Themes
export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
};

// View Density
export const DENSITY = {
    COMFORTABLE: 'comfortable',
    COMPACT: 'compact'
};

// Views
export const VIEWS = {
    EQUIPMENT: 'equipment',
    WORKOUT: 'workout',
    SUBSTITUTES: 'substitutes',
    HISTORY: 'history',
    SETTINGS: 'settings'
};

// Notification Types
export const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
    SEARCH: '/',
    ESCAPE: 'Escape',
    HELP: '?',
    ZONE_A: '1',
    ZONE_B: '2',
    ZONE_C: '3',
    ZONE_D: '4',
    ZONE_E: '5',
    ZONE_F: '6',
    NEXT: 'ArrowRight',
    PREVIOUS: 'ArrowLeft',
    CONFIRM: 'Enter',
    CANCEL: 'Escape',
    SELECT_ALL: 'a',
    CLEAR: 'c',
    EXPORT: 'e',
    IMPORT: 'i',
    TOGGLE_THEME: 't',
    TOGGLE_DENSITY: 'd'
};

// DOM IDs
export const DOM_IDS = {
    // Main containers
    MAIN_CONTENT: 'main-content',
    EQUIPMENT_LIST: 'equipment-list',
    WORKOUT_CONTENT: 'workout-content',
    SUBSTITUTES_CONTENT: 'substitutes-content',
    HISTORY_CONTENT: 'history-content',
    SETTINGS_CONTENT: 'settings-content',
    
    // Search and filters
    SEARCH_INPUT: 'search-input',
    CLEAR_ALL_BTN: 'clear-all-btn',
    FILTER_CHIPS_CONTAINER: 'filter-chips-container',
    FILTER_CHIPS: 'filter-chips',
    
    // Modals
    EQUIPMENT_MODAL: 'equipment-modal',
    SUBSTITUTES_MODAL: 'substitutes-modal',
    AUTH_MODAL: 'auth-modal',
    MIGRATION_MODAL: 'migration-modal',
    KEYBOARD_HELP_MODAL: 'keyboard-help-modal',
    
    // Auth elements
    AUTH_BTN: 'auth-btn',
    USER_NAME: 'user-name',
    SYNC_STATUS: 'sync-status',
    
    // Forms
    REGISTER_FORM: 'register-form',
    LOGIN_FORM: 'login-form',
    USER_NAME_INPUT: 'user-name-input',
    USER_ID_INPUT: 'user-id-input',
    
    // UI controls
    THEME_TOGGLE: 'theme-toggle',
    DENSITY_TOGGLE: 'density-toggle',
    STATUS_BAR: 'status-bar',
    LAST_UPDATED: 'last-updated',
    NOTIFICATION_CONTAINER: 'notification-container',
    SR_ANNOUNCEMENTS: 'sr-announcements',
    
    // File input
    IMPORT_FILE_INPUT: 'import-file-input'
};

// CSS Classes
export const CSS_CLASSES = {
    // Visibility
    HIDDEN: 'hidden',
    ACTIVE: 'active',
    DISABLED: 'disabled',
    LOADING: 'loading',
    
    // States
    SELECTED: 'selected',
    FOCUSED: 'focused',
    ERROR: 'error',
    SUCCESS: 'success',
    WARNING: 'warning',
    
    // Components
    MODAL: 'modal',
    MODAL_OVERLAY: 'modal-overlay',
    MODAL_CONTENT: 'modal-content',
    TOAST: 'toast',
    SKELETON: 'skeleton',
    SKELETON_CARD: 'skeleton-card',
    
    // Equipment cards
    EQUIPMENT_CARD: 'equipment-card',
    EQUIPMENT_SELECTED: 'equipment-selected',
    
    // Themes
    DARK_THEME: 'dark-theme',
    LIGHT_THEME: 'light-theme',
    
    // Density
    COMPACT_VIEW: 'compact',
    COMFORTABLE_VIEW: 'comfortable',
    
    // Filters
    FILTER_BTN: 'filter-btn',
    ZONE_FILTER: 'zone-filter',
    MUSCLE_FILTER: 'muscle-filter',
    
    // Navigation
    NAV_BTN: 'nav-btn',
    VIEW: 'view',
    
    // Utilities
    SR_ONLY: 'sr-only',
    NO_SCROLL: 'no-scroll',
    OFFLINE: 'offline',
    ONLINE: 'online'
};

// Regular Expressions
export const REGEX = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    USER_ID: /^user-\d{10,}-[a-z0-9]{6,}$/,
    SAFE_STRING: /^[a-zA-Z0-9\s\-_.,!?()]+$/,
    NUMERIC: /^\d+$/,
    DECIMAL: /^\d+\.?\d*$/
};

// Error Messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network error. Please check your connection.',
    AUTH_REQUIRED: 'Authentication required. Please login.',
    INVALID_DATA: 'Invalid data format.',
    SAVE_FAILED: 'Failed to save. Changes stored locally.',
    LOAD_FAILED: 'Failed to load data.',
    MIGRATION_FAILED: 'Data migration failed. Please try again.',
    FILE_TOO_LARGE: 'File is too large. Maximum size is 5MB.',
    INVALID_FILE: 'Invalid file format. Please select a JSON file.',
    SESSION_EXPIRED: 'Your session has expired. Please login again.',
    QUOTA_EXCEEDED: 'Storage quota exceeded. Please clear some data.',
    GENERAL_ERROR: 'An error occurred. Please try again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    SETTINGS_SAVED: 'Settings saved successfully',
    WORKOUT_SAVED: 'Workout saved successfully',
    DATA_IMPORTED: 'Data imported successfully',
    DATA_EXPORTED: 'Data exported successfully',
    DATA_RESET: 'Data reset successfully',
    LOGIN_SUCCESS: 'Logged in successfully',
    LOGOUT_SUCCESS: 'Logged out successfully',
    REGISTRATION_SUCCESS: 'Account created successfully',
    MIGRATION_SUCCESS: 'Data migrated successfully'
};

// Default Values
export const DEFAULTS = {
    REST_TIME: 60,
    WORK_TIME: 45,
    TARGET_REPS: 12,
    TARGET_SETS: 3,
    WEIGHT_INCREMENT: 5,
    CARDIO_DURATION: 30,
    CARDIO_INTENSITY: 5
};