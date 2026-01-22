-- Event Logs System Migration
-- Migration 007: Create unified event logs table for all system events

CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL, -- 'login', 'register', 'scan_qr', 'follow_oa', 'unfollow_oa', 'invite', 'redeem', etc.
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    related_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- For invite events, this is the inviter/invitee
    event_data JSONB, -- Flexible JSON data for event-specific information
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_type_created ON event_logs(event_type, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE event_logs IS 'Unified event log table for tracking all system events (login, register, scan, follow, etc.)';
COMMENT ON COLUMN event_logs.event_type IS 'Type of event: login, register, scan_qr, follow_oa, unfollow_oa, invite, redeem, etc.';
COMMENT ON COLUMN event_logs.event_data IS 'JSON data containing event-specific information (scene_str, referral_code, etc.)';
