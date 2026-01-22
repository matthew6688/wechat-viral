-- Tunnel Configuration Migration
-- Migration 009: Create tunnel_config table for storing Cloudflare tunnel URLs

CREATE TABLE IF NOT EXISTS tunnel_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    last_checked TIMESTAMP WITH TIME ZONE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tunnel_config_updated_at ON tunnel_config(updated_at DESC);

-- Add comment for documentation
COMMENT ON TABLE tunnel_config IS 'Stores Cloudflare tunnel URL configuration';
COMMENT ON COLUMN tunnel_config.url IS 'The Cloudflare tunnel URL (e.g., https://xxx.trycloudflare.com)';
COMMENT ON COLUMN tunnel_config.verified IS 'Whether the tunnel URL has been verified as accessible';
COMMENT ON COLUMN tunnel_config.last_checked IS 'Last time the tunnel URL was checked for connectivity';
