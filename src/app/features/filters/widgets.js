/**
 * Filter Widgets Module
 */

import { getState, setState } from '../../core/store.js';
import { emit, EVT } from '../../core/events.js';
import { debounce } from '../../core/dom.js';

export function initFilters() {
    console.log('Filters initialized');
    
    // Setup filter event listeners
    document.addEventListener('click', (e) => {
        // Zone filters
        if (e.target.classList.contains('zone-filter')) {
            const zone = e.target.dataset.zone;
            updateFilter({ zone });
            updateActiveButton(e.target, '.zone-filter');
        }
        
        // Muscle filters
        if (e.target.classList.contains('muscle-filter')) {
            const muscle = e.target.dataset.muscle;
            updateFilter({ muscle });
            updateActiveButton(e.target, '.muscle-filter');
        }
        
        // Clear all button
        if (e.target.id === 'clear-all-btn') {
            clearAllFilters();
        }
    });
    
    // Search input with debouncing for better performance
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        // Create debounced search function (300ms delay)
        const debouncedSearch = debounce((value) => {
            updateFilter({ search: value });
        }, 300);
        
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
    }
}

function updateActiveButton(clickedBtn, selector) {
    // Remove active from all buttons in group
    document.querySelectorAll(selector).forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });
    
    // Add active to clicked button
    clickedBtn.classList.add('active');
    clickedBtn.setAttribute('aria-pressed', 'true');
}

function clearAllFilters() {
    // Clear search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reset filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.zone === 'all' || btn.dataset.muscle === 'all') {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        }
    });
    
    // Clear filter state
    setState({ filter: { zone: 'all', muscle: 'all', search: '' } });
    emit(EVT.FILTERS_CHANGED, { zone: 'all', muscle: 'all', search: '' });
}

function updateFilter(changes) {
    const state = getState();
    const newFilter = { ...state.filter, ...changes };
    setState({ filter: newFilter });
    emit(EVT.FILTERS_CHANGED, newFilter);
}
