// EOS Fitness Tracker Application - Security-Hardened Version

// Global state management
let equipmentData = {};
let mySettings = {};
let workoutLogs = {};
let currentWorkout = [];
let currentView = 'equipment';
let selectedEquipment = null;
let filterState = {
    zone: 'all',
    muscle: 'all',
    search: ''
};

// Utility: Debounce function for search performance
function debounce(fn, wait = 150) {
    let t; 
    return (...args) => { 
        clearTimeout(t); 
        t = setTimeout(() => fn(...args), wait); 
    };
}

// Utility: Safe muscle data extraction
function safeMuscles(equipment) {
    return {
        primary: Array.isArray(equipment?.muscles?.primary) ? equipment.muscles.primary : [],
        secondary: Array.isArray(equipment?.muscles?.secondary) ? equipment.muscles.secondary : []
    };
}

// Utility: Escape HTML for text content (backup if not using DOM methods)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Batched localStorage saves
let pendingSave = null;
function saveSettingsToLocalBatched() {
    if (pendingSave) return;
    pendingSave = requestIdleCallback?.(flush, { timeout: 1000 }) || setTimeout(flush, 250);
    function flush() {
        try {
            localStorage.setItem('eosFitnessSettings', JSON.stringify(mySettings));
            pendingSave = null;
        } catch (error) {
            console.error('Failed to save settings:', error);
            showNotification('Failed to save settings', 'error');
        }
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing EOS Fitness Tracker (Secure Version)...');
    await loadAllData();
    setupEventListeners();
    displayEquipment();
    updateUI();
});

// Data Loading Functions
async function loadAllData() {
    await Promise.all([
        loadEquipmentDatabase(),
        loadMySettings(),
        loadWorkoutLogs()
    ]);
}

async function loadEquipmentDatabase() {
    try {
        const response = await fetch('../database/equipment-database.json');
        if (response.ok) {
            const data = await response.json();
            // Validate equipment data structure
            if (validateEquipmentDatabase(data)) {
                equipmentData = data;
                console.log(`Loaded ${equipmentData.equipment.length} equipment items`);
            } else {
                throw new Error('Invalid equipment database structure');
            }
        } else {
            throw new Error('Equipment database not found');
        }
    } catch (error) {
        console.error('Error loading equipment database:', error);
        equipmentData = getDefaultEquipmentData();
        showNotification('Using default equipment data', 'warning');
    }
}

async function loadMySettings() {
    try {
        // First try localStorage
        const localSettings = localStorage.getItem('eosFitnessSettings');
        if (localSettings) {
            const parsed = JSON.parse(localSettings);
            if (validateSettings(parsed)) {
                mySettings = parsed;
            }
        }
        
        // Then try loading from file
        const response = await fetch('../database/my-settings.json');
        if (response.ok) {
            const fileSettings = await response.json();
            if (validateSettings(fileSettings)) {
                // Merge with local settings, preferring local
                mySettings = { ...fileSettings, ...mySettings };
            }
        }
    } catch (error) {
        console.log('Creating new settings file');
        mySettings = getDefaultSettings();
    }
    saveSettingsToLocalBatched();
}

async function loadWorkoutLogs() {
    try {
        const localLogs = localStorage.getItem('eosFitnessLogs');
        if (localLogs) {
            const parsed = JSON.parse(localLogs);
            if (validateWorkoutLogs(parsed)) {
                workoutLogs = parsed;
            }
        }
        
        const response = await fetch('../database/workout-logs.json');
        if (response.ok) {
            const fileLogs = await response.json();
            if (validateWorkoutLogs(fileLogs)) {
                workoutLogs = { ...fileLogs, ...workoutLogs };
            }
        }
    } catch (error) {
        console.log('Creating new workout logs');
        workoutLogs = getDefaultWorkoutLogs();
    }
}

// Validation Functions
function validateEquipmentDatabase(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.metadata || !Array.isArray(data.equipment)) return false;
    
    // Validate each equipment item
    return data.equipment.every(item => {
        return item.id && 
               typeof item.id === 'string' &&
               item.name && 
               typeof item.name === 'string' &&
               item.zone && 
               typeof item.zone === 'string' &&
               item.muscles && 
               Array.isArray(item.muscles.primary);
    });
}

function validateSettings(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Remove dangerous keys
    for (const key of ['__proto__', 'constructor', 'prototype']) {
        delete data[key];
    }
    
    return true; // Basic validation - extend as needed
}

function validateWorkoutLogs(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.workouts)) return false;
    
    // Remove dangerous keys
    for (const key of ['__proto__', 'constructor', 'prototype']) {
        delete data[key];
    }
    
    return true;
}

// Default Data Structures
function getDefaultEquipmentData() {
    return {
        metadata: {
            gym: "EOS Fitness Lutz",
            last_updated: new Date().toISOString(),
            version: "2.0",
            zones: {
                "A": "EGYM Smart Strength Area",
                "B": "Hammer Strength Plate-Loaded Area",
                "C": "Nautilus Selectorized Area",
                "D": "Free Weight Area",
                "E": "Cardio Deck",
                "F": "Functional Training Area"
            }
        },
        equipment: []
    };
}

function getDefaultSettings() {
    return {
        user: {
            name: "User",
            experience_level: "beginner",
            goals: [],
            typical_duration: 60
        },
        equipment_settings: {},
        preferences: {
            avoid: [],
            prefer: [],
            warm_up_time: 10,
            rest_between_sets: 90
        },
        quick_substitutes: {},
        last_updated: new Date().toISOString()
    };
}

function getDefaultWorkoutLogs() {
    return {
        workouts: [],
        stats: {
            total_workouts: 0,
            total_time_minutes: 0,
            favorite_equipment: [],
            average_workout_duration: 0
        },
        templates: [],
        last_updated: new Date().toISOString()
    };
}

// UI Setup and Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('[data-view]').forEach(button => {
        button.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            showView(view);
        });
    });
    
    // Search with debouncing
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        const debouncedSearch = debounce(() => {
            filterState.search = searchInput.value.toLowerCase();
            displayEquipment();
        }, 150);
        searchInput.addEventListener('input', debouncedSearch);
    }
    
    // Zone filters
    document.querySelectorAll('.zone-filter').forEach(button => {
        button.addEventListener('click', (e) => {
            filterState.zone = e.target.dataset.zone;
            updateFilterButtons();
            displayEquipment();
        });
    });
    
    // Muscle filters
    document.querySelectorAll('.muscle-filter').forEach(button => {
        button.addEventListener('click', (e) => {
            filterState.muscle = e.target.dataset.muscle;
            updateFilterButtons();
            displayEquipment();
        });
    });
    
    // Modal close
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', closeModal);
    });
    
    // Export/Import
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    const importBtn = document.getElementById('import-data');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
    }
    
    const importFile = document.getElementById('import-file');
    if (importFile) {
        importFile.addEventListener('change', importData);
    }
}

// View Management
function showView(viewName) {
    currentView = viewName;
    
    // Hide all views
    document.querySelectorAll('.view').forEach(v => {
        v.style.display = 'none';
    });
    
    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.style.display = 'block';
    }
    
    // Update navigation
    document.querySelectorAll('[data-view]').forEach(button => {
        button.classList.toggle('active', button.dataset.view === viewName);
    });
    
    // Load view-specific content
    switch(viewName) {
        case 'equipment':
            displayEquipment();
            break;
        case 'settings':
            displaySettings();
            break;
        case 'workout':
            displayWorkoutBuilder();
            break;
        case 'history':
            displayHistory();
            break;
        case 'substitutes':
            displaySubstitutes();
            break;
    }
}

// Equipment Display Functions
function displayEquipment() {
    const container = document.getElementById('equipment-list');
    if (!container || !equipmentData.equipment) return;
    
    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // Filter equipment
    let filtered = equipmentData.equipment;
    
    if (filterState.zone !== 'all') {
        filtered = filtered.filter(e => e.zone === filterState.zone);
    }
    
    if (filterState.muscle !== 'all') {
        filtered = filtered.filter(e => {
            const muscles = safeMuscles(e);
            return muscles.primary.includes(filterState.muscle) ||
                   muscles.secondary.includes(filterState.muscle);
        });
    }
    
    if (filterState.search) {
        filtered = filtered.filter(e => {
            const muscles = safeMuscles(e);
            return (e.name?.toLowerCase() || '').includes(filterState.search) ||
                   (e.id?.toLowerCase() || '').includes(filterState.search) ||
                   muscles.primary.some(m => m.includes(filterState.search)) ||
                   muscles.secondary.some(m => m.includes(filterState.search));
        });
    }
    
    // Display filtered equipment
    if (filtered.length === 0) {
        const noResults = document.createElement('p');
        noResults.className = 'no-results';
        noResults.textContent = 'No equipment found matching your filters';
        container.appendChild(noResults);
        return;
    }
    
    filtered.forEach(equipment => {
        const card = createEquipmentCardSafe(equipment);
        container.appendChild(card);
    });
    
    updateStatusBar(`Showing ${filtered.length} of ${equipmentData.equipment.length} machines`);
}

// Safe DOM-based equipment card creation
function createEquipmentCardSafe(equipment) {
    const card = document.createElement('div');
    card.className = 'equipment-card';
    card.dataset.zone = equipment.zone ?? '';

    // Header section
    const header = document.createElement('div');
    header.className = 'equipment-header';

    const h3 = document.createElement('h3');
    h3.textContent = equipment.name ?? 'Unknown Equipment';

    const badge = document.createElement('span');
    badge.className = `zone-badge zone-${equipment.zone ?? ''}`;
    badge.textContent = `Zone ${equipment.zone ?? '?'}`;

    header.appendChild(h3);
    header.appendChild(badge);

    // Body section
    const body = document.createElement('div');
    body.className = 'equipment-body';

    const type = document.createElement('p');
    type.className = 'equipment-type';
    type.textContent = formatEquipmentType(equipment.type ?? '');

    const muscleGroups = document.createElement('div');
    muscleGroups.className = 'muscle-groups';
    
    const muscles = safeMuscles(equipment);
    const primary = document.createElement('span');
    primary.className = 'primary';
    primary.textContent = `Primary: ${muscles.primary.join(', ')}`;
    muscleGroups.appendChild(primary);
    
    if (muscles.secondary.length > 0) {
        const secondary = document.createElement('span');
        secondary.className = 'secondary';
        secondary.textContent = `Secondary: ${muscles.secondary.join(', ')}`;
        muscleGroups.appendChild(secondary);
    }

    body.appendChild(type);
    body.appendChild(muscleGroups);

    // User settings preview if exists
    const userSettings = mySettings.equipment_settings?.[equipment.id] || {};
    if (Object.keys(userSettings).length > 0) {
        const settingsPreview = document.createElement('div');
        settingsPreview.className = 'user-settings-preview';
        
        if (userSettings.last_weight) {
            const weight = document.createElement('span');
            weight.className = 'weight';
            weight.textContent = `💪 ${userSettings.last_weight}`;
            settingsPreview.appendChild(weight);
        }
        
        if (userSettings.last_used) {
            const lastUsed = document.createElement('span');
            lastUsed.className = 'last-used';
            lastUsed.textContent = `📅 ${formatDate(userSettings.last_used)}`;
            settingsPreview.appendChild(lastUsed);
        }
        
        body.appendChild(settingsPreview);
    }

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'equipment-actions';

    const btnDetail = document.createElement('button');
    btnDetail.className = 'btn-detail';
    btnDetail.textContent = 'Details';
    btnDetail.addEventListener('click', () => showEquipmentDetail(equipment.id));

    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn-add';
    btnAdd.textContent = '+ Workout';
    btnAdd.addEventListener('click', () => addToWorkout(equipment.id));

    const btnSub = document.createElement('button');
    btnSub.className = 'btn-substitute';
    btnSub.textContent = 'Substitutes';
    btnSub.addEventListener('click', () => findSubstitutes(equipment.id));

    actions.appendChild(btnDetail);
    actions.appendChild(btnAdd);
    actions.appendChild(btnSub);

    // Assemble card
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);

    return card;
}

// Safe Equipment Detail Modal
function showEquipmentDetail(equipmentId) {
    const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
    if (!equipment) return;
    
    selectedEquipment = equipment;
    const userSettings = mySettings.equipment_settings?.[equipmentId] || {};
    
    const modal = document.getElementById('equipment-modal');
    if (!modal) return;
    
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    
    // Clear content safely
    while (content.firstChild) {
        content.removeChild(content.firstChild);
    }
    
    // Build modal content with DOM methods
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const h2 = document.createElement('h2');
    h2.textContent = equipment.name ?? 'Unknown Equipment';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeModal);
    
    modalHeader.appendChild(h2);
    modalHeader.appendChild(closeBtn);
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    const detailGrid = document.createElement('div');
    detailGrid.className = 'detail-grid';
    
    // Equipment info section
    const infoSection = createDetailSection('Equipment Information', [
        { label: 'Zone', value: `${equipment.zone} - ${equipmentData.metadata.zones?.[equipment.zone] || 'Unknown'}` },
        { label: 'Type', value: formatEquipmentType(equipment.type ?? '') },
        { label: 'Movement Pattern', value: formatPattern(equipment.pattern ?? '') },
        { label: 'Primary Muscles', value: safeMuscles(equipment).primary.join(', ') }
    ]);
    
    const muscles = safeMuscles(equipment);
    if (muscles.secondary.length > 0) {
        const secondaryP = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = 'Secondary Muscles:';
        secondaryP.appendChild(strong);
        secondaryP.appendChild(document.createTextNode(` ${muscles.secondary.join(', ')}`));
        infoSection.appendChild(secondaryP);
    }
    
    // Settings form section
    const settingsSection = createSettingsForm(equipmentId, userSettings);
    
    detailGrid.appendChild(infoSection);
    detailGrid.appendChild(settingsSection);
    
    modalBody.appendChild(detailGrid);
    content.appendChild(modalHeader);
    content.appendChild(modalBody);
    
    modal.style.display = 'block';
}

function createDetailSection(title, items) {
    const section = document.createElement('div');
    section.className = 'detail-section';
    
    const h3 = document.createElement('h3');
    h3.textContent = title;
    section.appendChild(h3);
    
    items.forEach(item => {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = `${item.label}:`;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(` ${item.value}`));
        section.appendChild(p);
    });
    
    return section;
}

function createSettingsForm(equipmentId, userSettings) {
    const section = document.createElement('div');
    section.className = 'detail-section';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'My Settings';
    section.appendChild(h3);
    
    const form = document.createElement('form');
    form.id = 'settings-form';
    form.addEventListener('submit', (e) => saveEquipmentSettings(e, equipmentId));
    
    // Last weight input
    const weightGroup = createFormGroup('Last Weight Used:', 'last_weight', 
        userSettings.last_weight || '', 'e.g., 100 lbs or 45 per side');
    
    // Seat position input
    const seatGroup = createFormGroup('Seat/Position Settings:', 'seat_position',
        userSettings.seat_position || '', 'e.g., Seat height 4, Back angle 45°');
    
    // Notes textarea
    const notesGroup = document.createElement('div');
    notesGroup.className = 'form-group';
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes:';
    const notesTextarea = document.createElement('textarea');
    notesTextarea.name = 'notes';
    notesTextarea.rows = 3;
    notesTextarea.value = userSettings.notes || '';
    notesGroup.appendChild(notesLabel);
    notesGroup.appendChild(notesTextarea);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Save Settings';
    
    form.appendChild(weightGroup);
    form.appendChild(seatGroup);
    form.appendChild(notesGroup);
    form.appendChild(submitBtn);
    
    section.appendChild(form);
    return section;
}

function createFormGroup(labelText, inputName, inputValue, placeholder) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.name = inputName;
    input.value = inputValue;
    input.placeholder = placeholder;
    
    group.appendChild(label);
    group.appendChild(input);
    
    return group;
}

// Settings Management
function saveEquipmentSettings(event, equipmentId) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    if (!mySettings.equipment_settings) {
        mySettings.equipment_settings = {};
    }
    
    if (!mySettings.equipment_settings[equipmentId]) {
        mySettings.equipment_settings[equipmentId] = {};
    }
    
    mySettings.equipment_settings[equipmentId] = {
        last_weight: formData.get('last_weight'),
        seat_position: formData.get('seat_position'),
        notes: formData.get('notes'),
        last_used: new Date().toISOString().split('T')[0]
    };
    
    mySettings.last_updated = new Date().toISOString();
    saveSettingsToLocalBatched();
    
    showNotification('Settings saved successfully!', 'success');
    displayEquipment(); // Refresh to show updated settings
}

// Safe Settings Display
function displaySettings() {
    const container = document.getElementById('settings-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'User Preferences';
    panel.appendChild(h2);
    
    // Create preferences form
    const form = document.createElement('form');
    form.id = 'user-preferences-form';
    form.addEventListener('submit', saveUserPreferences);
    
    // Name input
    const nameGroup = createFormGroup('Your Name:', 'name', 
        mySettings.user?.name || '', '');
    nameGroup.querySelector('input').required = true;
    
    // Experience level select
    const expGroup = document.createElement('div');
    expGroup.className = 'form-group';
    const expLabel = document.createElement('label');
    expLabel.textContent = 'Experience Level:';
    const expSelect = document.createElement('select');
    expSelect.name = 'experience_level';
    ['beginner', 'intermediate', 'advanced'].forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level.charAt(0).toUpperCase() + level.slice(1);
        option.selected = mySettings.user?.experience_level === level;
        expSelect.appendChild(option);
    });
    expGroup.appendChild(expLabel);
    expGroup.appendChild(expSelect);
    
    // Duration input
    const durationGroup = createNumberInput('Typical Workout Duration (minutes):', 
        'typical_duration', mySettings.user?.typical_duration || 60, 15, 180);
    
    // Rest time input
    const restGroup = createNumberInput('Rest Between Sets (seconds):', 
        'rest_between_sets', mySettings.preferences?.rest_between_sets || 90, 30, 300);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Save Preferences';
    
    form.appendChild(nameGroup);
    form.appendChild(expGroup);
    form.appendChild(durationGroup);
    form.appendChild(restGroup);
    form.appendChild(submitBtn);
    
    panel.appendChild(form);
    
    // Data management section
    const dataSection = createDataManagementSection();
    panel.appendChild(dataSection);
    
    container.appendChild(panel);
}

function createNumberInput(labelText, inputName, value, min, max) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.name = inputName;
    input.value = value;
    input.min = min;
    input.max = max;
    
    group.appendChild(label);
    group.appendChild(input);
    
    return group;
}

function createDataManagementSection() {
    const section = document.createElement('div');
    section.className = 'data-management';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Data Management';
    section.appendChild(h3);
    
    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn-secondary';
    exportBtn.textContent = 'Export All Data';
    exportBtn.addEventListener('click', exportData);
    
    // Import button
    const importBtn = document.createElement('button');
    importBtn.className = 'btn-secondary';
    importBtn.textContent = 'Import Data';
    importBtn.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    
    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'import-file-input';
    fileInput.style.display = 'none';
    fileInput.accept = '.json';
    fileInput.addEventListener('change', importData);
    
    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-danger';
    resetBtn.textContent = 'Reset All Data';
    resetBtn.addEventListener('click', resetData);
    
    section.appendChild(exportBtn);
    section.appendChild(importBtn);
    section.appendChild(fileInput);
    section.appendChild(resetBtn);
    
    return section;
}

function saveUserPreferences(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    if (!mySettings.user) mySettings.user = {};
    if (!mySettings.preferences) mySettings.preferences = {};
    
    mySettings.user.name = formData.get('name');
    mySettings.user.experience_level = formData.get('experience_level');
    mySettings.user.typical_duration = parseInt(formData.get('typical_duration'));
    mySettings.preferences.rest_between_sets = parseInt(formData.get('rest_between_sets'));
    
    mySettings.last_updated = new Date().toISOString();
    saveSettingsToLocalBatched();
    
    showNotification('Preferences saved successfully!', 'success');
}

// Safe Workout Builder Display
function displayWorkoutBuilder() {
    const container = document.getElementById('workout-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const builder = document.createElement('div');
    builder.className = 'workout-builder';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Current Workout';
    builder.appendChild(h2);
    
    const workoutList = document.createElement('div');
    workoutList.id = 'current-workout-list';
    
    if (currentWorkout.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No exercises added yet. Browse equipment to add exercises.';
        workoutList.appendChild(emptyState);
    } else {
        currentWorkout.forEach((exercise, index) => {
            const card = createWorkoutExerciseCardSafe(exercise, index);
            workoutList.appendChild(card);
        });
    }
    
    builder.appendChild(workoutList);
    
    // Add workout actions if exercises exist
    if (currentWorkout.length > 0) {
        const actions = createWorkoutActions();
        builder.appendChild(actions);
    }
    
    // Add templates section
    const templates = createWorkoutTemplates();
    builder.appendChild(templates);
    
    container.appendChild(builder);
}

function createWorkoutExerciseCardSafe(exercise, index) {
    const card = document.createElement('div');
    card.className = 'workout-exercise-card';
    
    const info = document.createElement('div');
    info.className = 'exercise-info';
    
    const h4 = document.createElement('h4');
    h4.textContent = exercise.name ?? 'Unknown Exercise';
    
    const badge = document.createElement('span');
    badge.className = `zone-badge zone-${exercise.zone ?? ''}`;
    badge.textContent = `Zone ${exercise.zone ?? '?'}`;
    
    info.appendChild(h4);
    info.appendChild(badge);
    
    const actions = document.createElement('div');
    actions.className = 'exercise-actions';
    
    const upBtn = document.createElement('button');
    upBtn.textContent = '↑';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveExerciseUp(index));
    
    const downBtn = document.createElement('button');
    downBtn.textContent = '↓';
    downBtn.disabled = index === currentWorkout.length - 1;
    downBtn.addEventListener('click', () => moveExerciseDown(index));
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeFromWorkout(index));
    
    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(removeBtn);
    
    card.appendChild(info);
    card.appendChild(actions);
    
    return card;
}

function createWorkoutActions() {
    const actions = document.createElement('div');
    actions.className = 'workout-actions';
    
    const optimizeBtn = document.createElement('button');
    optimizeBtn.className = 'btn-secondary';
    optimizeBtn.textContent = 'Optimize Route';
    optimizeBtn.addEventListener('click', optimizeRoute);
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Save Workout';
    saveBtn.addEventListener('click', saveWorkout);
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-danger';
    clearBtn.textContent = 'Clear All';
    clearBtn.addEventListener('click', clearWorkout);
    
    actions.appendChild(optimizeBtn);
    actions.appendChild(saveBtn);
    actions.appendChild(clearBtn);
    
    return actions;
}

function createWorkoutTemplates() {
    const templates = document.createElement('div');
    templates.className = 'workout-templates';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Load Template';
    templates.appendChild(h3);
    
    const templateList = document.createElement('div');
    templateList.className = 'template-list';
    
    (workoutLogs.templates || []).forEach(template => {
        const btn = document.createElement('button');
        btn.className = 'template-btn';
        btn.textContent = `${template.name} (${template.equipment_sequence.length} exercises)`;
        btn.addEventListener('click', () => loadTemplate(template.name));
        templateList.appendChild(btn);
    });
    
    templates.appendChild(templateList);
    
    return templates;
}

// Workout Management Functions
function addToWorkout(equipmentId) {
    const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
    if (!equipment) return;
    
    // Check if already in workout
    if (currentWorkout.find(e => e.id === equipmentId)) {
        showNotification('Equipment already in workout', 'warning');
        return;
    }
    
    currentWorkout.push({
        id: equipment.id,
        name: equipment.name,
        zone: equipment.zone,
        muscles: equipment.muscles
    });
    
    showNotification(`Added ${equipment.name} to workout`, 'success');
    
    // Update UI if on workout view
    if (currentView === 'workout') {
        displayWorkoutBuilder();
    }
}

function removeFromWorkout(index) {
    currentWorkout.splice(index, 1);
    displayWorkoutBuilder();
}

function moveExerciseUp(index) {
    if (index > 0) {
        [currentWorkout[index], currentWorkout[index - 1]] = [currentWorkout[index - 1], currentWorkout[index]];
        displayWorkoutBuilder();
    }
}

function moveExerciseDown(index) {
    if (index < currentWorkout.length - 1) {
        [currentWorkout[index], currentWorkout[index + 1]] = [currentWorkout[index + 1], currentWorkout[index]];
        displayWorkoutBuilder();
    }
}

function clearWorkout() {
    if (confirm('Clear all exercises from current workout?')) {
        currentWorkout = [];
        displayWorkoutBuilder();
    }
}

function optimizeRoute() {
    // Group exercises by zone to minimize walking
    currentWorkout.sort((a, b) => (a.zone || '').localeCompare(b.zone || ''));
    displayWorkoutBuilder();
    showNotification('Workout route optimized by zone', 'success');
}

function saveWorkout() {
    if (currentWorkout.length === 0) {
        showNotification('No exercises to save', 'warning');
        return;
    }
    
    const workoutName = prompt('Enter a name for this workout:');
    if (!workoutName) return;
    
    const workout = {
        id: `workout-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        name: workoutName,
        exercises: currentWorkout.map(e => ({
            equipment_id: e.id,
            equipment_name: e.name,
            sets: []
        })),
        duration_minutes: 0,
        zones_visited: [...new Set(currentWorkout.map(e => e.zone))],
        notes: ''
    };
    
    workoutLogs.workouts.push(workout);
    workoutLogs.stats.total_workouts++;
    
    // Save as template
    workoutLogs.templates.push({
        name: workoutName,
        equipment_sequence: currentWorkout.map(e => e.id),
        target_duration: mySettings.user?.typical_duration || 60
    });
    
    try {
        localStorage.setItem('eosFitnessLogs', JSON.stringify(workoutLogs));
        showNotification('Workout saved successfully!', 'success');
        currentWorkout = [];
        displayWorkoutBuilder();
    } catch (error) {
        console.error('Failed to save workout:', error);
        showNotification('Failed to save workout', 'error');
    }
}

function loadTemplate(templateName) {
    const template = workoutLogs.templates.find(t => t.name === templateName);
    if (!template) return;
    
    currentWorkout = [];
    
    template.equipment_sequence.forEach(equipmentId => {
        const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
        if (equipment) {
            currentWorkout.push({
                id: equipment.id,
                name: equipment.name,
                zone: equipment.zone,
                muscles: equipment.muscles
            });
        }
    });
    
    displayWorkoutBuilder();
    showNotification(`Loaded template: ${templateName}`, 'success');
}

// Substitution Algorithm with Safe Access
function findSubstitutes(equipmentId) {
    const equipment = equipmentData.equipment.find(e => e.id === equipmentId);
    if (!equipment) return;
    
    // Calculate match scores for all other equipment
    const substitutes = equipmentData.equipment
        .filter(e => e.id !== equipmentId)
        .map(e => ({
            equipment: e,
            score: calculateMatchScoreSafe(equipment, e)
        }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 matches
    
    displaySubstitutesModalSafe(equipment, substitutes);
}

function calculateMatchScoreSafe(a, b) {
    let score = 0;
    const ma = safeMuscles(a), mb = safeMuscles(b);
    
    // Same movement pattern = highest score
    if (a.pattern && a.pattern === b.pattern) score += 50;
    
    // Primary muscle overlap
    score += ma.primary.filter(m => mb.primary.includes(m)).length * 30;
    
    // Secondary muscle overlap
    score += ma.secondary.filter(m => mb.secondary.includes(m)).length * 10;
    
    // Zone proximity bonus
    const az = (a.zone || '').charCodeAt(0);
    const bz = (b.zone || '').charCodeAt(0);
    if (Number.isFinite(az) && Number.isFinite(bz)) {
        const d = Math.abs(az - bz);
        score += d === 0 ? 20 : d === 1 ? 10 : 0;
    }
    
    // Equipment type similarity
    if (a.type && a.type === b.type) score += 15;
    
    return score;
}

function displaySubstitutesModalSafe(equipment, substitutes) {
    const modal = document.getElementById('substitutes-modal') || createModal('substitutes-modal');
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    
    // Clear content safely
    while (content.firstChild) {
        content.removeChild(content.firstChild);
    }
    
    // Build modal header
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const h2 = document.createElement('h2');
    h2.textContent = `Substitutes for ${equipment.name ?? 'Equipment'}`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeModal);
    
    header.appendChild(h2);
    header.appendChild(closeBtn);
    
    // Build modal body
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Original equipment section
    const originalSection = document.createElement('div');
    originalSection.className = 'original-equipment';
    
    const h3Original = document.createElement('h3');
    h3Original.textContent = 'Original Equipment';
    
    const pName = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = equipment.name ?? 'Unknown';
    pName.appendChild(strong);
    
    const pDetails = document.createElement('p');
    const muscles = safeMuscles(equipment);
    pDetails.textContent = `Zone ${equipment.zone ?? '?'} | ${muscles.primary.join(', ')}`;
    
    originalSection.appendChild(h3Original);
    originalSection.appendChild(pName);
    originalSection.appendChild(pDetails);
    
    // Substitutes list
    const subList = document.createElement('div');
    subList.className = 'substitute-list';
    
    const h3Subs = document.createElement('h3');
    h3Subs.textContent = 'Best Substitutes';
    subList.appendChild(h3Subs);
    
    if (substitutes.length > 0) {
        substitutes.forEach(sub => {
            const item = createSubstituteItem(sub);
            subList.appendChild(item);
        });
    } else {
        const noSubs = document.createElement('p');
        noSubs.textContent = 'No suitable substitutes found';
        subList.appendChild(noSubs);
    }
    
    body.appendChild(originalSection);
    body.appendChild(subList);
    
    content.appendChild(header);
    content.appendChild(body);
    
    modal.style.display = 'block';
}

function createSubstituteItem(sub) {
    const item = document.createElement('div');
    item.className = 'substitute-item';
    item.addEventListener('click', () => showEquipmentDetail(sub.equipment.id));
    
    const info = document.createElement('div');
    info.className = 'substitute-info';
    
    const h4 = document.createElement('h4');
    h4.textContent = sub.equipment.name ?? 'Unknown';
    
    const p = document.createElement('p');
    const muscles = safeMuscles(sub.equipment);
    p.textContent = `Zone ${sub.equipment.zone ?? '?'} | ${muscles.primary.join(', ')}`;
    
    info.appendChild(h4);
    info.appendChild(p);
    
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'match-score';
    
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'score';
    scoreSpan.textContent = `${Math.round(sub.score)}%`;
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = 'Match';
    
    scoreDiv.appendChild(scoreSpan);
    scoreDiv.appendChild(labelSpan);
    
    item.appendChild(info);
    item.appendChild(scoreDiv);
    
    return item;
}

// Safe Substitutes View
function displaySubstitutes() {
    const container = document.getElementById('substitutes-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const panel = document.createElement('div');
    panel.className = 'substitutes-panel';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Quick Substitute Finder';
    panel.appendChild(h2);
    
    const p = document.createElement('p');
    p.textContent = 'Select any equipment to find the best alternatives when it\'s busy.';
    panel.appendChild(p);
    
    const quickSubs = document.createElement('div');
    quickSubs.className = 'quick-substitutes';
    
    Object.entries(mySettings.quick_substitutes || {}).forEach(([equipId, subs]) => {
        const equipment = equipmentData.equipment.find(e => e.id === equipId);
        if (!equipment) return;
        
        const group = createQuickSubGroup(equipment, subs);
        quickSubs.appendChild(group);
    });
    
    panel.appendChild(quickSubs);
    container.appendChild(panel);
}

function createQuickSubGroup(equipment, subs) {
    const group = document.createElement('div');
    group.className = 'quick-sub-group';
    
    const h3 = document.createElement('h3');
    h3.textContent = equipment.name ?? 'Unknown';
    group.appendChild(h3);
    
    const subList = document.createElement('div');
    subList.className = 'sub-list';
    
    subs.forEach(subId => {
        const sub = equipmentData.equipment.find(e => e.id === subId);
        if (sub) {
            const btn = document.createElement('button');
            btn.className = 'sub-btn';
            btn.textContent = `${sub.name} (Zone ${sub.zone ?? '?'})`;
            btn.addEventListener('click', () => showEquipmentDetail(subId));
            subList.appendChild(btn);
        }
    });
    
    group.appendChild(subList);
    return group;
}

// Safe History Display
function displayHistory() {
    const container = document.getElementById('history-content');
    if (!container) return;
    
    // Clear content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const panel = document.createElement('div');
    panel.className = 'history-panel';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Workout History';
    panel.appendChild(h2);
    
    // Stats summary
    const stats = createStatsCards();
    panel.appendChild(stats);
    
    // Workout history
    const history = createWorkoutHistory();
    panel.appendChild(history);
    
    container.appendChild(panel);
}

function createStatsCards() {
    const summary = document.createElement('div');
    summary.className = 'stats-summary';
    
    const stats = [
        { value: workoutLogs.stats?.total_workouts || 0, label: 'Total Workouts' },
        { value: workoutLogs.stats?.average_workout_duration || 0, label: 'Avg Duration (min)' },
        { value: workoutLogs.stats?.weekly_frequency || 0, label: 'Weekly Frequency' }
    ];
    
    stats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        
        const value = document.createElement('span');
        value.className = 'stat-value';
        value.textContent = stat.value.toString();
        
        const label = document.createElement('span');
        label.className = 'stat-label';
        label.textContent = stat.label;
        
        card.appendChild(value);
        card.appendChild(label);
        summary.appendChild(card);
    });
    
    return summary;
}

function createWorkoutHistory() {
    const history = document.createElement('div');
    history.className = 'workout-history';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Recent Workouts';
    history.appendChild(h3);
    
    const recentWorkouts = (workoutLogs.workouts || []).slice(-10).reverse();
    
    if (recentWorkouts.length > 0) {
        recentWorkouts.forEach(workout => {
            const card = createHistoryCard(workout);
            history.appendChild(card);
        });
    } else {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No workout history yet. Start tracking your workouts!';
        history.appendChild(empty);
    }
    
    return history;
}

function createHistoryCard(workout) {
    const card = document.createElement('div');
    card.className = 'history-card';
    
    const header = document.createElement('div');
    header.className = 'workout-header';
    
    const h4 = document.createElement('h4');
    h4.textContent = `${workout.type || 'Workout'} - ${formatDate(workout.date)}`;
    
    const duration = document.createElement('span');
    duration.className = 'duration';
    duration.textContent = `${workout.duration_minutes} min`;
    
    header.appendChild(h4);
    header.appendChild(duration);
    
    const summary = document.createElement('div');
    summary.className = 'workout-summary';
    
    const p = document.createElement('p');
    p.textContent = `${workout.exercises.length} exercises in zones ${workout.zones_visited.join(', ')}`;
    summary.appendChild(p);
    
    if (workout.notes) {
        const notes = document.createElement('p');
        notes.className = 'notes';
        notes.textContent = workout.notes;
        summary.appendChild(notes);
    }
    
    card.appendChild(header);
    card.appendChild(summary);
    
    return card;
}

// Export/Import Functions with Memory Management
function exportData() {
    const exportData = {
        version: '2.0',
        exported_at: new Date().toISOString(),
        settings: mySettings,
        workout_logs: workoutLogs,
        equipment_database: equipmentData
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `eos-fitness-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    // Revoke URL after download starts
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showNotification('Data exported successfully!', 'success');
}

function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Remove dangerous keys
            for (const key of ['__proto__', 'constructor', 'prototype']) {
                delete importedData[key];
            }
            
            // Validate and import settings
            if (importedData.settings && validateSettings(importedData.settings)) {
                mySettings = importedData.settings;
                saveSettingsToLocalBatched();
            }
            
            // Validate and import workout logs
            if (importedData.workout_logs && validateWorkoutLogs(importedData.workout_logs)) {
                workoutLogs = importedData.workout_logs;
                localStorage.setItem('eosFitnessLogs', JSON.stringify(workoutLogs));
            }
            
            // Validate and import equipment database
            if (importedData.equipment_database && validateEquipmentDatabase(importedData.equipment_database)) {
                equipmentData = importedData.equipment_database;
            }
            
            showNotification('Data imported successfully!', 'success');
            setTimeout(() => location.reload(), 1000); // Refresh after notification shows
        } catch (error) {
            showNotification('Error importing data. Please check the file format.', 'error');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
}

function resetData() {
    if (!confirm('This will reset all your settings and workout data. Are you sure?')) return;
    
    localStorage.removeItem('eosFitnessSettings');
    localStorage.removeItem('eosFitnessLogs');
    
    mySettings = getDefaultSettings();
    workoutLogs = getDefaultWorkoutLogs();
    
    showNotification('All data has been reset', 'success');
    setTimeout(() => location.reload(), 1000);
}

// Utility Functions
function formatEquipmentType(type) {
    const typeMap = {
        'ai_assisted': 'AI-Assisted',
        'plate_loaded': 'Plate-Loaded',
        'selectorized': 'Selectorized',
        'cable': 'Cable Machine',
        'free_weight': 'Free Weight',
        'bodyweight': 'Bodyweight'
    };
    return typeMap[type] || type || 'Unknown';
}

function formatPattern(pattern) {
    if (!pattern) return 'Unknown';
    return pattern.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        const date = new Date(dateString);
        const today = new Date();
        const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
    } catch {
        return dateString;
    }
}

function updateFilterButtons() {
    document.querySelectorAll('.zone-filter').forEach(button => {
        button.classList.toggle('active', button.dataset.zone === filterState.zone);
    });
    
    document.querySelectorAll('.muscle-filter').forEach(button => {
        button.classList.toggle('active', button.dataset.muscle === filterState.muscle);
    });
}

function updateUI() {
    updateLastUpdated();
    updateStatusBar('Ready');
}

function updateLastUpdated() {
    const element = document.getElementById('last-updated');
    if (element && mySettings.last_updated) {
        element.textContent = `Last updated: ${formatDate(mySettings.last_updated)}`;
    }
}

function updateStatusBar(message) {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

function createModal(id) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    modal.appendChild(content);
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    return modal;
}

// Initialize modals if they don't exist
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('equipment-modal')) {
        createModal('equipment-modal');
    }
    if (!document.getElementById('substitutes-modal')) {
        createModal('substitutes-modal');
    }
});

// Export functions for global access (minimize these in production)
window.showView = showView;
window.showEquipmentDetail = showEquipmentDetail;
window.saveEquipmentSettings = saveEquipmentSettings;
window.addToWorkout = addToWorkout;
window.removeFromWorkout = removeFromWorkout;
window.moveExerciseUp = moveExerciseUp;
window.moveExerciseDown = moveExerciseDown;
window.findSubstitutes = findSubstitutes;
window.optimizeRoute = optimizeRoute;
window.saveWorkout = saveWorkout;
window.clearWorkout = clearWorkout;
window.loadTemplate = loadTemplate;
window.exportData = exportData;
window.importData = importData;
window.resetData = resetData;
window.closeModal = closeModal;
window.saveUserPreferences = saveUserPreferences;