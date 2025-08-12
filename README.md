# EOS Fitness Tracker

A comprehensive, secure gym equipment tracking system for EOS Fitness Lutz, Florida. Features cloud-based storage, cross-device synchronization, and enterprise-grade security.

## Features

- **🏋️ Complete Equipment Database**: All 60 gym machines with detailed specifications
- **☁️ Cloud Storage**: Secure, encrypted data storage with cross-device sync
- **🔐 Enterprise Security**: HMAC-signed authentication, rate limiting, ETag concurrency control
- **📱 Progressive Web App**: Works offline, installable on mobile devices
- **🎯 Smart Substitutions**: AI-powered equipment alternatives with similarity scoring
- **📍 Zone Navigation**: Efficient gym routing through 6 specialized zones
- **📊 Workout Analytics**: Comprehensive progress tracking and statistics
- **🔄 Data Migration**: Seamless upgrade from local to cloud storage
- **📤 Export/Backup**: Complete data export in JSON format

## Project Structure

```
eos-fitness-tracker/
├── index.html                    # Main web application interface  
├── app.js                        # Frontend application logic
├── styles.css                    # Application styling
├── netlify/functions/            # Serverless API Backend
│   ├── _shared/                  # Shared utilities
│   │   ├── auth.js               # HMAC authentication & rate limiting
│   │   └── logger.js             # Structured logging & error handling
│   ├── auth.js                   # User registration & token generation
│   ├── user-settings.js          # Equipment settings CRUD
│   ├── workout-logs.js           # Workout tracking & analytics
│   ├── migrate-data.js           # Data migration from localStorage
│   └── export-data.js            # Data export & backup
├── database/                     # Static Data
│   ├── equipment-database.json   # Complete equipment specifications
│   ├── my-settings.json          # Local settings (legacy)
│   └── workout-logs.json         # Local logs (legacy)
├── docs/                         # Documentation
│   ├── API.md                    # Complete API documentation
│   ├── quick-reference.md        # Printable equipment reference
│   └── user-guide.md             # User documentation
├── scripts/
│   └── setup.sh                  # Project setup script
├── test-security-fixes.js        # Security validation test suite
├── deploy-and-test.sh            # Deployment validation script
├── netlify.toml                  # Netlify deployment configuration
└── README.md                     # This file
```

## Quick Start

### 🌐 Using the Cloud Version (Recommended)

1. **Visit**: [https://eos-fitness-tracker.netlify.app](https://eos-fitness-tracker.netlify.app)
2. **Register**: Create your secure account and get an authentication token
3. **Track**: Log equipment settings and workouts with cloud synchronization
4. **Sync**: Access your data from any device automatically

### 💻 Local Development

1. **Clone**: `git clone <repository-url>`
2. **Install**: `npm install`
3. **Develop**: `netlify dev` (requires [Netlify CLI](https://docs.netlify.com/cli/get-started/))
4. **Test**: `./deploy-and-test.sh` for security validation

### 📱 Migration from Local Version

If upgrading from the localStorage-based version:

1. **Export** your local data using browser dev tools
2. **Register** for a cloud account at the web app
3. **Migrate** using the `/migrate-data` API endpoint
4. See [API Documentation](docs/API.md#migration-guide) for detailed instructions

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