# Setup Admin User with Email/Password Login

## Step 1: Run Database Migration

First, you need to add the `email` and `password_hash` columns to the `users` table.

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL:

```sql
-- Add email and password authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
```

### Option B: Using Migration File

The migration file is located at:
`database/migrations/006_add_email_password_auth.sql`

## Step 2: Create Admin User

After running the migration, create the admin user:

```bash
cd backend
node scripts/create-admin-user.js matthewkiata@gmail.com 12121212 "Matthew"
```

This will:
- Create a user with email `matthewkiata@gmail.com`
- Set password to `12121212`
- Set the user as admin (`is_admin = true`)
- Hash the password securely using bcrypt

## Step 3: Access Admin Login Page

1. Open `admin/login.html` in your browser
2. Or serve it through your backend (see below)

### Serving the Admin Pages

You can serve the admin pages through your Express backend by adding static file serving:

```typescript
// In backend/src/index.ts
import express from 'express';
import path from 'path';

// ... existing code ...

// Serve admin pages
app.use('/admin', express.static(path.join(__dirname, '../../admin')));
```

Then access at: `http://localhost:3000/admin/login.html`

## Login Credentials

- **Email**: `matthewkiata@gmail.com`
- **Password**: `12121212`

## API Endpoint

The email/password login endpoint is:
- **POST** `/api/auth/login-email`
- **Body**: `{ "email": "matthewkiata@gmail.com", "password": "12121212" }`
- **Response**: `{ "data": { "token": "...", "user": {...} } }`

## Notes

- The admin login page stores the token in `localStorage` as `admin_token`
- The dashboard page (`admin/dashboard.html`) will automatically redirect to login if not authenticated
- You can use the same JWT token for API calls with `Authorization: Bearer <token>` header
