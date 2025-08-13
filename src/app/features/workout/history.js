/**
 * Workout History Module
 */

import { getState } from '../../core/store.js';
import { on, EVT } from '../../core/events.js';

export function initHistory() {
    console.log('History initialized');
    
    on(EVT.VIEW_CHANGED, (view) => {
        if (view === 'history') {
            displayHistory();
        }
    });
}

function displayHistory() {
    const container = document.getElementById('history-content');
    if (!container) return;
    
    const state = getState();
    const workouts = Object.keys(state.workoutLogs || {});
    
    container.innerHTML = `
        <div class="history">
            <h2>Workout History</h2>
            <p>Total workouts: ${workouts.length}</p>
        </div>
    `;
}
