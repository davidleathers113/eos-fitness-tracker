# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EOS Fitness Tracker - A vanilla JavaScript web application for tracking gym equipment settings and workouts at EOS Fitness Lutz, Florida. This is a client-side only application with no backend dependencies.

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Data Storage**: Local JSON files (no database)
- **Build Tools**: None (static files served directly)
- **Testing**: None currently configured
- **Dependencies**: None (pure vanilla JS)

## Development Commands

```bash
# Setup project structure and initial data
./scripts/setup.sh

# Open the application (no build step required)
open index.html
# Or serve with any static server:
python3 -m http.server 8000  # Then navigate to localhost:8000/
```

## Architecture

### Core Components

1. **Single Page Application** (`index.html`)
   - All views managed via JavaScript DOM manipulation
   - No routing library - uses simple view switching

2. **Application Controller** (`src/app/index.js`)
   - Manages equipment data loading/saving
   - Handles view switching and filtering
   - Implements substitution matching algorithm
   - Manages user settings persistence

3. **Data Layer** (`database/` directory)
   - `equipment-database.json`: Master equipment list (60 machines)
   - `my-settings.json`: User's personal equipment settings
   - `workout-logs.json`: Workout history tracking

### Key Design Patterns

- **View Management**: Simple show/hide pattern using CSS classes
- **Data Loading**: Fetch API with fallback to sample data
- **State Management**: Module-level variables (equipmentData, mySettings, currentWorkout)
- **Equipment Matching**: Custom scoring algorithm based on:
  - Movement pattern similarity
  - Muscle group overlap
  - Zone proximity

### Equipment Organization

The gym is divided into 6 zones:
- Zone A: EGYM Smart Strength (AI-assisted machines)
- Zone B: Hammer Strength (Plate-loaded)
- Zone C: Nautilus (Selectorized)
- Zone D: Free Weights
- Zone E: Cardio Deck
- Zone F: Functional Training

Equipment data structure includes:
- Unique ID, name, zone location
- Movement pattern classification
- Primary/secondary muscle groups
- User's personal settings
- Substitution recommendations

## Working with the Codebase

### Adding New Features
- All UI changes go in `src/app/index.js` (DOM manipulation)
- Style updates in `styles/` directory (modular CSS files)
- Equipment data modifications in `database/equipment-database.json`

### Data Management
- Equipment database is read-only from the app
- User settings are stored in localStorage and `database/my-settings.json`
- No server-side persistence - all data is local

### Common Tasks
- **Add new equipment**: Edit `database/equipment-database.json`
- **Modify UI**: Update `index.html` structure and `src/app/index.js` logic
- **Update styles**: Edit files in `styles/` directory (tokens, base, layout, components, features, pwa)
- **Export data**: Use the built-in export function in the app

## Important Notes

- This is a personal project for tracking gym equipment at a specific location
- No build process or transpilation needed
- Designed for local use or simple static hosting
- Equipment IDs follow pattern: `{BRAND}-{TYPE}` (e.g., "EGYM-CP" for EGYM Chest Press)