/**
 * Settings View Module
 */

import { getState } from '../../core/store.js';
import { on, EVT } from '../../core/events.js';

export function initSettingsView() {
    console.log('Settings view initialized');
    
    on(EVT.VIEW_CHANGED, (view) => {
        if (view === 'settings') {
            displaySettings();
        }
    });
}

function displaySettings() {
    const container = document.getElementById('settings-content');
    if (!container) return;
    
    container.innerHTML = `
        <div class="settings">
            <h2>Settings</h2>
            <p>User preferences and app settings</p>
        </div>
    `;
}
