# Debug Settings Setup Guide

## Overview

The debug settings feature allows administrators to configure logging, debugging, and monitoring options from the admin dashboard.

## Database Migration

**Important**: You must run the database migration before using debug settings.

### Step 1: Run Migration

In Supabase SQL Editor, run:

```sql
-- File: database/migrations/008_add_debug_settings.sql
```

This will:
- Create the `debug_settings` table
- Insert 8 default settings with sensible defaults

### Step 2: Verify Migration

Check if the table was created:

```sql
SELECT * FROM debug_settings;
```

You should see 8 rows with default settings.

## Available Settings

| Setting Key | Default | Description |
|------------|---------|-------------|
| `log_level` | `"info"` | Logging level: debug, info, warn, error |
| `debug_mode` | `false` | Enable debug mode (more verbose logging) |
| `event_log_enabled` | `true` | Enable event logging to database |
| `api_logging` | `true` | Enable API request/response logging |
| `error_tracking` | `true` | Enable error tracking and reporting |
| `performance_monitoring` | `false` | Enable performance monitoring |
| `max_log_retention_days` | `30` | Maximum days to retain logs |
| `show_sensitive_data` | `false` | Show sensitive data in logs (⚠️ security risk) |

## Usage

### In Admin Dashboard

1. Login to admin dashboard: `http://localhost:3000/admin/login.html`
2. Navigate to "Debug Settings" section
3. Modify settings as needed
4. Click "Save Settings"

### In Code

```typescript
import { 
  getDebugSettings, 
  isDebugModeEnabled, 
  getLogLevel,
  isEventLoggingEnabled 
} from '../services/debug-settings';

// Get all settings
const settings = await getDebugSettings();

// Check specific settings
const debugMode = await isDebugModeEnabled();
const logLevel = await getLogLevel();
const eventLogging = await isEventLoggingEnabled();
```

## Troubleshooting

### "Failed to load settings" Error

**Possible causes:**
1. Database migration not run - Run `008_add_debug_settings.sql`
2. Table doesn't exist - Check Supabase tables
3. Permission issue - Verify admin user has access

**Solution:**
- Run the migration SQL file
- Check browser console for detailed error messages
- Verify admin authentication token is valid

### Settings Not Saving

**Check:**
1. Admin user is authenticated
2. Database connection is working
3. Check backend logs for errors

### Default Settings

If the table doesn't exist or there's an error, the system will return default settings:
- All logging enabled
- Debug mode disabled
- Log level: info
- 30 days retention

## API Endpoints

- `GET /api/admin/settings/debug` - Get all debug settings
- `PUT /api/admin/settings/debug` - Update debug settings
- `GET /api/admin/settings/debug/:key` - Get specific setting

All endpoints require admin authentication.
