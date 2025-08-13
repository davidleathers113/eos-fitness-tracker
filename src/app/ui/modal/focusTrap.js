/**
 * Focus Trap
 * Manages focus within modal dialogs for accessibility
 */

export class FocusTrap {
    constructor() {
        this.trapped = null;
        this.listener = null;
        this.previousFocus = null;
    }
    
    /**
     * Trap focus within an element
     * @param {Element} element - Container element
     */
    trap(element) {
        if (!element) return;
        
        // Release any existing trap
        this.release();
        
        this.trapped = element;
        this.previousFocus = document.activeElement;
        
        // Get focusable elements
        const focusableElements = this.getFocusableElements(element);
        
        if (focusableElements.length === 0) {
            // No focusable elements, focus the container
            element.setAttribute('tabindex', '-1');
            element.focus();
            return;
        }
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        // Focus first element
        firstFocusable.focus();
        
        // Setup keyboard listener
        this.listener = (e) => {
            if (e.key !== 'Tab') return;
            
            // Check if focus is still within the trap
            if (!element.contains(document.activeElement)) {
                e.preventDefault();
                firstFocusable.focus();
                return;
            }
            
            if (e.shiftKey) {
                // Shift + Tab (backwards)
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                // Tab (forwards)
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };
        
        document.addEventListener('keydown', this.listener);
        
        // Make elements outside the trap inert
        this.makeOthersInert(element);
    }
    
    /**
     * Release focus trap
     */
    release() {
        if (!this.trapped) return;
        
        // Remove keyboard listener
        if (this.listener) {
            document.removeEventListener('keydown', this.listener);
            this.listener = null;
        }
        
        // Remove inert from other elements
        this.removeInert();
        
        // Restore previous focus
        if (this.previousFocus && this.previousFocus.focus) {
            this.previousFocus.focus();
        }
        
        this.trapped = null;
        this.previousFocus = null;
    }
    
    /**
     * Get focusable elements within container
     * @param {Element} container - Container element
     * @returns {Array} Focusable elements
     */
    getFocusableElements(container) {
        if (!container) return [];
        
        const selector = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            'audio[controls]',
            'video[controls]',
            '[contenteditable]:not([contenteditable="false"])',
            'details>summary:first-of-type',
            'details'
        ].join(',');
        
        const elements = container.querySelectorAll(selector);
        
        // Filter out elements that are not visible
        return Array.from(elements).filter(el => {
            return this.isVisible(el) && this.isReachable(el);
        });
    }
    
    /**
     * Check if element is visible
     * @param {Element} element - Element to check
     * @returns {boolean} Is visible
     */
    isVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        
        if (style.opacity === '0' && !element.getAttribute('aria-hidden')) {
            return false;
        }
        
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if element is reachable (not hidden by parent)
     * @param {Element} element - Element to check
     * @returns {boolean} Is reachable
     */
    isReachable(element) {
        let current = element;
        
        while (current && current !== document.body) {
            if (current.getAttribute('aria-hidden') === 'true') {
                return false;
            }
            
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            
            current = current.parentElement;
        }
        
        return true;
    }
    
    /**
     * Make elements outside trap inert
     * @param {Element} trapElement - Trap container
     */
    makeOthersInert(trapElement) {
        // Find all top-level containers
        const topLevelElements = document.body.children;
        
        Array.from(topLevelElements).forEach(element => {
            if (element === trapElement || trapElement.contains(element)) {
                return;
            }
            
            // Skip if already has inert attribute
            if (element.hasAttribute('data-focus-trap-inert')) {
                return;
            }
            
            // Store original aria-hidden value
            const originalAriaHidden = element.getAttribute('aria-hidden');
            if (originalAriaHidden) {
                element.setAttribute('data-original-aria-hidden', originalAriaHidden);
            }
            
            // Make inert
            element.setAttribute('aria-hidden', 'true');
            element.setAttribute('data-focus-trap-inert', 'true');
            
            // Use inert attribute if supported
            if ('inert' in element) {
                element.inert = true;
            }
        });
    }
    
    /**
     * Remove inert from elements
     */
    removeInert() {
        const inertElements = document.querySelectorAll('[data-focus-trap-inert]');
        
        inertElements.forEach(element => {
            // Restore original aria-hidden
            const originalAriaHidden = element.getAttribute('data-original-aria-hidden');
            if (originalAriaHidden) {
                element.setAttribute('aria-hidden', originalAriaHidden);
                element.removeAttribute('data-original-aria-hidden');
            } else {
                element.removeAttribute('aria-hidden');
            }
            
            // Remove inert markers
            element.removeAttribute('data-focus-trap-inert');
            
            // Remove inert attribute if supported
            if ('inert' in element) {
                element.inert = false;
            }
        });
    }
    
    /**
     * Move focus to next focusable element
     * @param {boolean} reverse - Move backwards
     */
    moveFocus(reverse = false) {
        if (!this.trapped) return;
        
        const focusableElements = this.getFocusableElements(this.trapped);
        if (focusableElements.length === 0) return;
        
        const currentIndex = focusableElements.indexOf(document.activeElement);
        let nextIndex;
        
        if (reverse) {
            nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
        } else {
            nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
        }
        
        focusableElements[nextIndex].focus();
    }
}