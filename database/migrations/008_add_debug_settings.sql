-- Debug Settings Migration
-- Migration 008: Add debug settings table for admin configuration

CREATE TABLE IF NOT EXISTS debug_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_settings_key ON debug_settings(key);
CREATE INDEX IF NOT EXISTS idx_debug_settings_updated_at ON debug_settings(updated_at DESC);

-- Insert default debug settings
INSERT INTO debug_settings (key, value, description) VALUES
    ('log_level', '"info"', 'Logging level: debug, info, warn, error'),
    ('debug_mode', 'false', 'Enable debug mode (more verbose logging)'),
    ('event_log_enabled', 'true', 'Enable event logging'),
    ('api_logging', 'true', 'Enable API request/response logging'),
    ('error_tracking', 'true', 'Enable error tracking and reporting'),
    ('performance_monitoring', 'false', 'Enable performance monitoring'),
    ('max_log_retention_days', '30', 'Maximum days to retain logs'),
    ('show_sensitive_data', 'false', 'Show sensitive data in logs (WARNING: security risk)')
ON CONFLICT (key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE debug_settings IS 'Admin-configurable debug and logging settings';
COMMENT ON COLUMN debug_settings.key IS 'Setting key (unique identifier)';
COMMENT ON COLUMN debug_settings.value IS 'Setting value (JSON format)';
COMMENT ON COLUMN debug_settings.description IS 'Human-readable description of the setting';
