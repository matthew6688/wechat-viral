-- Add WeChat profile fields (avatar and nickname)
-- Migration 005: Add avatar_url and nickname columns to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- Add index for nickname if needed for searches
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname IS NOT NULL;
