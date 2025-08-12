# EOS Fitness Tracker API Documentation

## Overview

The EOS Fitness Tracker API provides secure, cloud-based storage for workout data, equipment settings, and user preferences. The API uses HMAC-signed authentication tokens and implements enterprise-grade security features including rate limiting, ETag-based concurrency control, and comprehensive audit logging.

**Base URL**: `https://eos-fitness-tracker.netlify.app/.netlify/functions/`

---

## Authentication

### Security Model

The API uses **HMAC-SHA256 signed tokens** for authentication. All tokens are cryptographically signed and include expiration timestamps to prevent replay attacks.

#### Token Format
```
{base64-encoded-payload}.{hmac-sha256-signature}
```

#### Payload Structure
```json
{
  "userId": "user-1234567890-abc123def",
  "exp": 1704067200000
}
```

### Obtaining Tokens

#### 1. New User Registration
**Endpoint**: `POST /auth`

```bash
curl -X POST https://eos-fitness-tracker.netlify.app/.netlify/functions/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register",
    "userName": "John Doe"
  }'
```

**Response**:
```json
{
  "success": true,
  "user": {
    "userId": "user-1704067200000-abc123def",
    "token": "eyJ1c2VySWQiOiJ1c2VyLTE3MD...abc123.def456...",
    "expiresAt": "2025-01-31T10:00:00.000Z"
  },
  "message": "User registered successfully"
}
```

#### 2. Existing User Login
**Endpoint**: `POST /auth`

```bash
curl -X POST https://eos-fitness-tracker.netlify.app/.netlify/functions/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "login",
    "userId": "user-1704067200000-abc123def"
  }'
```

### Using Authentication Tokens

Include the token in **all subsequent requests** using either method:

#### Method 1: Authorization Header (Recommended)
```bash
curl -H "Authorization: Bearer {your-token}" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/user-settings
```

#### Method 2: Custom Header
```bash
curl -H "x-user-token: {your-token}" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/user-settings
```

---

## API Endpoints

### 1. User Settings

#### Get User Settings
**Endpoint**: `GET /user-settings`

```bash
curl -H "Authorization: Bearer {token}" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/user-settings
```

**Response**:
```json
{
  "success": true,
  "data": {
    "settings": {
      "user": {
        "name": "John Doe",
        "experience_level": "intermediate",
        "goals": ["strength", "muscle_building"],
        "typical_duration": 60,
        "preferred_zones": ["A", "B", "C"],
        "gym_location": "EOS Fitness Lutz, Florida"
      },
      "equipment_settings": {
        "EGYM-CP": {
          "weight": 150,
          "seat_position": 3,
          "back_position": 2
        }
      },
      "quick_substitutes": {},
      "preferences": {
        "show_zones": true,
        "auto_save": true,
        "notification_sound": false,
        "theme": "light"
      }
    },
    "userId": "user-1704067200000-abc123def",
    "isNewUser": false,
    "etag": "\"abc123def456\"",
    "lastModified": "2024-01-01T10:00:00.000Z"
  }
}
```

#### Update User Settings
**Endpoint**: `POST /user-settings`

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "user": {
        "name": "John Doe",
        "experience_level": "intermediate"
      },
      "equipment_settings": {
        "EGYM-CP": {
          "weight": 160,
          "seat_position": 3
        }
      }
    },
    "ifMatch": "abc123def456"
  }' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/user-settings
```

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "userId": "user-1704067200000-abc123def",
    "modified": true,
    "etag": "\"def456ghi789\""
  }
}
```

### 2. Workout Logs

#### Get Workout Logs
**Endpoint**: `GET /workout-logs`

```bash
curl -H "Authorization: Bearer {token}" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/workout-logs
```

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": {
      "workouts": [
        {
          "id": "workout-20240101-001",
          "date": "2024-01-01",
          "duration_minutes": 45,
          "exercises": [
            {
              "equipment_id": "EGYM-CP",
              "sets": [
                {"weight": 150, "reps": 12},
                {"weight": 160, "reps": 10}
              ]
            }
          ]
        }
      ],
      "templates": [
        {
          "name": "Push Day",
          "equipment_sequence": ["HS-IL-BP", "EGYM-CP", "NAUT-SP"],
          "estimated_duration": 60
        }
      ],
      "statistics": {
        "total_workouts": 1,
        "total_time": 45,
        "favorite_equipment": {"EGYM-CP": 1},
        "monthly_summary": {"2024-01": {"count": 1, "total_time": 45}}
      }
    },
    "userId": "user-1704067200000-abc123def",
    "etag": "\"ghi789jkl012\""
  }
}
```

#### Add New Workout
**Endpoint**: `POST /workout-logs`

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "workout": {
      "id": "workout-20240102-001",
      "date": "2024-01-02",
      "duration_minutes": 50,
      "exercises": [
        {
          "equipment_id": "EGYM-CP",
          "sets": [
            {"weight": 160, "reps": 12},
            {"weight": 170, "reps": 8}
          ]
        }
      ]
    },
    "ifMatch": "ghi789jkl012"
  }' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/workout-logs
```

#### Update Existing Workout
**Endpoint**: `PUT /workout-logs`

```bash
curl -X PUT \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "workoutId": "workout-20240101-001",
    "workout": {
      "id": "workout-20240101-001",
      "date": "2024-01-01",
      "duration_minutes": 50,
      "exercises": [...]
    }
  }' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/workout-logs
```

#### Delete Workout
**Endpoint**: `DELETE /workout-logs`

```bash
curl -X DELETE \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "workoutId": "workout-20240101-001"
  }' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/workout-logs
```

### 3. Data Migration

#### Migrate Local Data to Cloud
**Endpoint**: `POST /migrate-data`

Use this endpoint to migrate existing localStorage data to the cloud.

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "localSettings": {
      "user": {"name": "John Doe"},
      "equipment_settings": {...}
    },
    "localWorkoutLogs": {
      "workouts": [...],
      "templates": [...]
    }
  }' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/migrate-data
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Data migration completed successfully",
    "userId": "user-1704067200000-abc123def",
    "migration": {
      "migrationTimestamp": "2024-01-01T10:00:00.000Z",
      "settings": {
        "migrated": true,
        "hadExistingData": false,
        "equipmentCount": 15
      },
      "workoutLogs": {
        "migrated": true,
        "hadExistingData": false,
        "totalWorkouts": 25,
        "templatesCount": 3
      }
    }
  }
}
```

### 4. Data Export

#### Export All User Data
**Endpoint**: `GET /export-data`

```bash
# JSON Response
curl -H "Authorization: Bearer {token}" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/export-data

# Download as File
curl -H "Authorization: Bearer {token}" \
     -H "Accept: application/octet-stream" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/export-data \
     -o backup.json
```

**Response**: Complete backup including user settings, workout logs, and equipment database.

---

## Concurrency Control

### ETag-Based Optimistic Locking

The API implements ETag-based concurrency control to prevent data loss from simultaneous modifications.

#### How it Works
1. **Read operations** return an `etag` value
2. **Write operations** can include `ifMatch` parameter with the ETag
3. **Conflict detection** returns `409 Conflict` if data was modified

#### Example Conflict Resolution
```bash
# 1. Get current data with ETag
curl -H "Authorization: Bearer {token}" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/user-settings

# Response includes: "etag": "abc123"

# 2. Attempt update with ETag
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"settings": {...}, "ifMatch": "abc123"}' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/user-settings

# 3. If concurrent modification occurred:
# HTTP 409 Conflict
{
  "error": "ETag mismatch",
  "message": "Conflict: Data was modified by another client. Please refresh and try again."
}
```

---

## Rate Limiting

The API implements rate limiting to ensure fair usage and prevent abuse.

### Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth` | 10 requests | 5 minutes |
| `/user-settings` | 30 requests | 1 minute |
| `/workout-logs` | 30 requests | 1 minute |
| `/migrate-data` | 3 requests | 1 hour |
| `/export-data` | 5 requests | 5 minutes |

### Rate Limit Response
```http
HTTP 429 Too Many Requests
Retry-After: 120

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again in 2 minutes."
}
```

---

## Error Handling

### Standard Error Format

All errors use a consistent format with structured logging:

```json
{
  "error": "Error type",
  "message": "Human-readable description",
  "correlationId": "abc123def456",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### Common Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `400` | Bad Request | Invalid JSON, missing required fields |
| `401` | Unauthorized | Invalid/missing token, expired token |
| `403` | Forbidden | Valid token but insufficient permissions |
| `404` | Not Found | User data not found, invalid endpoint |
| `409` | Conflict | ETag mismatch, concurrent modification |
| `413` | Payload Too Large | Request body exceeds size limits |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |

### Security Features

- **No sensitive data** in error messages
- **Correlation IDs** for debugging without exposing internals
- **Structured logging** for operational monitoring
- **Request validation** prevents malformed data

---

## CORS Policy

### Allowed Origins
- `https://eos-fitness-tracker.netlify.app` (production)
- `https://*.netlify.app` (deploy previews)
- `http://localhost:*` (local development)

### Supported Methods
- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

### Required Headers
- `Content-Type: application/json` for write operations
- `Authorization: Bearer {token}` or `x-user-token: {token}`

---

## Migration Guide

### Upgrading from Local Storage

If you're upgrading from the local version of EOS Fitness Tracker:

#### 1. Register for Cloud Account
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "register", "userName": "Your Name"}' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/auth
```

#### 2. Export Local Data
Use your browser's developer tools to export localStorage:
```javascript
// In browser console
const localData = {
  settings: JSON.parse(localStorage.getItem('eosSettings') || '{}'),
  workoutLogs: JSON.parse(localStorage.getItem('eosWorkoutLogs') || '{}')
};
console.log(JSON.stringify(localData, null, 2));
```

#### 3. Migrate to Cloud
```bash
curl -X POST \
  -H "Authorization: Bearer {your-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "localSettings": {...},
    "localWorkoutLogs": {...}
  }' \
  https://eos-fitness-tracker.netlify.app/.netlify/functions/migrate-data
```

#### 4. Update Client Code
Replace direct localStorage calls with API calls:

```javascript
// Old (localStorage):
const settings = JSON.parse(localStorage.getItem('eosSettings'));

// New (API):
const response = await fetch('/.netlify/functions/user-settings', {
  headers: { 'Authorization': `Bearer ${userToken}` }
});
const { settings } = await response.json();
```

### Legacy Authentication Support

During migration period, legacy `x-user-id` headers are supported when `ALLOW_LEGACY_AUTH=true` environment variable is set. **This should be disabled after migration is complete.**

---

## Environment Configuration

### Required Environment Variables

Set these in your Netlify site settings:

```bash
USER_TOKEN_SECRET=your-cryptographically-secure-secret-here
CORS_ORIGIN=https://your-domain.com
```

### Optional Environment Variables

```bash
ALLOW_LEGACY_AUTH=false  # Enable legacy auth during migration
LOG_LEVEL=info          # debug, info, warn, error
```

---

## Security Best Practices

### Token Management
- **Store tokens securely** (httpOnly cookies recommended)
- **Implement token refresh** before expiration
- **Never log tokens** in client-side code
- **Use HTTPS only** in production

### API Usage
- **Always include ETags** for write operations
- **Handle 409 conflicts** gracefully with retry logic
- **Implement exponential backoff** for rate limit responses
- **Validate responses** and handle errors appropriately

### Data Protection
- **Minimize data exposure** in client-side code
- **Implement client-side encryption** for sensitive data
- **Regular data exports** for backup purposes
- **Monitor API usage** for unusual patterns

---

## Support and Troubleshooting

### Common Issues

#### Authentication Errors
```bash
# Verify token is valid
curl -H "Authorization: Bearer {token}" \
     https://eos-fitness-tracker.netlify.app/.netlify/functions/user-settings
```

#### Rate Limiting
- Wait for the retry period specified in `Retry-After` header
- Implement exponential backoff in your client

#### Concurrency Conflicts
- Always use ETags for write operations
- Implement conflict resolution by fetching latest data and retrying

### Debug Information

All responses include a `correlationId` for debugging. Include this when reporting issues:

```json
{
  "correlationId": "abc123def456",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### Testing

Use the provided test suite to validate your integration:

```bash
# Clone the repository and run tests
node test-security-fixes.js https://your-deployment-url
```

---

## Changelog

### Version 2.0.0 (Current)
- **Added**: HMAC-signed authentication tokens
- **Added**: ETag-based concurrency control
- **Added**: Comprehensive rate limiting
- **Added**: Structured error responses
- **Added**: Data migration endpoints
- **Added**: Export functionality
- **Enhanced**: Security headers and CORS policies
- **Enhanced**: Request validation and logging

### Version 1.0.0 (Legacy)
- Local storage-based application
- No authentication required
- Single-user design