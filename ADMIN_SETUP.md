# Admin Account Setup Guide

This guide will help you set up an admin account to access the debug data in the admin panel.

## Quick Setup Using UnionID (Recommended)

**UnionID** is the best way to set up admin because it's:
- Unique across all WeChat products (Mini Program, Official Account, etc.)
- Stable and doesn't change
- Available if your account is bound to WeChat Open Platform

### Steps:

1. **Log into the Mini Program** and go to the **"我的" (Profile)** page
2. **Find your UnionID** - it will be displayed in the profile page
3. **Run the setup script**:
   ```bash
   cd backend
   node scripts/set-admin.js --unionid YOUR_UNIONID
   ```
4. **Restart the Mini Program** and you'll see the "管理员后台" button

---

## Other Setup Methods

## Method 1: Using the Setup Script (Recommended)

### Step 1: List all users to find your user ID

```bash
cd backend
node scripts/set-admin.js --list
```

This will show you all users in the database with their IDs, names, phones, and admin status.

### Step 2: Set yourself as admin

Once you find your user ID, run:

```bash
# Option A: By user ID (UUID)
node scripts/set-admin.js <your-user-id>

# Option B: By phone number
node scripts/set-admin.js --phone <your-phone-number>

# Option C: By WeChat openid
node scripts/set-admin.js --openid <your-openid>

# Option E: Set the first user (oldest) as admin
node scripts/set-admin.js --first
```

### Example:

```bash
# List users
node scripts/set-admin.js --list

# Output:
# 📋 Users in database:
# ────────────────────────────────────────────────────────────────
# 1. 微信用户
#    ID: 7731bb9c-ace6-4805-9973-d87319f486ee
#    Phone: temp_1737523456789_abc123
#    OpenID: oXxxxxx...
#    Admin: ❌ No
#    Created: 1/22/2026, 4:00:00 PM
# ────────────────────────────────────────────────────────────────

# Set as admin using the ID
node scripts/set-admin.js 7731bb9c-ace6-4805-9973-d87319f486ee

# Output:
# ✅ Successfully set user as admin:
# {
#   "id": "7731bb9c-ace6-4805-9973-d87319f486ee",
#   "name": "微信用户",
#   "phone": "temp_1737523456789_abc123",
#   "is_admin": true
# }
```

## Method 2: Using the API Endpoint

### Step 1: Find your user ID

You can use the `/api/users/find` endpoint to find your user:

```bash
# By phone
curl "http://localhost:3000/api/users/find?phone=YOUR_PHONE"

# By openid (if you know it)
curl "http://localhost:3000/api/users/find?openid=YOUR_OPENID"
```

### Step 2: Set admin via SQL

Connect to your Supabase database and run:

```sql
-- Replace with your user ID
UPDATE users SET is_admin = TRUE WHERE id = 'YOUR_USER_ID';

-- Verify
SELECT id, name, phone, is_admin FROM users WHERE id = 'YOUR_USER_ID';
```

## Method 3: Direct SQL Query

If you have direct access to your Supabase database:

```sql
-- List all users
SELECT id, name, phone, openid, is_admin, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 20;

-- Set a user as admin by ID
UPDATE users SET is_admin = TRUE WHERE id = 'YOUR_USER_ID';

-- Set a user as admin by phone
UPDATE users SET is_admin = TRUE WHERE phone = 'YOUR_PHONE';

-- Set the first user as admin
UPDATE users SET is_admin = TRUE 
WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);

-- Verify admin users
SELECT id, name, phone, is_admin FROM users WHERE is_admin = TRUE;
```

## Accessing the Admin Panel

Once you've set yourself as admin:

1. **Restart the Mini Program** (or log out and log back in)
2. Go to the **"我的" (Profile)** page
3. You should see a **"管理员后台" (Admin Panel)** button
4. Click it to access the debug data

## Admin Panel Features

The admin panel has three tabs:

1. **Debug数据 (Debug Data)**
   - Scan events (扫码事件) - All QR code scan events
   - Follow events (关注事件) - All OA follow/unfollow events
   - Referral chain (推荐关系链) - View referral relationships for any user

2. **数据统计 (Statistics)**
   - Total users
   - Today's new users
   - Total scans
   - Total follows
   - Total invites
   - Conversion rate

3. **后台设置 (Settings)**
   - Activity settings (currently read-only)

## Troubleshooting

### "无管理员权限" (No admin permission)

- Make sure you've set `is_admin = TRUE` in the database
- Restart the Mini Program or log out and log back in
- Check that your user ID matches the one in the database

### Can't find my user

- Make sure you've logged into the Mini Program at least once
- Check the backend logs for your `openid` when you log in
- Use `--list` to see all users in the database

### Script errors

- Make sure you have `.env` file in the `backend/` directory with:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY` (or `SUPABASE_ANON_KEY`)
- Make sure you're running the script from the `backend/` directory

## Need Help?

If you're still having issues:
1. Check the backend terminal logs for errors
2. Verify your Supabase connection
3. Make sure the `users` table has the `is_admin` column (run migration 003 if needed)
