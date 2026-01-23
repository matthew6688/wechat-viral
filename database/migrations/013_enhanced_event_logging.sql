-- Enhanced Event Logging
-- Migration: 013_enhanced_event_logging.sql
-- Description: Add device info, location, session tracking to event_logs

-- ============================================
-- 1. Add device and location fields to event_logs
-- ============================================
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS device_brand VARCHAR(50);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS os_name VARCHAR(20);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS os_version VARCHAR(20);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS app_version VARCHAR(20);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS location_province VARCHAR(100);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS location_country VARCHAR(50) DEFAULT 'CN';
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);

-- Comments for documentation
COMMENT ON COLUMN event_logs.ip_address IS 'Client IP address (IPv4 or IPv6)';
COMMENT ON COLUMN event_logs.user_agent IS 'Full user agent string from request';
COMMENT ON COLUMN event_logs.device_type IS 'Device type: mobile, tablet, desktop';
COMMENT ON COLUMN event_logs.device_brand IS 'Device brand: iPhone, Samsung, Huawei, etc.';
COMMENT ON COLUMN event_logs.os_name IS 'Operating system: iOS, Android, Windows, macOS';
COMMENT ON COLUMN event_logs.os_version IS 'OS version number';
COMMENT ON COLUMN event_logs.app_version IS 'WeChat app version';
COMMENT ON COLUMN event_logs.location_city IS 'City from IP geolocation';
COMMENT ON COLUMN event_logs.location_province IS 'Province/State from IP geolocation';
COMMENT ON COLUMN event_logs.location_country IS 'Country code';
COMMENT ON COLUMN event_logs.session_id IS 'Session identifier to group related events';

-- ============================================
-- 2. Add indexes for efficient querying
-- ============================================
CREATE INDEX IF NOT EXISTS idx_event_logs_ip ON event_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_event_logs_device_type ON event_logs(device_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_location ON event_logs(location_city, location_province);
CREATE INDEX IF NOT EXISTS idx_event_logs_session ON event_logs(session_id);

-- ============================================
-- 3. Add WeChat profile fields to users table
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_nickname VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_gender INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_language VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN users.wechat_avatar_url IS 'WeChat profile avatar URL';
COMMENT ON COLUMN users.wechat_nickname IS 'WeChat nickname';
COMMENT ON COLUMN users.wechat_gender IS 'WeChat gender: 0=unknown, 1=male, 2=female';
COMMENT ON COLUMN users.wechat_language IS 'WeChat language preference';
COMMENT ON COLUMN users.last_active_at IS 'Last activity timestamp';

-- ============================================
-- 4. Create view for enriched events (with user profile)
-- ============================================
CREATE OR REPLACE VIEW event_logs_enriched AS
SELECT 
  e.*,
  u.name as user_name,
  u.wechat_nickname,
  u.wechat_avatar_url,
  u.phone as user_phone,
  c.name as campaign_name,
  c.description as campaign_description
FROM event_logs e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN campaigns c ON (e.metadata->>'campaign_id')::uuid = c.id;

-- ============================================
-- 5. Verification
-- ============================================
SELECT 'Enhanced event logging schema created successfully' as result;
