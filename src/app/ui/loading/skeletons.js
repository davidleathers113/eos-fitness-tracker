/**
 * Skeleton Loading Components
 * Provides skeleton loading states for better UX
 */

import { LIMITS, CSS_CLASSES } from '../../core/constants.js';
import { createElement } from '../../core/dom.js';

/**
 * Create a skeleton card element
 * @param {Object} options - Skeleton options
 * @returns {Element} Skeleton card element
 */
export function createSkeletonCard(options = {}) {
    const {
        showHeader = true,
        showBadge = true,
        showText = true,
        showActions = true,
        textLines = 3,
        actionButtons = 3
    } = options;
    
    const card = createElement('div', {
        className: 'skeleton-card',
        'aria-busy': 'true',
        'aria-label': 'Loading content'
    });
    
    // Header with title and badge
    if (showHeader) {
        const header = createElement('div', {
            className: 'skeleton-header'
        });
        
        const title = createElement('div', {
            className: 'skeleton skeleton-title'
        });
        header.appendChild(title);
        
        if (showBadge) {
            const badge = createElement('div', {
                className: 'skeleton skeleton-badge'
            });
            header.appendChild(badge);
        }
        
        card.appendChild(header);
    }
    
    // Text lines
    if (showText && textLines > 0) {
        for (let i = 0; i < textLines; i++) {
            const widthClass = i === 0 ? 'medium' : i === 1 ? 'long' : 'short';
            const text = createElement('div', {
                className: `skeleton skeleton-text ${widthClass}`
            });
            card.appendChild(text);
        }
    }
    
    // Action buttons
    if (showActions && actionButtons > 0) {
        const actions = createElement('div', {
            className: 'skeleton-actions'
        });
        
        for (let i = 0; i < actionButtons; i++) {
            const btn = createElement('div', {
                className: 'skeleton skeleton-button'
            });
            actions.appendChild(btn);
        }
        
        card.appendChild(actions);
    }
    
    return card;
}

/**
 * Create a skeleton list item
 * @param {Object} options - Skeleton options
 * @returns {Element} Skeleton list item
 */
export function createSkeletonListItem(options = {}) {
    const {
        showAvatar = false,
        showTitle = true,
        showSubtitle = true,
        showAction = false
    } = options;
    
    const item = createElement('div', {
        className: 'skeleton-list-item',
        'aria-busy': 'true'
    });
    
    if (showAvatar) {
        const avatar = createElement('div', {
            className: 'skeleton skeleton-avatar'
        });
        item.appendChild(avatar);
    }
    
    const content = createElement('div', {
        className: 'skeleton-list-content'
    });
    
    if (showTitle) {
        const title = createElement('div', {
            className: 'skeleton skeleton-text medium'
        });
        content.appendChild(title);
    }
    
    if (showSubtitle) {
        const subtitle = createElement('div', {
            className: 'skeleton skeleton-text short'
        });
        content.appendChild(subtitle);
    }
    
    item.appendChild(content);
    
    if (showAction) {
        const action = createElement('div', {
            className: 'skeleton skeleton-button small'
        });
        item.appendChild(action);
    }
    
    return item;
}

/**
 * Create a skeleton form
 * @param {Object} options - Skeleton options
 * @returns {Element} Skeleton form
 */
export function createSkeletonForm(options = {}) {
    const {
        fields = 3,
        showLabels = true,
        showSubmit = true
    } = options;
    
    const form = createElement('div', {
        className: 'skeleton-form',
        'aria-busy': 'true'
    });
    
    for (let i = 0; i < fields; i++) {
        const field = createElement('div', {
            className: 'skeleton-field'
        });
        
        if (showLabels) {
            const label = createElement('div', {
                className: 'skeleton skeleton-label'
            });
            field.appendChild(label);
        }
        
        const input = createElement('div', {
            className: 'skeleton skeleton-input'
        });
        field.appendChild(input);
        
        form.appendChild(field);
    }
    
    if (showSubmit) {
        const submit = createElement('div', {
            className: 'skeleton skeleton-button primary'
        });
        form.appendChild(submit);
    }
    
    return form;
}

/**
 * Create a skeleton table
 * @param {Object} options - Skeleton options
 * @returns {Element} Skeleton table
 */
export function createSkeletonTable(options = {}) {
    const {
        rows = 5,
        columns = 4,
        showHeader = true
    } = options;
    
    const table = createElement('div', {
        className: 'skeleton-table',
        'aria-busy': 'true'
    });
    
    if (showHeader) {
        const header = createElement('div', {
            className: 'skeleton-table-header'
        });
        
        for (let i = 0; i < columns; i++) {
            const cell = createElement('div', {
                className: 'skeleton skeleton-text short'
            });
            header.appendChild(cell);
        }
        
        table.appendChild(header);
    }
    
    for (let i = 0; i < rows; i++) {
        const row = createElement('div', {
            className: 'skeleton-table-row'
        });
        
        for (let j = 0; j < columns; j++) {
            const widthClass = j === 0 ? 'medium' : j % 2 === 0 ? 'short' : 'long';
            const cell = createElement('div', {
                className: `skeleton skeleton-text ${widthClass}`
            });
            row.appendChild(cell);
        }
        
        table.appendChild(row);
    }
    
    return table;
}

/**
 * Show skeleton loading in a container
 * @param {Element} container - Container element
 * @param {Object} options - Loading options
 */
export function showSkeletonLoading(container, options = {}) {
    const {
        type = 'cards',
        count = LIMITS.SKELETON_COUNT,
        clear = true
    } = options;
    
    if (!container) return;
    
    // Clear existing content
    if (clear) {
        container.innerHTML = '';
    }
    
    // Create loading container
    const loadingContainer = createElement('div', {
        className: 'loading-container',
        'aria-busy': 'true',
        'aria-label': 'Loading content'
    });
    
    // Add skeletons based on type
    switch (type) {
        case 'cards':
            for (let i = 0; i < count; i++) {
                loadingContainer.appendChild(createSkeletonCard());
            }
            break;
            
        case 'list':
            for (let i = 0; i < count; i++) {
                loadingContainer.appendChild(createSkeletonListItem());
            }
            break;
            
        case 'form':
            loadingContainer.appendChild(createSkeletonForm(options));
            break;
            
        case 'table':
            loadingContainer.appendChild(createSkeletonTable(options));
            break;
            
        default:
            // Custom skeleton
            if (options.customSkeleton) {
                for (let i = 0; i < count; i++) {
                    loadingContainer.appendChild(options.customSkeleton());
                }
            }
    }
    
    container.appendChild(loadingContainer);
}

/**
 * Hide skeleton loading
 * @param {Element} container - Container element
 */
export function hideSkeletonLoading(container) {
    if (!container) return;
    
    const loadingContainer = container.querySelector('.loading-container');
    if (loadingContainer) {
        loadingContainer.remove();
    }
}

/**
 * Replace skeleton with content
 * @param {Element} container - Container element
 * @param {Element|string} content - Content to show
 * @param {Object} options - Replace options
 */
export function replaceSkeletonWithContent(container, content, options = {}) {
    const {
        animate = true,
        delay = 0
    } = options;
    
    if (!container) return;
    
    const replace = () => {
        if (animate) {
            // Fade out skeleton
            const loadingContainer = container.querySelector('.loading-container');
            if (loadingContainer) {
                loadingContainer.style.transition = 'opacity 300ms ease';
                loadingContainer.style.opacity = '0';
                
                setTimeout(() => {
                    // Remove skeleton
                    hideSkeletonLoading(container);
                    
                    // Add content
                    if (typeof content === 'string') {
                        container.innerHTML = content;
                    } else if (content instanceof Element) {
                        container.appendChild(content);
                    }
                    
                    // Fade in content
                    container.style.opacity = '0';
                    requestAnimationFrame(() => {
                        container.style.transition = 'opacity 300ms ease';
                        container.style.opacity = '1';
                    });
                }, 300);
            } else {
                // No skeleton to replace, just add content
                if (typeof content === 'string') {
                    container.innerHTML = content;
                } else if (content instanceof Element) {
                    container.appendChild(content);
                }
            }
        } else {
            // No animation
            hideSkeletonLoading(container);
            
            if (typeof content === 'string') {
                container.innerHTML = content;
            } else if (content instanceof Element) {
                container.appendChild(content);
            }
        }
    };
    
    if (delay > 0) {
        setTimeout(replace, delay);
    } else {
        replace();
    }
}

/**
 * Create shimmer effect for skeleton
 * @param {Element} element - Skeleton element
 */
export function addShimmerEffect(element) {
    if (!element) return;
    
    // Add shimmer class
    element.classList.add('skeleton-shimmer');
    
    // Create shimmer element
    const shimmer = createElement('div', {
        className: 'skeleton-shimmer-effect'
    });
    
    element.appendChild(shimmer);
}