#!/bin/bash

# EOS Fitness Tracker Setup Script

echo "Setting up EOS Fitness Tracker..."

# Create directory structure if needed
mkdir -p data
mkdir -p src  
mkdir -p docs
mkdir -p scripts
mkdir -p backups

# Create initial settings file
cat > data/my-settings.json << 'EOF'
{
  "user": {
    "name": "David Leathers",
    "gym": "EOS Fitness Lutz",
    "membership": "Will Power",
    "goals": ["strength", "hypertrophy"],
    "experience": "intermediate"
  },
  "equipment_settings": {},
  "favorite_equipment": [],
  "avoid_equipment": [],
  "workout_history": []
}
EOF

echo "✅ Project structure created"
echo "✅ Initial settings file created"