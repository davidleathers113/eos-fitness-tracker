/**
 * Filter Widgets Module
 */

import { getState, setState } from '../../core/store.js';
import { emit, EVT } from '../../core/events.js';

export function initFilters() {
    console.log('Filters initialized');
    
    // Setup filter event listeners
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('zone-filter')) {
            const zone = e.target.dataset.zone;
            updateFilter({ zone });
        }
        if (e.target.classList.contains('muscle-filter')) {
            const muscle = e.target.dataset.muscle;
            updateFilter({ muscle });
        }
    });
    
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            updateFilter({ search: e.target.value });
        });
    }
}

function updateFilter(changes) {
    const state = getState();
    const newFilter = { ...state.filter, ...changes };
    setState({ filter: newFilter });
    emit(EVT.FILTERS_CHANGED, newFilter);
}
