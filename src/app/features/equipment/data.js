/**
 * Equipment Data Utilities
 */

import { LIMITS } from '../../core/constants.js';

/**
 * Get default equipment data
 * @returns {Object} Default equipment structure
 */
export function getDefaultEquipmentData() {
    return {
        metadata: {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            totalEquipment: 0
        },
        equipment: []
    };
}

/**
 * Validate equipment database
 * @param {Object} data - Equipment data to validate
 * @returns {Object} Validation result
 */
export function validateEquipmentDatabase(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Equipment database must be an object'],
            cleaned: getDefaultEquipmentData()
        };
    }
    
    // Validate metadata
    if (!data.metadata || typeof data.metadata !== 'object') {
        errors.push('Missing or invalid metadata');
    }
    
    // Validate equipment array
    if (!Array.isArray(data.equipment)) {
        errors.push('Equipment must be an array');
    } else {
        // Validate each equipment item
        data.equipment.forEach((item, index) => {
            if (!item.id) {
                errors.push(`Equipment ${index} missing ID`);
            }
            if (!item.name) {
                errors.push(`Equipment ${index} missing name`);
            }
            if (item.name && item.name.length > LIMITS.MAX_EQUIPMENT_NAME) {
                errors.push(`Equipment ${index} name too long`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        cleaned: data
    };
}

/**
 * Format equipment type for display
 * @param {string} type - Equipment type
 * @returns {string} Formatted type
 */
export function formatEquipmentType(type) {
    if (!type) return '';
    
    const typeMap = {
        'plate-loaded': 'Plate-Loaded',
        'selectorized': 'Selectorized',
        'cable': 'Cable',
        'barbell': 'Barbell',
        'dumbbell': 'Dumbbell',
        'bodyweight': 'Bodyweight',
        'cardio': 'Cardio',
        'smart': 'Smart'
    };
    
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Format movement pattern for display
 * @param {string} pattern - Movement pattern
 * @returns {string} Formatted pattern
 */
export function formatPattern(pattern) {
    if (!pattern) return '';
    return pattern.charAt(0).toUpperCase() + pattern.slice(1).replace(/-/g, ' ');
}

/**
 * Safe muscle group extraction
 * @param {Object} equipment - Equipment object
 * @returns {Array} Muscle groups
 */
export function safeMuscles(equipment) {
    if (!equipment) return [];
    
    const muscles = [];
    
    if (equipment.primaryMuscles && Array.isArray(equipment.primaryMuscles)) {
        muscles.push(...equipment.primaryMuscles);
    }
    
    if (equipment.secondaryMuscles && Array.isArray(equipment.secondaryMuscles)) {
        muscles.push(...equipment.secondaryMuscles);
    }
    
    return [...new Set(muscles)]; // Remove duplicates
}

/**
 * Remove dangerous keys from equipment object
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
export function removeDangerousKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const cleaned = {};
    
    Object.keys(obj).forEach(key => {
        if (!dangerous.includes(key) && !key.startsWith('$')) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                cleaned[key] = removeDangerousKeys(obj[key]);
            } else {
                cleaned[key] = obj[key];
            }
        }
    });
    
    return cleaned;
}