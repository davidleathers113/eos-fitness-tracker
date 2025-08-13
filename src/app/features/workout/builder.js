/**
 * Workout Builder Module
 */

import { getState } from '../../core/store.js';
import { on, EVT } from '../../core/events.js';

export function initWorkoutBuilder() {
    console.log('Workout builder initialized');
    
    on(EVT.VIEW_CHANGED, (view) => {
        if (view === 'workout') {
            displayWorkoutBuilder();
        }
    });
}

function displayWorkoutBuilder() {
    const container = document.getElementById('workout-content');
    if (!container) return;
    
    const state = getState();
    container.innerHTML = `
        <div class="workout-builder">
            <h2>Workout Builder</h2>
            <p>Current workout: ${state.currentWorkout.length} exercises</p>
        </div>
    `;
}
