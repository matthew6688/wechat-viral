-- Add email and password authentication
-- Migration 006: Add email and password fields for admin login

-- First check if columns exist, if they do, alter them to correct size
DO $$
BEGIN
  -- Add or alter email column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
    ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(255);
  ELSE
    ALTER TABLE users ADD COLUMN email VARCHAR(255);
  END IF;
  
  -- Add unique constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
  
  -- Add password_hash column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
    ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
