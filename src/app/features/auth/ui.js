/**
 * Auth UI Module
 */

import { getCurrentUser } from '../../services/api/auth.js';
import { emit, on, EVT } from '../../core/events.js';

export function initAuthUI() {
    console.log('Auth UI initialized');
    
    updateUserStatus();
    
    on(EVT.AUTH_LOGIN, updateUserStatus);
    on(EVT.AUTH_LOGOUT, updateUserStatus);
}

function updateUserStatus() {
    const user = getCurrentUser();
    const authBtn = document.getElementById('auth-btn');
    
    if (authBtn) {
        authBtn.textContent = user.isAuthenticated ? 'Logout' : 'Login';
    }
}
