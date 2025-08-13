/**
 * Modal Manager
 * Centralized modal control with focus management
 */

import { FocusTrap } from './focusTrap.js';
import { emit, EVT } from '../../core/events.js';
import { CSS_CLASSES, LIMITS } from '../../core/constants.js';
import { $, addClass, removeClass, hasClass } from '../../core/dom.js';

class ModalManager {
    constructor() {
        this.activeModals = new Map();
        this.modalStack = [];
        this.focusTrap = new FocusTrap();
        this.pendingAction = null;
        this.backgroundScrollPosition = 0;
    }
    
    /**
     * Initialize modal manager
     */
    init() {
        // Listen for escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalStack.length > 0) {
                const topModal = this.modalStack[this.modalStack.length - 1];
                if (topModal.closeable !== false) {
                    this.close(topModal.id);
                }
            }
        });
        
        // Listen for click outside
        document.addEventListener('click', (e) => {
            if (this.modalStack.length === 0) return;
            
            const topModal = this.modalStack[this.modalStack.length - 1];
            if (topModal.closeOnClickOutside && e.target.classList.contains(CSS_CLASSES.MODAL_OVERLAY)) {
                this.close(topModal.id);
            }
        });
    }
    
    /**
     * Open a modal
     * @param {string} id - Modal ID
     * @param {Object} options - Modal options
     * @returns {Object} Modal instance
     */
    open(id, options = {}) {
        const {
            content = null,
            title = '',
            closeable = true,
            closeOnClickOutside = true,
            closeOnEscape = true,
            onOpen = null,
            onClose = null,
            className = '',
            animation = true,
            zIndex = null
        } = options;
        
        // Check if already open
        if (this.activeModals.has(id)) {
            console.warn(`Modal ${id} is already open`);
            return this.activeModals.get(id);
        }
        
        // Get or create modal element
        let modalEl = $(id);
        if (!modalEl) {
            modalEl = this.createModal(id, { title, content, className });
        }
        
        // Store modal info
        const modal = {
            id,
            element: modalEl,
            closeable,
            closeOnClickOutside,
            closeOnEscape,
            onClose,
            animation,
            previousFocus: document.activeElement
        };
        
        this.activeModals.set(id, modal);
        this.modalStack.push(modal);
        
        // Lock background if first modal
        if (this.modalStack.length === 1) {
            this.lockBackground();
        }
        
        // Set z-index for stacking
        if (zIndex) {
            modalEl.style.zIndex = zIndex;
        } else {
            modalEl.style.zIndex = 1000 + (this.modalStack.length * 10);
        }
        
        // Show modal
        removeClass(modalEl, CSS_CLASSES.HIDDEN);
        
        if (animation) {
            // Trigger animation
            modalEl.style.opacity = '0';
            modalEl.style.transform = 'scale(0.9)';
            
            requestAnimationFrame(() => {
                modalEl.style.transition = `all ${LIMITS.MODAL_ANIMATION_DURATION}ms ease`;
                modalEl.style.opacity = '1';
                modalEl.style.transform = 'scale(1)';
            });
        }
        
        // Setup focus trap
        this.focusTrap.trap(modalEl);
        
        // Set initial focus
        const focusTarget = modalEl.querySelector('[autofocus]') ||
                           modalEl.querySelector('button, [href], input, select, textarea');
        if (focusTarget) {
            focusTarget.focus();
        }
        
        // Call onOpen callback
        if (onOpen) {
            onOpen(modal);
        }
        
        // Emit event
        emit(EVT.MODAL_OPENED, { id, modal });
        
        return modal;
    }
    
    /**
     * Close a modal
     * @param {string} id - Modal ID
     * @param {*} result - Result to return
     */
    close(id, result = null) {
        const modal = this.activeModals.get(id);
        if (!modal) return;
        
        // Remove from stack
        const stackIndex = this.modalStack.indexOf(modal);
        if (stackIndex > -1) {
            this.modalStack.splice(stackIndex, 1);
        }
        
        // Release focus trap
        this.focusTrap.release();
        
        // Hide modal
        const { element, animation, onClose, previousFocus } = modal;
        
        if (animation) {
            element.style.transition = `all ${LIMITS.MODAL_ANIMATION_DURATION}ms ease`;
            element.style.opacity = '0';
            element.style.transform = 'scale(0.9)';
            
            setTimeout(() => {
                addClass(element, CSS_CLASSES.HIDDEN);
                element.style.opacity = '';
                element.style.transform = '';
                element.style.transition = '';
            }, LIMITS.MODAL_ANIMATION_DURATION);
        } else {
            addClass(element, CSS_CLASSES.HIDDEN);
        }
        
        // Remove from active modals
        this.activeModals.delete(id);
        
        // Restore focus
        if (previousFocus && previousFocus.focus) {
            previousFocus.focus();
        }
        
        // Unlock background if no more modals
        if (this.modalStack.length === 0) {
            this.unlockBackground();
        } else {
            // Setup focus trap for next modal in stack
            const nextModal = this.modalStack[this.modalStack.length - 1];
            this.focusTrap.trap(nextModal.element);
        }
        
        // Call onClose callback
        if (onClose) {
            onClose(result);
        }
        
        // Emit event
        emit(EVT.MODAL_CLOSED, { id, result });
    }
    
    /**
     * Close all modals
     */
    closeAll() {
        // Close in reverse order
        const modals = [...this.modalStack].reverse();
        modals.forEach(modal => {
            this.close(modal.id);
        });
    }
    
    /**
     * Close active modal (top of stack)
     */
    closeActive() {
        if (this.modalStack.length > 0) {
            const topModal = this.modalStack[this.modalStack.length - 1];
            this.close(topModal.id);
        }
    }
    
    /**
     * Check if modal is open
     * @param {string} id - Modal ID
     * @returns {boolean} Is open
     */
    isOpen(id) {
        return this.activeModals.has(id);
    }
    
    /**
     * Get modal instance
     * @param {string} id - Modal ID
     * @returns {Object|null} Modal instance
     */
    getModal(id) {
        return this.activeModals.get(id) || null;
    }
    
    /**
     * Create modal element
     * @param {string} id - Modal ID
     * @param {Object} options - Creation options
     * @returns {Element} Modal element
     */
    createModal(id, options = {}) {
        const { title = '', content = '', className = '' } = options;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = `${CSS_CLASSES.MODAL_OVERLAY} ${CSS_CLASSES.HIDDEN} ${className}`;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        
        if (title) {
            overlay.setAttribute('aria-labelledby', `${id}-title`);
        }
        
        // Create content container
        const contentEl = document.createElement('div');
        contentEl.className = CSS_CLASSES.MODAL_CONTENT;
        
        // Add header if title provided
        if (title) {
            const header = document.createElement('div');
            header.className = 'modal-header';
            
            const titleEl = document.createElement('h2');
            titleEl.id = `${id}-title`;
            titleEl.textContent = title;
            header.appendChild(titleEl);
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.setAttribute('aria-label', 'Close dialog');
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = () => this.close(id);
            header.appendChild(closeBtn);
            
            contentEl.appendChild(header);
        }
        
        // Add body
        const body = document.createElement('div');
        body.className = 'modal-body';
        
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof Element) {
            body.appendChild(content);
        }
        
        contentEl.appendChild(body);
        overlay.appendChild(contentEl);
        
        // Add to document
        document.body.appendChild(overlay);
        
        return overlay;
    }
    
    /**
     * Lock background scrolling
     */
    lockBackground() {
        this.backgroundScrollPosition = window.pageYOffset;
        addClass(document.body, CSS_CLASSES.NO_SCROLL);
        document.body.style.top = `-${this.backgroundScrollPosition}px`;
    }
    
    /**
     * Unlock background scrolling
     */
    unlockBackground() {
        removeClass(document.body, CSS_CLASSES.NO_SCROLL);
        document.body.style.top = '';
        window.scrollTo(0, this.backgroundScrollPosition);
    }
    
    /**
     * Set pending action for after auth
     * @param {string} action - Action to perform
     */
    setPendingAction(action) {
        this.pendingAction = action;
    }
    
    /**
     * Get and clear pending action
     * @returns {string|null} Pending action
     */
    consumePendingAction() {
        const action = this.pendingAction;
        this.pendingAction = null;
        return action;
    }
}

// Export singleton instance
export const modalManager = new ModalManager();

// Export convenience methods
export const openModal = (id, options) => modalManager.open(id, options);
export const closeModal = (id, result) => modalManager.close(id, result);
export const closeAllModals = () => modalManager.closeAll();
export const isModalOpen = (id) => modalManager.isOpen(id);