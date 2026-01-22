-- WeChat Official Account QR Code System Migration
-- Migration 003: Add OA QR code system and admin support

-- 1. Extend users table, add admin field and unionid
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unionid VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS openid_oa VARCHAR(128); -- Official Account openid
CREATE INDEX IF NOT EXISTS idx_users_unionid ON users(unionid) WHERE unionid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- 2. Official Account QR codes table
CREATE TABLE IF NOT EXISTS oa_qrcodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scene_str VARCHAR(255) NOT NULL, -- Scene value, e.g., "ref_ABC123"
    ticket VARCHAR(255) UNIQUE NOT NULL, -- WeChat returned ticket
    qr_type VARCHAR(20) NOT NULL, -- 'permanent' or 'temporary'
    qr_url TEXT NOT NULL, -- QR code image URL
    expire_seconds INTEGER, -- Temporary QR code expiration time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, scene_str)
);

CREATE INDEX IF NOT EXISTS idx_oa_qrcodes_user_id ON oa_qrcodes(user_id);
CREATE INDEX IF NOT EXISTS idx_oa_qrcodes_scene_str ON oa_qrcodes(scene_str);

-- 3. Official Account scan events table
CREATE TABLE IF NOT EXISTS oa_scan_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    openid VARCHAR(128) NOT NULL, -- Scanner's openid
    unionid VARCHAR(128), -- If bound to Open Platform
    scene_str VARCHAR(255) NOT NULL, -- Scene value
    event_type VARCHAR(20) NOT NULL, -- 'subscribe' or 'SCAN'
    inviter_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Referrer
    scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oa_scan_events_openid ON oa_scan_events(openid);
CREATE INDEX IF NOT EXISTS idx_oa_scan_events_scene_str ON oa_scan_events(scene_str);
CREATE INDEX IF NOT EXISTS idx_oa_scan_events_inviter ON oa_scan_events(inviter_user_id);

-- 4. Official Account follow events table
CREATE TABLE IF NOT EXISTS oa_follow_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    openid VARCHAR(128) NOT NULL,
    unionid VARCHAR(128),
    scene_str VARCHAR(255), -- Scene value (if any)
    inviter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    follow_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unfollow_time TIMESTAMP WITH TIME ZONE, -- Unfollow time
    is_following BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_oa_follow_events_openid ON oa_follow_events(openid);
CREATE INDEX IF NOT EXISTS idx_oa_follow_events_unionid ON oa_follow_events(unionid) WHERE unionid IS NOT NULL;

-- 5. Poster templates table (optional, for custom posters)
CREATE TABLE IF NOT EXISTS poster_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    background_url TEXT NOT NULL,
    qr_position_x INTEGER DEFAULT 100,
    qr_position_y INTEGER DEFAULT 400,
    qr_size INTEGER DEFAULT 200,
    name_position_x INTEGER DEFAULT 150,
    name_position_y INTEGER DEFAULT 350,
    name_font_size INTEGER DEFAULT 24,
    name_color VARCHAR(20) DEFAULT '#000000',
    avatar_position_x INTEGER DEFAULT 150,
    avatar_position_y INTEGER DEFAULT 250,
    avatar_size INTEGER DEFAULT 80,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
