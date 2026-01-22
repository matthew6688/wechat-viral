-- Analytics & Tracking Enhancement
-- Migration: 012_add_analytics_tracking.sql
-- Description: Add source tracking, user interactions, and influence scoring

-- ============================================
-- 1. Add source_channel to campaign_helpers
-- ============================================
ALTER TABLE campaign_helpers ADD COLUMN IF NOT EXISTS source_channel VARCHAR(50);
-- Values: wechat_scan, wechat_article, wechat_menu, moments, group_chat, private_chat

COMMENT ON COLUMN campaign_helpers.source_channel IS 'Source channel: wechat_scan, wechat_article, wechat_menu, moments, group_chat, private_chat';

-- ============================================
-- 2. Add influence tracking to campaign_participants
-- ============================================
ALTER TABLE campaign_participants ADD COLUMN IF NOT EXISTS influence_score INTEGER DEFAULT 0;
ALTER TABLE campaign_participants ADD COLUMN IF NOT EXISTS secondary_referral_count INTEGER DEFAULT 0;

COMMENT ON COLUMN campaign_participants.influence_score IS 'Calculated influence score based on helpers, retention, secondary referrals';
COMMENT ON COLUMN campaign_participants.secondary_referral_count IS 'Number of people referred by this participants helpers';

-- ============================================
-- 3. Create user_interactions table
-- ============================================
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  openid VARCHAR(100),
  interaction_type VARCHAR(50) NOT NULL, -- message, menu_click, article_read, mini_program_open, poster_generated, qr_scanned
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_openid ON user_interactions(openid);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_campaign ON user_interactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created ON user_interactions(created_at);

-- ============================================
-- 4. Create analytics_daily table for aggregated stats
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  new_participants INTEGER DEFAULT 0,
  new_helpers INTEGER DEFAULT 0,
  valid_helpers INTEGER DEFAULT 0,
  unfollows INTEGER DEFAULT 0,
  rewards_claimed INTEGER DEFAULT 0,
  qr_generated INTEGER DEFAULT 0,
  poster_generated INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_campaign ON analytics_daily(campaign_id);

-- ============================================
-- 5. Add retention tracking to campaign_helpers
-- ============================================
ALTER TABLE campaign_helpers ADD COLUMN IF NOT EXISTS follow_duration_hours INTEGER;

COMMENT ON COLUMN campaign_helpers.follow_duration_hours IS 'Hours between follow and unfollow (NULL if still following)';

-- ============================================
-- 6. Verification
-- ============================================
SELECT 'Analytics tracking tables created successfully' as result;
