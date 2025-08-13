/**
 * Equipment View Module
 * Manages the equipment list display
 */

import { getState, subscribe } from '../../core/store.js';
import { on, EVT } from '../../core/events.js';
import { DOM_IDS } from '../../core/constants.js';
import { getById } from '../../core/dom.js';
import { showSkeletonLoading, hideSkeletonLoading } from '../../ui/loading/skeletons.js';

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
 * Render equipment list
 */
function renderEquipment() {
    const container = getById(DOM_IDS.EQUIPMENT_LIST);
    if (!container) return;
    
    const state = getState();
    const { equipment, filter } = state;
    
    if (!equipment.equipment || equipment.equipment.length === 0) {
        showSkeletonLoading(container, { type: 'cards', count: 6 });
        return;
    }
    
    // Apply filters
    let filtered = equipment.equipment;
    
    if (filter.zone && filter.zone !== 'all') {
        filtered = filtered.filter(item => item.zone === filter.zone);
    }
    
    if (filter.muscle && filter.muscle !== 'all') {
        filtered = filtered.filter(item => {
            const muscles = [
                ...(item.primaryMuscles || []),
                ...(item.secondaryMuscles || [])
            ];
            return muscles.includes(filter.muscle);
        });
    }
    
    if (filter.search) {
        const search = filter.search.toLowerCase();
        filtered = filtered.filter(item => {
            return item.name.toLowerCase().includes(search) ||
                   item.zone.toLowerCase().includes(search) ||
                   (item.primaryMuscles || []).some(m => m.toLowerCase().includes(search));
        });
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
                ${(equipment.primaryMuscles || []).map(m => 
                    `<span class="muscle-tag primary">${m}</span>`
                ).join('')}
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