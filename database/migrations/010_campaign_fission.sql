-- Campaign Fission System Tables
-- Migration: 010_campaign_fission.sql
-- Description: Core tables for viral campaign/fission marketing system

-- ============================================
-- 1. Campaigns table (活动配置)
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  entry_type VARCHAR(50) DEFAULT 'simple', -- simple, article, h5
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, ended
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  rules JSONB DEFAULT '{}', -- 活动规则配置 {"max_helpers_per_day": 10, "min_follow_duration_hours": 0}
  anti_cheat_settings JSONB DEFAULT '{}', -- 防作弊设置
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Campaign Rewards table (奖品阶梯)
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tier_level INTEGER NOT NULL DEFAULT 0, -- 0 = 基础奖励(0人助力), 1+ = 阶梯奖励
  helpers_required INTEGER NOT NULL DEFAULT 0, -- 所需助力人数
  reward_name VARCHAR(255) NOT NULL,
  reward_description TEXT,
  reward_type VARCHAR(50) DEFAULT 'digital', -- digital, physical, coupon
  reward_content JSONB DEFAULT '{}', -- 奖品内容(链接/兑换码等)
  stock INTEGER DEFAULT -1, -- -1 = 无限
  claimed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Campaign Participants table (参与记录)
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL, -- 该用户在此活动的专属邀请码
  helper_count INTEGER DEFAULT 0, -- 有效助力人数(缓存)
  total_helper_count INTEGER DEFAULT 0, -- 总助力人数(含取关的)
  highest_tier_claimed INTEGER DEFAULT -1, -- 已领取的最高奖励等级
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, user_id),
  UNIQUE(campaign_id, referral_code)
);

-- ============================================
-- 4. Campaign Helpers table (助力记录)
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  helper_openid VARCHAR(100) NOT NULL, -- 助力者的openid
  helper_unionid VARCHAR(100), -- 助力者的unionid(如果有)
  helper_user_id UUID REFERENCES users(id), -- 如果助力者也是注册用户
  is_valid BOOLEAN DEFAULT TRUE, -- 是否有效
  invalidated_at TIMESTAMP WITH TIME ZONE, -- 失效时间
  invalidate_reason VARCHAR(50), -- 失效原因: unfollow, cheat, manual
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, participant_id, helper_openid) -- 同一人只能帮同一人助力一次
);

-- ============================================
-- 5. Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_campaign_rewards_campaign ON campaign_rewards(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_rewards_tier ON campaign_rewards(campaign_id, tier_level);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_user ON campaign_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_code ON campaign_participants(referral_code);
CREATE INDEX IF NOT EXISTS idx_campaign_helpers_participant ON campaign_helpers(participant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_helpers_openid ON campaign_helpers(helper_openid);
CREATE INDEX IF NOT EXISTS idx_campaign_helpers_valid ON campaign_helpers(is_valid);
CREATE INDEX IF NOT EXISTS idx_campaign_helpers_campaign ON campaign_helpers(campaign_id);

-- ============================================
-- 6. Insert a test campaign for MVP
-- ============================================
INSERT INTO campaigns (name, description, status, start_time, end_time, rules, anti_cheat_settings)
VALUES (
  'MVP测试活动',
  '这是一个用于测试裂变流程的活动。邀请好友关注公众号，即可获得积分奖励！',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days',
  '{"max_helpers_per_day": 10, "min_follow_duration_hours": 0}',
  '{"check_same_device": false, "check_ip_limit": false}'
);

-- ============================================
-- 7. Insert test rewards for the campaign
-- ============================================
-- Get the campaign ID and insert rewards
DO $$
DECLARE
  campaign_uuid UUID;
BEGIN
  SELECT id INTO campaign_uuid FROM campaigns WHERE name = 'MVP测试活动' LIMIT 1;
  
  IF campaign_uuid IS NOT NULL THEN
    -- Tier 0: 基础奖励 (0人助力)
    INSERT INTO campaign_rewards (campaign_id, tier_level, helpers_required, reward_name, reward_description, reward_type, reward_content)
    VALUES (
      campaign_uuid,
      0,
      0,
      '基础资源包',
      '免费获取AI出口增长入门指南PDF',
      'digital',
      '{"download_url": "https://example.com/free-guide.pdf", "description": "30页入门指南"}'
    );
    
    -- Tier 1: 邀请3人
    INSERT INTO campaign_rewards (campaign_id, tier_level, helpers_required, reward_name, reward_description, reward_type, reward_content)
    VALUES (
      campaign_uuid,
      1,
      3,
      '进阶资源包',
      '邀请3位好友解锁进阶策略文档',
      'digital',
      '{"download_url": "https://example.com/advanced-guide.pdf", "description": "50页进阶策略"}'
    );
    
    -- Tier 2: 邀请8人
    INSERT INTO campaign_rewards (campaign_id, tier_level, helpers_required, reward_name, reward_description, reward_type, reward_content)
    VALUES (
      campaign_uuid,
      2,
      8,
      '专属咨询',
      '邀请8位好友获得1对1咨询机会',
      'digital',
      '{"booking_url": "https://calendly.com/example", "description": "30分钟1对1咨询"}'
    );
    
    RAISE NOTICE 'Test campaign and rewards created successfully. Campaign ID: %', campaign_uuid;
  ELSE
    RAISE NOTICE 'Campaign not found, rewards not inserted.';
  END IF;
END $$;

-- ============================================
-- 8. Verify tables created
-- ============================================
SELECT 
  'campaigns' as table_name, 
  COUNT(*) as row_count 
FROM campaigns
UNION ALL
SELECT 
  'campaign_rewards' as table_name, 
  COUNT(*) as row_count 
FROM campaign_rewards
UNION ALL
SELECT 
  'campaign_participants' as table_name, 
  COUNT(*) as row_count 
FROM campaign_participants
UNION ALL
SELECT 
  'campaign_helpers' as table_name, 
  COUNT(*) as row_count 
FROM campaign_helpers;
