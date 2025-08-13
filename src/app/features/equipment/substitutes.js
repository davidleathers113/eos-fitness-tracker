/**
 * Equipment Substitutes Module
 */

import { getState } from '../../core/store.js';
import { on, EVT } from '../../core/events.js';

export function initSubstitutes() {
    console.log('Substitutes initialized');
    
    on(EVT.VIEW_CHANGED, (view) => {
        if (view === 'substitutes') {
            displaySubstitutes();
        }
    });
}

function displaySubstitutes() {
    const container = document.getElementById('substitutes-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="substitutes">
            <h2>Equipment Substitutes</h2>
            <p>Find alternative equipment for your exercises</p>
        </div>
    `;
}
