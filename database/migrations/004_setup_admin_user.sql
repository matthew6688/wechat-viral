-- Setup Admin User
-- Migration 004: Set a user as admin
-- Replace 'YOUR_USER_ID' with the actual user ID or use phone/email to find user

-- Option 1: Set admin by user ID (replace with actual UUID)
-- UPDATE users SET is_admin = TRUE WHERE id = 'YOUR_USER_ID';

-- Option 2: Set admin by phone number
-- UPDATE users SET is_admin = TRUE WHERE phone = 'YOUR_PHONE_NUMBER';

-- Option 3: Set admin by email
-- UPDATE users SET is_admin = TRUE WHERE email = 'YOUR_EMAIL';

-- Example: Set first user as admin (use with caution)
-- UPDATE users SET is_admin = TRUE WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);

-- Verify admin user
-- SELECT id, name, phone, email, is_admin FROM users WHERE is_admin = TRUE;
