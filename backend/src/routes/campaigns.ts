/**
 * Campaign Routes
 * 
 * API endpoints for campaign fission system
 */

import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import {
  getCampaign,
  getActiveCampaigns,
  getCampaignRewards,
  getOrCreateParticipant,
  getParticipantByUserId,
  findParticipantByCode,
  getHelpers,
  createCampaignQRCode,
  getCampaignQRCodeImage,
  getCampaignStats,
  getCampaignDebugEvents,
  generateCampaignSceneStr,
  canClaimReward,
  claimReward,
  getClaimedRewards,
  getClaimableRewards,
} from '../services/campaign-service';
import { supabase } from '../config/supabase';
import { logEvent } from '../services/event-logger';

const router = express.Router();

// ============================================
// Public Routes (no auth required)
// ============================================

/**
 * GET /api/campaigns
 * Get all active campaigns
 */
router.get('/', async (req, res) => {
  try {
    const campaigns = await getActiveCampaigns();
    
    res.json({
      success: true,
      data: { campaigns },
    });
  } catch (error: any) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: error.message || 'Failed to get campaigns' });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign details
 */
router.get('/:id', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const rewards = await getCampaignRewards(campaign.id);

    res.json({
      success: true,
      data: {
        campaign,
        rewards,
      },
    });
  } catch (error: any) {
    console.error('Get campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to get campaign' });
  }
});

// ============================================
// Authenticated Routes
// ============================================

/**
 * POST /api/campaigns/:id/join
 * Join a campaign (become a participant)
 */
router.post('/:id/join', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;

    // Verify campaign exists and is active
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    // Get or create participant
    const participant = await getOrCreateParticipant(campaignId, userId);
    const rewards = await getCampaignRewards(campaignId);

    res.json({
      success: true,
      data: {
        participant,
        rewards,
        sceneStr: generateCampaignSceneStr(campaignId, participant.referral_code),
      },
    });
  } catch (error: any) {
    console.error('Join campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to join campaign' });
  }
});

/**
 * GET /api/campaigns/:id/my-progress
 * Get current user's progress in a campaign
 */
router.get('/:id/my-progress', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;

    const participant = await getParticipantByUserId(campaignId, userId);
    
    if (!participant) {
      return res.json({
        success: true,
        data: {
          joined: false,
          participant: null,
          helpers: [],
          rewards: [],
        },
      });
    }

    const helpers = await getHelpers(participant.id);
    const rewards = await getCampaignRewards(campaignId);

    // Calculate unlocked rewards
    const unlockedRewards = rewards.filter(r => participant.helper_count >= r.helpers_required);
    const nextReward = rewards.find(r => participant.helper_count < r.helpers_required);

    res.json({
      success: true,
      data: {
        joined: true,
        participant,
        helpers,
        rewards,
        unlockedRewards,
        nextReward,
        sceneStr: generateCampaignSceneStr(campaignId, participant.referral_code),
      },
    });
  } catch (error: any) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: error.message || 'Failed to get progress' });
  }
});

/**
 * GET /api/campaigns/:id/qrcode
 * Get campaign QR code for current user
 */
router.get('/:id/qrcode', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;

    // Verify campaign exists
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Create QR code
    const qrCode = await createCampaignQRCode(campaignId, userId);

    res.json({
      success: true,
      data: qrCode,
    });
  } catch (error: any) {
    console.error('Get campaign QR code error:', error);
    res.status(500).json({ error: error.message || 'Failed to get QR code' });
  }
});

/**
 * GET /api/campaigns/:id/qrcode-image
 * Get campaign QR code image for current user
 */
router.get('/:id/qrcode-image', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;

    // Create QR code (will return existing if already created)
    const qrCode = await createCampaignQRCode(campaignId, userId);

    // Get image
    const imageBuffer = await getCampaignQRCodeImage(qrCode.ticket);

    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (error: any) {
    console.error('Get campaign QR code image error:', error);
    res.status(500).json({ error: error.message || 'Failed to get QR code image' });
  }
});

/**
 * GET /api/campaigns/:id/rewards/claimable
 * Get claimable rewards for current user
 */
router.get('/:id/rewards/claimable', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;

    // Get participant
    const participant = await getParticipantByUserId(campaignId, userId);
    
    if (!participant) {
      return res.status(400).json({ error: '请先加入活动' });
    }

    // Get claimable rewards
    const claimableRewards = await getClaimableRewards(campaignId, participant.id);

    res.json({
      success: true,
      data: {
        rewards: claimableRewards,
        helperCount: participant.helper_count,
      },
    });
  } catch (error: any) {
    console.error('Get claimable rewards error:', error);
    res.status(500).json({ error: error.message || 'Failed to get claimable rewards' });
  }
});

/**
 * POST /api/campaigns/:id/rewards/:rewardId/claim
 * Claim a reward
 */
router.post('/:id/rewards/:rewardId/claim', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id: campaignId, rewardId } = req.params;
    const userId = req.userId!;

    // Get participant
    const participant = await getParticipantByUserId(campaignId, userId);
    
    if (!participant) {
      return res.status(400).json({ error: '请先加入活动' });
    }

    // Attempt to claim
    const result = await claimReward(participant.id, rewardId, userId);

    if (!result.success) {
      return res.status(400).json({ 
        success: false,
        error: result.message,
      });
    }

    res.json({
      success: true,
      message: result.message,
      data: {
        claim: result.claim,
        reward: result.reward,
      },
    });
  } catch (error: any) {
    console.error('Claim reward error:', error);
    res.status(500).json({ error: error.message || 'Failed to claim reward' });
  }
});

/**
 * GET /api/campaigns/:id/my-claims
 * Get current user's claimed rewards
 */
router.get('/:id/my-claims', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;

    // Get participant
    const participant = await getParticipantByUserId(campaignId, userId);
    
    if (!participant) {
      return res.json({
        success: true,
        data: { claims: [] },
      });
    }

    // Get claimed rewards
    const claims = await getClaimedRewards(participant.id);

    res.json({
      success: true,
      data: { claims },
    });
  } catch (error: any) {
    console.error('Get my claims error:', error);
    res.status(500).json({ error: error.message || 'Failed to get claims' });
  }
});

/**
 * GET /api/campaigns/:id/participant/:code
 * Get participant info by referral code (for activity page)
 */
router.get('/:id/participant/:code', async (req, res) => {
  try {
    const { id: campaignId, code: referralCode } = req.params;

    const participant = await findParticipantByCode(campaignId, referralCode);
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('id, name, wechat_avatar, wechat_nickname')
      .eq('id', participant.user_id)
      .single();

    // Get helpers
    const helpers = await getHelpers(participant.id);

    // Get rewards
    const rewards = await getCampaignRewards(campaignId);

    // Type assertion for user data
    const userData = user as { id: string; name: string; wechat_avatar: string | null; wechat_nickname: string | null } | null;

    res.json({
      success: true,
      data: {
        participant,
        user: userData ? {
          name: userData.wechat_nickname || userData.name,
          avatar: userData.wechat_avatar,
        } : null,
        helpers: helpers.length,
        rewards,
      },
    });
  } catch (error: any) {
    console.error('Get participant error:', error);
    res.status(500).json({ error: error.message || 'Failed to get participant' });
  }
});

// ============================================
// Admin Routes
// ============================================

/**
 * GET /api/campaigns/:id/stats
 * Get campaign statistics (admin only)
 */
router.get('/:id/stats', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const stats = await getCampaignStats(campaignId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Get campaign stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

/**
 * GET /api/campaigns/:id/debug
 * Get campaign debug events (admin only)
 */
router.get('/:id/debug', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const events = await getCampaignDebugEvents(campaignId, limit);
    const stats = await getCampaignStats(campaignId);

    // Get all participants with user info
    const { data: participants } = await supabase
      .from('campaign_participants')
      .select(`
        *,
        user:users(id, name, wechat_nickname, wechat_avatar)
      `)
      .eq('campaign_id', campaignId)
      .order('joined_at', { ascending: false })
      .limit(100);

    // Get all helpers with details
    const { data: helpers } = await supabase
      .from('campaign_helpers')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(200);

    res.json({
      success: true,
      data: {
        stats,
        events,
        participants: participants || [],
        helpers: helpers || [],
      },
    });
  } catch (error: any) {
    console.error('Get campaign debug error:', error);
    res.status(500).json({ error: error.message || 'Failed to get debug data' });
  }
});

/**
 * GET /api/campaigns/admin/all
 * Get all campaigns (admin only, includes inactive)
 */
router.get('/admin/all', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: { campaigns: campaigns || [] },
    });
  } catch (error: any) {
    console.error('Get all campaigns error:', error);
    res.status(500).json({ error: error.message || 'Failed to get campaigns' });
  }
});

/**
 * POST /api/campaigns/admin/create
 * Create a new campaign with rewards (admin only)
 */
router.post('/admin/create', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      description,
      cover_image_url,
      entry_type = 'simple',
      start_time,
      end_time,
      rules = {},
      anti_cheat_settings = {},
      rewards = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    // Create campaign
    const { data: campaignData, error } = await supabase
      .from('campaigns')
      .insert({
        name,
        description,
        cover_image_url,
        entry_type,
        status: 'active', // Default to active for easier testing
        start_time: start_time || new Date().toISOString(),
        end_time: end_time || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        rules,
        anti_cheat_settings,
      } as Record<string, any>)
      .select()
      .single();

    if (error) throw error;

    const campaign = campaignData as unknown as { id: string; name: string };

    // Create rewards if provided
    if (rewards.length > 0) {
      const rewardsToInsert = rewards.map((reward: any, index: number) => ({
        campaign_id: campaign.id,
        tier_level: reward.tier_level ?? index,
        helpers_required: reward.helpers_required ?? 0,
        reward_name: reward.reward_name || `奖品${index + 1}`,
        reward_description: reward.reward_description || '',
        reward_type: reward.reward_type || 'digital',
        reward_content: reward.reward_content || {},
        stock: reward.stock ?? -1,
      }));

      const { error: rewardsError } = await supabase
        .from('campaign_rewards')
        .insert(rewardsToInsert as Record<string, any>[]);

      if (rewardsError) {
        console.error('Create rewards error:', rewardsError);
        // Don't fail the whole request, just log the error
      }
    }

    // Log event
    await logEvent({
      event_type: 'campaign_created',
      user_id: req.userId!,
      event_data: {
        campaign_id: campaign.id,
        campaign_name: name,
        rewards_count: rewards.length,
      },
    });

    res.json({
      success: true,
      data: { campaign: campaignData },
    });
  } catch (error: any) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to create campaign' });
  }
});

/**
 * PUT /api/campaigns/:id/status
 * Update campaign status (admin only)
 */
router.put('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const { status } = req.body;

    if (!['draft', 'active', 'paused', 'ended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ status, updated_at: new Date().toISOString() } as Record<string, any>)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;

    // Log event
    await logEvent({
      event_type: 'campaign_status_changed',
      user_id: req.userId!,
      event_data: {
        campaign_id: campaignId,
        new_status: status,
      },
    });

    res.json({
      success: true,
      data: { campaign },
    });
  } catch (error: any) {
    console.error('Update campaign status error:', error);
    res.status(500).json({ error: error.message || 'Failed to update status' });
  }
});

export default router;
