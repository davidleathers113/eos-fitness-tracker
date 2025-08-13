/**
 * Equipment View Module
 * Manages the equipment list display
 */

import { getState, subscribe } from '../../core/store.js';
import { on, EVT } from '../../core/events.js';
import { DOM_IDS } from '../../core/constants.js';
import { getById } from '../../core/dom.js';
import { showSkeletonLoading, hideSkeletonLoading } from '../../ui/loading/skeletons.js';

// Filter cache configuration
const filterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Initialize equipment view
 */
export function initEquipmentView() {
    // Subscribe to relevant events
    subscribe('equipment', renderEquipment);
    subscribe('filter', renderEquipment);
    
    on(EVT.EQUIPMENT_LOADED, renderEquipment);
    on(EVT.FILTERS_CHANGED, renderEquipment);
    
    // Initial render
    renderEquipment();
}

/**
 * Generate cache key for current filter state
 */
function getCacheKey(filter) {
    return JSON.stringify({
        zone: filter.zone || 'all',
        muscle: filter.muscle || 'all',
        search: filter.search || ''
    });
}

/**
 * Get cached filter results if available and not expired
 */
function getCachedResults(cacheKey) {
    const cached = filterCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.results;
    }
    // Remove expired cache entry
    if (cached) {
        filterCache.delete(cacheKey);
    }
    return null;
}

/**
 * Store filter results in cache
 */
function setCachedResults(cacheKey, results) {
    filterCache.set(cacheKey, {
        results: results,
        timestamp: Date.now()
    });
}

/**
 * Render equipment list
 */
function renderEquipment() {
    const container = getById(DOM_IDS.EQUIPMENT_LIST);
    if (!container) return;
    
    const state = getState();
    const equipment = state.equipment || {};
    const filter = state.filter || { zone: 'all', muscle: 'all', search: '' };
    
    if (!equipment.equipment || equipment.equipment.length === 0) {
        showSkeletonLoading(container, { type: 'cards', count: 6 });
        return;
    }
    
    // Check cache first
    const cacheKey = getCacheKey(filter);
    let filtered = getCachedResults(cacheKey);
    
    if (!filtered) {
        // Apply filters if not cached
        filtered = equipment.equipment;
        
        if (filter.zone && filter.zone !== 'all') {
            filtered = filtered.filter(item => item.zone === filter.zone);
        }
        
        if (filter.muscle && filter.muscle !== 'all') {
            filtered = filtered.filter(item => {
                // Equipment data has muscles.primary and muscles.secondary
                const muscles = [
                    ...(item.muscles?.primary || []),
                    ...(item.muscles?.secondary || [])
                ];
                return muscles.some(m => m.toLowerCase().includes(filter.muscle.toLowerCase()));
            });
        }
        
        if (filter.search) {
            const search = filter.search.toLowerCase();
            filtered = filtered.filter(item => {
                const muscles = [
                    ...(item.muscles?.primary || []),
                    ...(item.muscles?.secondary || [])
                ];
                return item.name.toLowerCase().includes(search) ||
                       item.zone.toLowerCase().includes(search) ||
                       muscles.some(m => m.toLowerCase().includes(search));
            });
        }
        
        // Store results in cache
        setCachedResults(cacheKey, filtered);
    }
    
    // Clear container
    hideSkeletonLoading(container);
    container.innerHTML = '';
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No equipment found matching your filters.</div>';
        return;
    }
    
    // Render equipment cards
    filtered.forEach(item => {
        const card = createEquipmentCard(item);
        container.appendChild(card);
    });
}

/**
 * Get appropriate icon for muscle group
 * @param {string} muscle - Muscle group name
 * @returns {string} SVG icon or emoji
 */
function getMuscleIcon(muscle) {
    const muscleNormalized = muscle.toLowerCase();
    
    // Define inline SVG icons for muscle groups
    const svgIcons = {
        // Chest - simple chest outline
        chest: '<svg class="muscle-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C8 2 4 4 4 8v5c0 2 1 3 2 3h12c1 0 2-1 2-3V8c0-4-4-6-8-6zm0 3c2 0 4 1 4 3v4H8V8c0-2 2-3 4-3z" fill="currentColor"/></svg>',
        
        // Back - spine/back view
        back: '<svg class="muscle-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2v20M8 6l4-2 4 2M8 12l4-2 4 2M8 18l4-2 4 2" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
        
        // Shoulders - shoulder outline
        shoulders: '<svg class="muscle-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M6 8c0-2 2-4 6-4s6 2 6 4v2c2 0 3 1 3 3s-1 3-3 3h-2v6h-8v-6H6c-2 0-3-1-3-3s1-3 3-3V8z" fill="currentColor"/></svg>',
        
        // Core/Abs - six-pack grid
        core: '<svg class="muscle-icon" viewBox="0 0 24 24" width="16" height="16"><rect x="8" y="6" width="3" height="3" fill="currentColor"/><rect x="13" y="6" width="3" height="3" fill="currentColor"/><rect x="8" y="11" width="3" height="3" fill="currentColor"/><rect x="13" y="11" width="3" height="3" fill="currentColor"/><rect x="8" y="16" width="3" height="3" fill="currentColor"/><rect x="13" y="16" width="3" height="3" fill="currentColor"/></svg>',
        
        // Glutes - hip/glute outline
        glutes: '<svg class="muscle-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 4c3 0 6 2 6 5v3c0 2-1 3-2 3h-1v5h-3v-5h-3v5H6v-5H5c-1 0-2-1-2-3V9c0-3 3-5 6-5h3z" fill="currentColor"/></svg>'
    };
    
    // Check for specific muscle groups and return appropriate icon
    if (muscleNormalized.includes('chest') || muscleNormalized.includes('pec')) {
        return svgIcons.chest;
    }
    
    if (muscleNormalized.includes('back') || 
        muscleNormalized.includes('lat') || 
        muscleNormalized.includes('rhomboid')) {
        return svgIcons.back;
    }
    
    if (muscleNormalized.includes('lower_back')) {
        return svgIcons.back;
    }
    
    if (muscleNormalized.includes('shoulder') || 
        muscleNormalized.includes('delt') || 
        muscleNormalized.includes('trap')) {
        return svgIcons.shoulders;
    }
    
    if (muscleNormalized.includes('core') || 
        muscleNormalized.includes('abs') || 
        muscleNormalized.includes('abdominal') || 
        muscleNormalized.includes('oblique')) {
        return svgIcons.core;
    }
    
    if (muscleNormalized.includes('glute')) {
        return svgIcons.glutes;
    }
    
    // Use emojis for arms and legs (these work well)
    if (muscleNormalized.includes('arm') || 
        muscleNormalized.includes('bicep') || 
        muscleNormalized.includes('tricep') || 
        muscleNormalized.includes('forearm')) {
        return '💪';
    }
    
    if (muscleNormalized.includes('leg') || 
        muscleNormalized.includes('quad') || 
        muscleNormalized.includes('hamstring') || 
        muscleNormalized.includes('calve') ||  // Matches both 'calves' and 'calf'
        muscleNormalized.includes('thigh') ||
        muscleNormalized.includes('gastrocnemius') ||
        muscleNormalized.includes('soleus') ||
        muscleNormalized.includes('tibialis')) {
        return '🦵';
    }
    
    // Hip/leg related muscles that should use leg emoji
    if (muscleNormalized.includes('adductor') || 
        muscleNormalized.includes('abductor') ||
        muscleNormalized.includes('hip') ||
        muscleNormalized.includes('tfl') ||
        muscleNormalized.includes('outer_thigh') ||
        muscleNormalized.includes('inner_thigh')) {
        return '🦵';
    }
    
    // Default to flexed arm for any unmatched muscle
    return '💪';
}

/**
 * Create equipment card element
 * @param {Object} equipment - Equipment data
 * @returns {Element} Card element
 */
function createEquipmentCard(equipment) {
    const card = document.createElement('div');
    card.className = 'equipment-card';
    card.dataset.equipmentId = equipment.id;
    
    card.innerHTML = `
        <div class="equipment-header">
            <h3 class="equipment-name">${equipment.name}</h3>
            <span class="zone-badge zone-${equipment.zone}">Zone ${equipment.zone}</span>
        </div>
        <div class="equipment-details">
            <div class="muscle-groups">
                ${[...(equipment.muscles?.primary || []), ...(equipment.muscles?.secondary || [])].map(m => {
                    const icon = getMuscleIcon(m);
                    // Handle both emoji and SVG icons with proper spacing
                    const iconHtml = icon.includes('<svg') ? icon : (icon ? icon + ' ' : '');
                    return `<span class="muscle-tag primary">${iconHtml}${m}</span>`;
                }).join('')}
            </div>
        </div>
        <div class="equipment-actions">
            <button class="btn-secondary" onclick="EOSApp.emit('equipment/select', '${equipment.id}')">
                View Details
            </button>
        </div>
    `;
    
    return card;
}

export { renderEquipment };