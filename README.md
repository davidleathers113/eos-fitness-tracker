# EOS Fitness Tracker

A comprehensive gym equipment tracking system for EOS Fitness Lutz, Florida.

## Features

- Complete database of all 60 gym machines
- Personal settings tracking
- Smart substitution system with match scores
- Zone-based navigation
- AI-ready JSON structure
- Interactive web interface
- Quick reference guides

## Project Structure

```
eos-fitness-tracker/
├── data/
│   ├── equipment-database.json    # Complete equipment database
│   ├── my-settings.json          # Personal settings storage
│   └── workout-logs.json          # Workout history
├── src/
│   ├── index.html                 # Main web interface
│   ├── app.js                     # Application logic
│   └── styles.css                 # Styling
├── docs/
│   ├── quick-reference.md         # Printable quick reference
│   └── user-guide.md              # Complete user guide
├── scripts/
│   └── backup.sh                  # Backup script
└── README.md                      # This file
```

## Quick Start

1. Open `src/index.html` in your browser
2. Start logging your equipment settings
3. Use the substitution finder when equipment is busy
4. Track your workouts and progress

## Equipment Zones

- **Zone A**: EGYM Smart Strength (AI-assisted)
- **Zone B**: Hammer Strength (Plate-loaded)
- **Zone C**: Nautilus (Selectorized)
- **Zone D**: Free Weights
- **Zone E**: Cardio Deck
- **Zone F**: Functional Training

## Usage

### Recording Settings
Click on any machine to record your personal settings (seat position, weight, etc.)

### Finding Substitutes
When equipment is busy, the system suggests alternatives ranked by similarity (0.5-1.0 match score)

### Planning Workouts
Use the workout builder to create efficient routes through the gym zones

## Data Management

Your settings are stored locally in JSON format for easy backup and portability.

## Support

For questions or issues, refer to the user guide in the docs folder.