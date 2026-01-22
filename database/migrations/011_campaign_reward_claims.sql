-- Campaign Reward Claims Table
-- Migration: 011_campaign_reward_claims.sql
-- Description: Track reward claims by participants

-- ============================================
-- 1. Reward Claims table (奖品领取记录)
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES campaign_rewards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_level INTEGER NOT NULL, -- 领取的奖励等级
  helper_count_at_claim INTEGER NOT NULL, -- 领取时的助力人数
  reward_content JSONB, -- 领取时的奖品内容快照
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, reward_id) -- 同一参与者同一奖品只能领取一次
);

-- ============================================
-- 2. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_reward_claims_campaign ON campaign_reward_claims(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_participant ON campaign_reward_claims(participant_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_user ON campaign_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_reward ON campaign_reward_claims(reward_id);

-- ============================================
-- 3. Verify table created
-- ============================================
SELECT 
  'campaign_reward_claims' as table_name, 
  COUNT(*) as row_count 
FROM campaign_reward_claims;
