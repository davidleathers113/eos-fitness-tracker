/**
 * Toast Notification System
 * Unified notification system with actions support
 */

import { emit, EVT } from '../../core/events.js';
import { LIMITS, CSS_CLASSES, NOTIFICATION_TYPES } from '../../core/constants.js';
import { createElement, addClass, removeClass } from '../../core/dom.js';

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.queue = [];
        this.maxVisible = LIMITS.TOAST_MAX_VISIBLE;
    }
    
    /**
     * Initialize toast container
     */
    init() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'false');
        document.body.appendChild(this.container);
    }
    
    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {Object} options - Toast options
     * @returns {string} Toast ID
     */
    show(message, options = {}) {
        const {
            type = NOTIFICATION_TYPES.INFO,
            duration = LIMITS.TOAST_DURATION,
            actions = [],
            persistent = false,
            icon = null,
            progress = false
        } = options;
        
        // Initialize container if needed
        if (!this.container) {
            this.init();
        }
        
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create toast element
        const toast = this.createToastElement(id, message, {
            type,
            icon,
            actions,
            progress
        });
        
        // Store toast info
        const toastInfo = {
            id,
            element: toast,
            type,
            message,
            duration,
            persistent,
            timer: null
        };
        
        this.toasts.set(id, toastInfo);
        
        // Check if we need to queue
        if (this.toasts.size > this.maxVisible) {
            this.queue.push(toastInfo);
            return id;
        }
        
        // Show toast
        this.showToast(toastInfo);
        
        // Emit event
        emit(EVT.TOAST_SHOWN, { id, message, type });
        
        return id;
    }
    
    /**
     * Create toast element
     * @param {string} id - Toast ID
     * @param {string} message - Message
     * @param {Object} options - Toast options
     * @returns {Element} Toast element
     */
    createToastElement(id, message, options) {
        const { type, icon, actions, progress } = options;
        
        const toast = createElement('div', {
            id,
            className: `toast ${type}`,
            role: 'alert'
        });
        
        // Add icon
        if (icon) {
            const iconEl = createElement('span', {
                className: 'toast-icon',
                'aria-hidden': 'true'
            }, icon);
            toast.appendChild(iconEl);
        } else {
            // Default icons based on type
            const defaultIcons = {
                [NOTIFICATION_TYPES.SUCCESS]: '✓',
                [NOTIFICATION_TYPES.ERROR]: '✕',
                [NOTIFICATION_TYPES.WARNING]: '⚠',
                [NOTIFICATION_TYPES.INFO]: 'ℹ'
            };
            
            if (defaultIcons[type]) {
                const iconEl = createElement('span', {
                    className: 'toast-icon',
                    'aria-hidden': 'true'
                }, defaultIcons[type]);
                toast.appendChild(iconEl);
            }
        }
        
        // Add message
        const messageEl = createElement('div', {
            className: 'toast-message'
        }, message);
        toast.appendChild(messageEl);
        
        // Add actions
        if (actions.length > 0) {
            const actionsEl = createElement('div', {
                className: 'toast-actions'
            });
            
            actions.forEach(action => {
                const button = createElement('button', {
                    className: 'toast-action',
                    type: 'button'
                }, action.text);
                
                button.addEventListener('click', () => {
                    if (action.action) {
                        action.action();
                    }
                    this.dismiss(id);
                });
                
                actionsEl.appendChild(button);
            });
            
            toast.appendChild(actionsEl);
        }
        
        // Add close button
        const closeBtn = createElement('button', {
            className: 'toast-close',
            type: 'button',
            'aria-label': 'Close notification'
        }, '×');
        
        closeBtn.addEventListener('click', () => this.dismiss(id));
        toast.appendChild(closeBtn);
        
        // Add progress bar if needed
        if (progress) {
            const progressBar = createElement('div', {
                className: 'toast-progress'
            });
            toast.appendChild(progressBar);
        }
        
        return toast;
    }
    
    /**
     * Show a toast
     * @param {Object} toastInfo - Toast info
     */
    showToast(toastInfo) {
        const { id, element, duration, persistent } = toastInfo;
        
        // Add to container
        this.container.appendChild(element);
        
        // Animate in
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        
        requestAnimationFrame(() => {
            element.style.transition = 'all 300ms ease';
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        });
        
        // Auto dismiss if not persistent
        if (!persistent && duration > 0) {
            // Add progress animation
            const progressBar = element.querySelector('.toast-progress');
            if (progressBar) {
                progressBar.style.transition = `width ${duration}ms linear`;
                progressBar.style.width = '0%';
            }
            
            toastInfo.timer = setTimeout(() => {
                this.dismiss(id);
            }, duration);
        }
    }
    
    /**
     * Dismiss a toast
     * @param {string} id - Toast ID
     */
    dismiss(id) {
        const toastInfo = this.toasts.get(id);
        if (!toastInfo) return;
        
        const { element, timer } = toastInfo;
        
        // Clear timer
        if (timer) {
            clearTimeout(timer);
        }
        
        // Animate out
        element.style.transition = 'all 300ms ease';
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            
            this.toasts.delete(id);
            
            // Show next in queue
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                this.showToast(next);
            }
        }, 300);
    }
    
    /**
     * Dismiss all toasts
     */
    dismissAll() {
        this.toasts.forEach((_, id) => {
            this.dismiss(id);
        });
        this.queue = [];
    }
    
    /**
     * Update a toast
     * @param {string} id - Toast ID
     * @param {Object} updates - Updates to apply
     */
    update(id, updates) {
        const toastInfo = this.toasts.get(id);
        if (!toastInfo) return;
        
        const { element } = toastInfo;
        
        if (updates.message) {
            const messageEl = element.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = updates.message;
            }
        }
        
        if (updates.type) {
            // Remove old type class
            Object.values(NOTIFICATION_TYPES).forEach(type => {
                removeClass(element, type);
            });
            // Add new type class
            addClass(element, updates.type);
        }
        
        if (updates.progress !== undefined) {
            const progressBar = element.querySelector('.toast-progress');
            if (progressBar) {
                progressBar.style.width = `${updates.progress}%`;
            }
        }
    }
}

// Create singleton instance
const toastManager = new ToastManager();

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {Object|string} options - Options or type string
 * @returns {string} Toast ID
 */
export function showToast(message, options = {}) {
    // Handle legacy API where second param is type string
    if (typeof options === 'string') {
        options = { type: options };
    }
    
    return toastManager.show(message, options);
}

/**
 * Show success toast
 * @param {string} message - Success message
 * @param {Object} options - Additional options
 * @returns {string} Toast ID
 */
export function showSuccess(message, options = {}) {
    return showToast(message, { ...options, type: NOTIFICATION_TYPES.SUCCESS });
}

/**
 * Show error toast
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {string} Toast ID
 */
export function showError(message, options = {}) {
    return showToast(message, { ...options, type: NOTIFICATION_TYPES.ERROR });
}

/**
 * Show warning toast
 * @param {string} message - Warning message
 * @param {Object} options - Additional options
 * @returns {string} Toast ID
 */
export function showWarning(message, options = {}) {
    return showToast(message, { ...options, type: NOTIFICATION_TYPES.WARNING });
}

/**
 * Show info toast
 * @param {string} message - Info message
 * @param {Object} options - Additional options
 * @returns {string} Toast ID
 */
export function showInfo(message, options = {}) {
    return showToast(message, { ...options, type: NOTIFICATION_TYPES.INFO });
}

/**
 * Dismiss a toast
 * @param {string} id - Toast ID
 */
export function dismissToast(id) {
    toastManager.dismiss(id);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
    toastManager.dismissAll();
}

/**
 * Update a toast
 * @param {string} id - Toast ID
 * @param {Object} updates - Updates to apply
 */
export function updateToast(id, updates) {
    toastManager.update(id, updates);
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => toastManager.init());
} else {
    toastManager.init();
}