/**
 * DOM Utilities
 * Safe DOM manipulation and helper functions
 */

import { LIMITS, CSS_CLASSES, DOM_IDS } from './constants.js';

/**
 * Safely query a DOM element
 * @param {string} selector - CSS selector
 * @param {Element} root - Root element to search within
 * @returns {Element|null} Found element or null
 */
export function $(selector, root = document) {
    try {
        return root.querySelector(selector);
    } catch (e) {
        console.error('Invalid selector:', selector);
        return null;
    }
}

/**
 * Safely query all DOM elements
 * @param {string} selector - CSS selector
 * @param {Element} root - Root element to search within
 * @returns {NodeList} Found elements
 */
export function $$(selector, root = document) {
    try {
        return root.querySelectorAll(selector);
    } catch (e) {
        console.error('Invalid selector:', selector);
        return [];
    }
}

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {Element|null} Found element or null
 */
export function getById(id) {
    return document.getElementById(id);
}

/**
 * Create element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set
 * @param {string|Element|Array} content - Content to append
 * @returns {Element} Created element
 */
export function createElement(tag, attrs = {}, content = null) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Add content
    if (content !== null) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (Array.isArray(content)) {
            content.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Element) {
                    element.appendChild(child);
                }
            });
        } else if (content instanceof Element) {
            element.appendChild(content);
        }
    }
    
    return element;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce function execution
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait = LIMITS.DEBOUNCE_WAIT) {
    let timeoutId;
    
    return function debounced(...args) {
        const context = this;
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(context, args);
        }, wait);
        
        // Return a cancel function
        debounced.cancel = () => clearTimeout(timeoutId);
        
        return timeoutId;
    };
}

/**
 * Throttle function execution
 * @param {Function} fn - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, wait = LIMITS.THROTTLE_WAIT) {
    let lastTime = 0;
    let timeoutId;
    
    return function throttled(...args) {
        const context = this;
        const now = Date.now();
        
        if (now - lastTime >= wait) {
            fn.apply(context, args);
            lastTime = now;
        } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                fn.apply(context, args);
                lastTime = Date.now();
            }, wait - (now - lastTime));
        }
    };
}

/**
 * Add class to element
 * @param {Element} element - Target element
 * @param {string|Array} className - Class name(s) to add
 */
export function addClass(element, className) {
    if (!element) return;
    
    if (Array.isArray(className)) {
        element.classList.add(...className);
    } else {
        element.classList.add(className);
    }
}

/**
 * Remove class from element
 * @param {Element} element - Target element
 * @param {string|Array} className - Class name(s) to remove
 */
export function removeClass(element, className) {
    if (!element) return;
    
    if (Array.isArray(className)) {
        element.classList.remove(...className);
    } else {
        element.classList.remove(className);
    }
}

/**
 * Toggle class on element
 * @param {Element} element - Target element
 * @param {string} className - Class name to toggle
 * @param {boolean} force - Force add/remove
 * @returns {boolean} Class presence after toggle
 */
export function toggleClass(element, className, force) {
    if (!element) return false;
    return element.classList.toggle(className, force);
}

/**
 * Check if element has class
 * @param {Element} element - Target element
 * @param {string} className - Class name to check
 * @returns {boolean} Has class
 */
export function hasClass(element, className) {
    if (!element) return false;
    return element.classList.contains(className);
}

/**
 * Show element(s)
 * @param {Element|NodeList|Array} elements - Element(s) to show
 */
export function show(elements) {
    const els = normalizeElements(elements);
    els.forEach(el => removeClass(el, CSS_CLASSES.HIDDEN));
}

/**
 * Hide element(s)
 * @param {Element|NodeList|Array} elements - Element(s) to hide
 */
export function hide(elements) {
    const els = normalizeElements(elements);
    els.forEach(el => addClass(el, CSS_CLASSES.HIDDEN));
}

/**
 * Enable element(s)
 * @param {Element|NodeList|Array} elements - Element(s) to enable
 */
export function enable(elements) {
    const els = normalizeElements(elements);
    els.forEach(el => {
        el.disabled = false;
        removeClass(el, CSS_CLASSES.DISABLED);
    });
}

/**
 * Disable element(s)
 * @param {Element|NodeList|Array} elements - Element(s) to disable
 */
export function disable(elements) {
    const els = normalizeElements(elements);
    els.forEach(el => {
        el.disabled = true;
        addClass(el, CSS_CLASSES.DISABLED);
    });
}

/**
 * Normalize elements to array
 * @param {Element|NodeList|Array} elements - Elements to normalize
 * @returns {Array} Array of elements
 */
function normalizeElements(elements) {
    if (!elements) return [];
    if (elements instanceof Element) return [elements];
    if (elements instanceof NodeList) return Array.from(elements);
    if (Array.isArray(elements)) return elements;
    return [];
}

/**
 * Format date for display
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            if (diffMinutes === 0) {
                return 'Just now';
            }
            return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        }
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

/**
 * Announce to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export function announce(message, priority = 'polite') {
    const container = getById(DOM_IDS.SR_ANNOUNCEMENTS);
    if (!container) return;
    
    // Clear previous announcement
    container.textContent = '';
    
    // Set new announcement after a brief delay
    setTimeout(() => {
        container.textContent = message;
        container.setAttribute('aria-live', priority);
    }, 100);
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Maximum wait time
 * @returns {Promise<Element>} Promise resolving to element
 */
export function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = $(selector);
        if (element) {
            return resolve(element);
        }
        
        const observer = new MutationObserver((mutations, obs) => {
            const element = $(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found after ${timeout}ms`));
        }, timeout);
    });
}

/**
 * Animate element with CSS transition
 * @param {Element} element - Element to animate
 * @param {Object} properties - CSS properties to animate
 * @param {number} duration - Animation duration in ms
 * @returns {Promise} Promise resolving when animation completes
 */
export function animate(element, properties, duration = LIMITS.ANIMATION_DURATION) {
    return new Promise(resolve => {
        if (!element) return resolve();
        
        // Set transition
        element.style.transition = `all ${duration}ms ease`;
        
        // Apply properties
        Object.entries(properties).forEach(([prop, value]) => {
            element.style[prop] = value;
        });
        
        // Clean up after animation
        setTimeout(() => {
            element.style.transition = '';
            resolve();
        }, duration);
    });
}

/**
 * Check if element is visible in viewport
 * @param {Element} element - Element to check
 * @returns {boolean} Is visible
 */
export function isInViewport(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Scroll element into view smoothly
 * @param {Element} element - Element to scroll to
 * @param {Object} options - Scroll options
 */
export function scrollIntoView(element, options = {}) {
    if (!element) return;
    
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
        ...options
    });
}

/**
 * Get form data as object
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} Form data
 */
export function getFormData(form) {
    if (!form) return {};
    
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    return data;
}

/**
 * Reset form fields
 * @param {HTMLFormElement} form - Form to reset
 */
export function resetForm(form) {
    if (!form) return;
    
    form.reset();
    
    // Clear any error states
    $$('.error', form).forEach(el => removeClass(el, 'error'));
    $$('.error-message', form).forEach(el => el.remove());
}