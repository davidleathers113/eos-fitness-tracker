/**
 * Auth UI Module
 */

import { getCurrentUser, loginUser, registerUser, logout } from '../../services/api/auth.js';
import { emit, on, EVT } from '../../core/events.js';
import { showSuccess, showError } from '../../ui/notifications/toast.js';
import { getById } from '../../core/dom.js';

export function initAuthUI() {
    console.log('Auth UI initialized');
    
    updateUserStatus();
    setupAuthForms();
    
    on(EVT.AUTH_LOGIN, updateUserStatus);
    on(EVT.AUTH_LOGOUT, handleLogout);
}

function updateUserStatus() {
    const user = getCurrentUser();
    const authBtn = getById('auth-btn');
    const userName = getById('user-name');
    const syncStatus = getById('sync-status');
    
    if (authBtn) {
        authBtn.textContent = user.isAuthenticated ? 'Logout' : 'Login';
    }
    
    if (userName) {
        if (user.isAuthenticated && user.userName) {
            userName.textContent = user.userName;
            userName.classList.remove('hidden');
        } else {
            userName.classList.add('hidden');
        }
    }
    
    if (syncStatus) {
        const indicator = syncStatus.querySelector('.sync-indicator');
        const text = syncStatus.querySelector('.sync-text');
        if (user.isAuthenticated) {
            indicator?.classList.remove('offline');
            indicator?.classList.add('online');
            text.textContent = 'Synced';
        } else {
            indicator?.classList.remove('online');
            indicator?.classList.add('offline');
            text.textContent = 'Offline';
        }
    }
}

function setupAuthForms() {
    // Register form
    const registerForm = getById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const userName = formData.get('userName');
            
            if (!userName) {
                showError('Please enter your name');
                return;
            }
            
            showAuthLoading();
            const result = await registerUser(userName);
            hideAuthLoading();
            
            if (result.success) {
                showSuccess(`Welcome ${userName}! Your User ID is: ${result.userId}`);
                closeAuthModal();
                emit(EVT.AUTH_LOGIN);
            } else {
                showError(result.error || 'Registration failed');
            }
        });
    }
    
    // Login form
    const loginForm = getById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const userId = formData.get('userId');
            
            if (!userId) {
                showError('Please enter your User ID');
                return;
            }
            
            showAuthLoading();
            const result = await loginUser(userId);
            hideAuthLoading();
            
            if (result.success) {
                showSuccess(`Welcome back!`);
                closeAuthModal();
                emit(EVT.AUTH_LOGIN);
            } else {
                showError(result.error || 'Login failed');
            }
        });
    }
}

function showAuthLoading() {
    getById('auth-register')?.classList.add('hidden');
    getById('auth-login')?.classList.add('hidden');
    getById('auth-loading')?.classList.remove('hidden');
}

function hideAuthLoading() {
    getById('auth-loading')?.classList.add('hidden');
    getById('auth-register')?.classList.remove('hidden');
}

function closeAuthModal() {
    const modal = getById('auth-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function handleLogout() {
    const result = await logout();
    if (result.success) {
        showSuccess('Logged out successfully');
        updateUserStatus();
    }
}
