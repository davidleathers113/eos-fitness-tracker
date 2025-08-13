/**
 * API Client Core
 * Handles all HTTP requests with authentication, retry logic, and error handling
 */

import { API, STORAGE_KEYS, ERROR_MESSAGES } from '../../core/constants.js';
import { emit, EVT } from '../../core/events.js';

class ApiClient {
    constructor() {
        this.baseUrl = API.BASE_URL;
        this.timeout = API.TIMEOUT;
        this.retryAttempts = API.RETRY_ATTEMPTS;
        this.retryDelay = API.RETRY_DELAY;
        
        // Auth state
        this.userId = null;
        this.token = null;
        this.isAuthenticated = false;
        this.isOnline = navigator.onLine;
        
        // Request tracking
        this.activeRequests = new Set();
        
        // Initialize auth from storage
        this.initAuth();
    }
    
    /**
     * Initialize authentication from localStorage
     * @returns {boolean} Is authenticated
     */
    initAuth() {
        try {
            const storedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
            const storedToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
            
            if (storedUserId && storedToken && this.isTokenValid(storedToken)) {
                this.userId = storedUserId;
                this.token = storedToken;
                this.isAuthenticated = true;
                return true;
            }
        } catch (error) {
            console.error('Failed to initialize auth:', error);
        }
        
        this.clearAuth();
        return false;
    }
    
    /**
     * Set authentication credentials
     * @param {string} userId - User ID
     * @param {string} token - Auth token
     */
    setAuth(userId, token) {
        this.userId = userId;
        this.token = token;
        this.isAuthenticated = true;
        
        try {
            localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        } catch (error) {
            console.error('Failed to save auth:', error);
        }
    }
    
    /**
     * Clear authentication
     */
    clearAuth() {
        this.userId = null;
        this.token = null;
        this.isAuthenticated = false;
        
        try {
            localStorage.removeItem(STORAGE_KEYS.USER_ID);
            localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        } catch (error) {
            console.error('Failed to clear auth:', error);
        }
    }
    
    /**
     * Check if token is valid
     * @param {string} token - Token to validate
     * @returns {boolean} Is valid
     */
    isTokenValid(token) {
        if (!token) return false;
        
        try {
            // Basic JWT validation - check expiry
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            const payload = JSON.parse(atob(parts[1]));
            if (!payload.exp) return true; // No expiry
            
            return Date.now() < payload.exp * 1000;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Update network status
     */
    updateNetworkStatus() {
        const wasOnline = this.isOnline;
        this.isOnline = navigator.onLine;
        
        if (!wasOnline && this.isOnline) {
            emit(EVT.NETWORK_ONLINE);
        } else if (wasOnline && !this.isOnline) {
            emit(EVT.NETWORK_OFFLINE);
        }
    }
    
    /**
     * Make an API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            body = null,
            headers = {},
            retry = true,
            requireAuth = true
        } = options;
        
        // Check authentication
        if (requireAuth && !this.isAuthenticated) {
            return {
                error: true,
                message: ERROR_MESSAGES.AUTH_REQUIRED,
                code: 'AUTH_REQUIRED'
            };
        }
        
        // Check network status
        if (!this.isOnline) {
            return {
                error: true,
                message: ERROR_MESSAGES.NETWORK_ERROR,
                code: 'OFFLINE'
            };
        }
        
        const url = `${this.baseUrl}${endpoint}`;
        const requestId = `${method}:${endpoint}:${Date.now()}`;
        
        // Track request
        this.activeRequests.add(requestId);
        emit(EVT.NETWORK_REQUEST_START, { endpoint, method });
        
        const requestOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        // Add auth header
        if (this.token && requireAuth) {
            requestOptions.headers['Authorization'] = `Bearer ${this.token}`;
            requestOptions.headers['X-User-Id'] = this.userId;
        }
        
        // Add body
        if (body) {
            requestOptions.body = JSON.stringify(body);
        }
        
        let lastError;
        let attempts = retry ? this.retryAttempts : 1;
        
        while (attempts > 0) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                
                const response = await fetch(url, {
                    ...requestOptions,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                // Handle response
                const data = await response.json();
                
                if (!response.ok) {
                    // Handle specific error codes
                    if (response.status === 401) {
                        this.clearAuth();
                        emit(EVT.AUTH_TOKEN_EXPIRED);
                        return {
                            error: true,
                            message: ERROR_MESSAGES.SESSION_EXPIRED,
                            code: 'TOKEN_EXPIRED'
                        };
                    }
                    
                    throw new Error(data.message || `HTTP ${response.status}`);
                }
                
                // Success
                this.activeRequests.delete(requestId);
                emit(EVT.NETWORK_REQUEST_END, { endpoint, method, success: true });
                
                return data;
                
            } catch (error) {
                lastError = error;
                attempts--;
                
                if (attempts > 0) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    this.retryDelay = Math.min(this.retryDelay * 2, 10000); // Exponential backoff
                }
            }
        }
        
        // All attempts failed
        this.activeRequests.delete(requestId);
        emit(EVT.NETWORK_REQUEST_END, { endpoint, method, success: false, error: lastError });
        
        return {
            error: true,
            message: lastError.message || ERROR_MESSAGES.NETWORK_ERROR,
            code: 'REQUEST_FAILED'
        };
    }
    
    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }
    
    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} body - Request body
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body });
    }
    
    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} body - Request body
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body });
    }
    
    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
    
    /**
     * Check if any requests are active
     * @returns {boolean} Has active requests
     */
    hasActiveRequests() {
        return this.activeRequests.size > 0;
    }
    
    /**
     * Cancel all active requests
     */
    cancelAllRequests() {
        // In a real implementation, we'd track AbortControllers
        this.activeRequests.clear();
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Re-export commonly used methods
export const { initAuth, setAuth, clearAuth, isTokenValid, updateNetworkStatus } = apiClient;