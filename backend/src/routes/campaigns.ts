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
import { 
  generateCampaignPoster, 
  generateCampaignPosterBase64,
  clearCampaignPosterCache 
} from '../services/poster-generator';

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
          rewardsWithStatus: [],
        },
      });
    }

    const helpers = await getHelpers(participant.id);
    const rewards = await getCampaignRewards(campaignId);
    
    // Get rewards with claim status
    const rewardsWithStatus = await getClaimableRewards(campaignId, participant.id);
    
    // Get claimed rewards to add claim details
    const claimedRewards = await getClaimedRewards(participant.id);
    const claimsMap = new Map(claimedRewards.map(c => [c.reward_id, c]));
    
    // Enhance rewardsWithStatus with claim details
    const enhancedRewardsWithStatus = rewardsWithStatus.map(item => ({
      ...item,
      claim: claimsMap.get(item.reward.id) || null,
    }));

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
        rewardsWithStatus: enhancedRewardsWithStatus,
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
 * Get enhanced campaign debug data (admin only)
 */
router.get('/:id/debug', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const events = await getCampaignDebugEvents(campaignId, limit);
    const stats = await getCampaignStats(campaignId);

    // Get campaign info with rewards
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    // Get rewards for this campaign
    const { data: rewards } = await supabase
      .from('campaign_rewards')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('helpers_required', { ascending: true });

    // Get all participants with user info and claimed rewards count
    const { data: participants } = await supabase
      .from('campaign_participants')
      .select(`
        *,
        user:users(id, name, phone, wechat_nickname, wechat_avatar_url)
      `)
      .eq('campaign_id', campaignId)
      .order('helper_count', { ascending: false })
      .limit(100);

    // Get reward claims for each participant
    const { data: rewardClaims } = await supabase
      .from('campaign_reward_claims')
      .select(`
        *,
        reward:campaign_rewards(name, tier_level, helpers_required)
      `)
      .eq('campaign_id', campaignId)
      .order('claimed_at', { ascending: false });

    // Map claims to participants
    const claimsByParticipant: Record<string, any[]> = {};
    (rewardClaims || []).forEach((claim: any) => {
      if (!claimsByParticipant[claim.participant_id]) {
        claimsByParticipant[claim.participant_id] = [];
      }
      claimsByParticipant[claim.participant_id].push(claim);
    });

    // Enhance participants with claims
    const enhancedParticipants = (participants || []).map((p: any) => ({
      ...p,
      claims: claimsByParticipant[p.id] || [],
      claimedTiers: (claimsByParticipant[p.id] || []).map((c: any) => c.reward?.tier_level),
    }));

    // Get all helpers with participant info AND helper user info
    const { data: helpers } = await supabase
      .from('campaign_helpers')
      .select(`
        *,
        helper_user:users!campaign_helpers_helper_user_id_fkey(
          id, name, wechat_nickname, wechat_avatar_url
        ),
        participant:campaign_participants(
          id,
          referral_code,
          user:users(id, name, wechat_nickname, wechat_avatar_url)
        )
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(200);

    // Transform helpers to include display names
    const transformedHelpers = (helpers || []).map((h: any) => ({
      ...h,
      display_name: h.helper_user?.wechat_nickname || h.helper_user?.name || '微信用户',
      avatar_url: h.helper_user?.wechat_avatar_url || null,
    }));

    // Get leaderboard (top 10 performers)
    const leaderboard = (enhancedParticipants || []).slice(0, 10).map((p: any, index: number) => ({
      rank: index + 1,
      userId: p.user?.id,
      name: p.user?.wechat_nickname || p.user?.name || 'Unknown',
      avatar: p.user?.wechat_avatar_url,
      helperCount: p.helper_count || 0,
      claimedTiers: p.claimedTiers || [],
      referralCode: p.referral_code,
    }));

    // Calculate campaign health
    const now = new Date();
    const endDate = campaign?.end_time ? new Date(campaign.end_time) : null;
    const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null;
    
    const health = {
      isActive: campaign?.status === 'active',
      hasParticipants: (stats.totalParticipants || 0) > 0,
      hasHelpers: (stats.totalHelpers || 0) > 0,
      hasRecentActivity: (stats.helpersToday || 0) > 0,
      retentionHealthy: (stats.retentionRate || 100) >= 70,
      hasRewardsStock: true, // Could check stock if implemented
      daysRemaining,
      unfollowsToday: 0, // Could track this
    };

    res.json({
      success: true,
      data: {
        campaign,
        rewards: rewards || [],
        stats,
        events,
        participants: enhancedParticipants,
        helpers: transformedHelpers,
        leaderboard,
        health,
        rewardClaims: rewardClaims || [],
      },
    });
  } catch (error: any) {
    console.error('Get campaign debug error:', error);
    res.status(500).json({ error: error.message || 'Failed to get debug data' });
  }
});

/**
 * GET /api/campaigns/:id/report
 * Get comprehensive campaign report data (admin only)
 * Includes KPIs, funnel, daily trends, reward distribution, and export-ready data
 */
router.get('/:id/report', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const { startDate, endDate } = req.query;
    
    // Get campaign info
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get rewards
    const { data: rewards } = await supabase
      .from('campaign_rewards')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('helpers_required', { ascending: true });

    // Get all participants
    const { data: participants } = await supabase
      .from('campaign_participants')
      .select(`
        *,
        user:users(id, name, wechat_nickname, wechat_avatar_url)
      `)
      .eq('campaign_id', campaignId)
      .order('helper_count', { ascending: false });

    // Get all helpers
    const { data: helpers } = await supabase
      .from('campaign_helpers')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    // Get all reward claims
    const { data: rewardClaims } = await supabase
      .from('campaign_reward_claims')
      .select(`
        *,
        reward:campaign_rewards(reward_name, tier_level, helpers_required)
      `)
      .eq('campaign_id', campaignId)
      .order('claimed_at', { ascending: false });

    // ============================================
    // Calculate KPIs
    // ============================================
    const totalParticipants = participants?.length || 0;
    const totalHelpers = helpers?.length || 0;
    const validHelpers = helpers?.filter((h: any) => h.is_valid).length || 0;
    const invalidHelpers = totalHelpers - validHelpers;
    const totalClaims = rewardClaims?.length || 0;
    
    // Viral coefficient (K-factor) = avg helpers per participant
    const viralCoefficient = totalParticipants > 0 
      ? parseFloat((validHelpers / totalParticipants).toFixed(2)) 
      : 0;
    
    // Retention rate = valid helpers / total helpers
    const retentionRate = totalHelpers > 0 
      ? parseFloat(((validHelpers / totalHelpers) * 100).toFixed(1)) 
      : 100;

    // ============================================
    // Calculate Funnel Data
    // ============================================
    // Estimate QR scans from event logs
    const { count: qrScansCount } = await supabase
      .from('event_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'campaign_qr_created')
      .eq('campaign_id', campaignId);

    const qrScans = qrScansCount || totalHelpers * 1.5; // Estimate if no data
    
    const funnel = {
      qrScans: Math.round(qrScans as number),
      follows: totalHelpers,
      validHelpers: validHelpers,
      rewardsClaimed: totalClaims,
      // Conversion rates
      scanToFollowRate: qrScans ? parseFloat(((totalHelpers / (qrScans as number)) * 100).toFixed(1)) : 0,
      followToValidRate: totalHelpers > 0 ? parseFloat(((validHelpers / totalHelpers) * 100).toFixed(1)) : 100,
      validToClaimRate: validHelpers > 0 ? parseFloat(((totalClaims / validHelpers) * 100).toFixed(1)) : 0,
    };

    // ============================================
    // Daily Trends (last 30 days or campaign duration)
    // ============================================
    const campaignStart = new Date(campaign.start_time);
    const campaignEnd = campaign.end_time ? new Date(campaign.end_time) : new Date();
    const now = new Date();
    const effectiveEnd = campaignEnd < now ? campaignEnd : now;
    
    // Group participants by day
    const participantsByDay: Record<string, number> = {};
    const helpersByDay: Record<string, number> = {};
    const claimsByDay: Record<string, number> = {};
    
    (participants || []).forEach((p: any) => {
      const day = new Date(p.joined_at).toISOString().split('T')[0];
      participantsByDay[day] = (participantsByDay[day] || 0) + 1;
    });
    
    (helpers || []).forEach((h: any) => {
      const day = new Date(h.created_at).toISOString().split('T')[0];
      helpersByDay[day] = (helpersByDay[day] || 0) + 1;
    });
    
    (rewardClaims || []).forEach((c: any) => {
      const day = new Date(c.claimed_at).toISOString().split('T')[0];
      claimsByDay[day] = (claimsByDay[day] || 0) + 1;
    });

    // Generate daily data array
    const dailyData: Array<{
      date: string;
      participants: number;
      helpers: number;
      claims: number;
      cumulativeParticipants: number;
      cumulativeHelpers: number;
    }> = [];
    
    let cumulativeParticipants = 0;
    let cumulativeHelpers = 0;
    
    // Get all unique dates and sort them
    const allDates = new Set([
      ...Object.keys(participantsByDay),
      ...Object.keys(helpersByDay),
      ...Object.keys(claimsByDay),
    ]);
    const sortedDates = Array.from(allDates).sort();
    
    sortedDates.forEach(date => {
      const dayParticipants = participantsByDay[date] || 0;
      const dayHelpers = helpersByDay[date] || 0;
      const dayClaims = claimsByDay[date] || 0;
      
      cumulativeParticipants += dayParticipants;
      cumulativeHelpers += dayHelpers;
      
      dailyData.push({
        date,
        participants: dayParticipants,
        helpers: dayHelpers,
        claims: dayClaims,
        cumulativeParticipants,
        cumulativeHelpers,
      });
    });

    // ============================================
    // Reward Distribution
    // ============================================
    const rewardDistribution = (rewards || []).map((reward: any) => {
      const eligibleCount = (participants || []).filter(
        (p: any) => (p.helper_count || 0) >= reward.helpers_required
      ).length;
      
      const claimedCount = (rewardClaims || []).filter(
        (c: any) => c.reward_id === reward.id
      ).length;
      
      return {
        id: reward.id,
        name: reward.reward_name,
        tierLevel: reward.tier_level,
        helpersRequired: reward.helpers_required,
        eligible: eligibleCount,
        claimed: claimedCount,
        claimRate: eligibleCount > 0 
          ? parseFloat(((claimedCount / eligibleCount) * 100).toFixed(1)) 
          : 0,
        stock: reward.stock,
        remaining: reward.stock === -1 ? 'Unlimited' : Math.max(0, reward.stock - claimedCount),
      };
    });

    // ============================================
    // Top Performers (Leaderboard)
    // ============================================
    const topPerformers = (participants || []).slice(0, 20).map((p: any, index: number) => {
      // Calculate secondary referrals (helpers who became participants)
      const helperOpenids = (helpers || [])
        .filter((h: any) => h.participant_id === p.id)
        .map((h: any) => h.helper_openid);
      
      const secondaryReferrals = (participants || []).filter((sp: any) => {
        // Check if this participant's user was a helper for p
        return sp.user?.openid && helperOpenids.includes(sp.user.openid);
      }).length;

      // Calculate influence score
      const helperCount = p.helper_count || 0;
      const influenceScore = helperCount + (secondaryReferrals * 2);
      
      return {
        rank: index + 1,
        userId: p.user?.id,
        name: p.user?.wechat_nickname || p.user?.name || 'Unknown',
        avatar: p.user?.wechat_avatar_url,
        referralCode: p.referral_code,
        helperCount,
        secondaryReferrals,
        influenceScore,
        joinedAt: p.joined_at,
      };
    });

    // ============================================
    // Hourly Activity Heatmap
    // ============================================
    const hourlyActivity: Record<number, number> = {};
    const dailyActivity: Record<number, number> = {}; // 0 = Sunday, 6 = Saturday
    
    (helpers || []).forEach((h: any) => {
      const date = new Date(h.created_at);
      const hour = date.getHours();
      const day = date.getDay();
      
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    });

    // Find peak times
    const peakHour = Object.entries(hourlyActivity)
      .sort(([, a], [, b]) => b - a)[0];
    const peakDay = Object.entries(dailyActivity)
      .sort(([, a], [, b]) => b - a)[0];
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // ============================================
    // Campaign Health Score (0-100)
    // ============================================
    let healthScore = 0;
    const healthFactors: Array<{ factor: string; score: number; max: number; status: string }> = [];

    // Factor 1: Has participants (20 points)
    const participantScore = Math.min(20, totalParticipants * 2);
    healthFactors.push({ 
      factor: 'Participants', 
      score: participantScore, 
      max: 20,
      status: totalParticipants >= 10 ? 'good' : totalParticipants >= 5 ? 'warning' : 'poor'
    });
    healthScore += participantScore;

    // Factor 2: Viral coefficient (25 points)
    const viralScore = Math.min(25, viralCoefficient * 10);
    healthFactors.push({ 
      factor: 'Viral Coefficient', 
      score: Math.round(viralScore), 
      max: 25,
      status: viralCoefficient >= 2 ? 'good' : viralCoefficient >= 1 ? 'warning' : 'poor'
    });
    healthScore += viralScore;

    // Factor 3: Retention rate (25 points)
    const retentionScore = retentionRate * 0.25;
    healthFactors.push({ 
      factor: 'Retention Rate', 
      score: Math.round(retentionScore), 
      max: 25,
      status: retentionRate >= 80 ? 'good' : retentionRate >= 60 ? 'warning' : 'poor'
    });
    healthScore += retentionScore;

    // Factor 4: Reward claim rate (15 points)
    const avgClaimRate = rewardDistribution.length > 0
      ? rewardDistribution.reduce((sum: number, r: any) => sum + r.claimRate, 0) / rewardDistribution.length
      : 0;
    const claimScore = avgClaimRate * 0.15;
    healthFactors.push({ 
      factor: 'Claim Rate', 
      score: Math.round(claimScore), 
      max: 15,
      status: avgClaimRate >= 50 ? 'good' : avgClaimRate >= 25 ? 'warning' : 'poor'
    });
    healthScore += claimScore;

    // Factor 5: Recent activity (15 points)
    const lastWeekHelpers = (helpers || []).filter((h: any) => {
      const helperDate = new Date(h.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return helperDate >= weekAgo;
    }).length;
    const activityScore = Math.min(15, lastWeekHelpers);
    healthFactors.push({ 
      factor: 'Recent Activity', 
      score: activityScore, 
      max: 15,
      status: lastWeekHelpers >= 10 ? 'good' : lastWeekHelpers >= 3 ? 'warning' : 'poor'
    });
    healthScore += activityScore;

    // ============================================
    // Executive Summary
    // ============================================
    const daysActive = Math.ceil((effectiveEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24));
    const avgParticipantsPerDay = daysActive > 0 ? parseFloat((totalParticipants / daysActive).toFixed(1)) : 0;
    const avgHelpersPerDay = daysActive > 0 ? parseFloat((totalHelpers / daysActive).toFixed(1)) : 0;

    const executiveSummary = {
      campaignName: campaign.name,
      status: campaign.status,
      startDate: campaign.start_time,
      endDate: campaign.end_time,
      daysActive,
      daysRemaining: campaign.end_time 
        ? Math.max(0, Math.ceil((new Date(campaign.end_time).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null,
      totalReach: totalParticipants + validHelpers,
      healthScore: Math.round(healthScore),
      healthGrade: healthScore >= 80 ? 'A' : healthScore >= 60 ? 'B' : healthScore >= 40 ? 'C' : 'D',
    };

    // ============================================
    // Geographic Breakdown (from event_logs)
    // ============================================
    const { data: geoData } = await supabase
      .from('event_logs')
      .select('location_city, location_province')
      .eq('campaign_id', campaignId)
      .not('location_city', 'is', null);

    const geoCount: Record<string, number> = {};
    (geoData || []).forEach((e: any) => {
      const location = e.location_city || e.location_province || 'Unknown';
      geoCount[location] = (geoCount[location] || 0) + 1;
    });

    const totalGeoCount = Object.values(geoCount).reduce((a, b) => a + b, 0);
    const geoBreakdown = Object.entries(geoCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalGeoCount > 0 ? parseFloat(((count / totalGeoCount) * 100).toFixed(1)) : 0,
      }));

    // ============================================
    // Device Breakdown (from event_logs)
    // ============================================
    const { data: deviceData } = await supabase
      .from('event_logs')
      .select('device_type, os_name, device_brand')
      .eq('campaign_id', campaignId)
      .not('device_type', 'is', null);

    const deviceCount: Record<string, number> = {};
    const osCount: Record<string, number> = {};
    const brandCount: Record<string, number> = {};

    (deviceData || []).forEach((e: any) => {
      const device = e.device_type || 'Unknown';
      const os = e.os_name || 'Unknown';
      const brand = e.device_brand || 'Unknown';
      
      deviceCount[device] = (deviceCount[device] || 0) + 1;
      osCount[os] = (osCount[os] || 0) + 1;
      brandCount[brand] = (brandCount[brand] || 0) + 1;
    });

    const totalDeviceCount = Object.values(osCount).reduce((a, b) => a + b, 0);
    const deviceBreakdown = Object.entries(osCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalDeviceCount > 0 ? parseFloat(((count / totalDeviceCount) * 100).toFixed(1)) : 0,
      }));

    // ============================================
    // Assemble Response
    // ============================================
    res.json({
      success: true,
      data: {
        executiveSummary,
        kpis: {
          totalParticipants,
          totalHelpers,
          validHelpers,
          invalidHelpers,
          totalClaims,
          viralCoefficient,
          retentionRate,
          avgParticipantsPerDay,
          avgHelpersPerDay,
          avgHelpersPerParticipant: totalParticipants > 0 
            ? parseFloat((validHelpers / totalParticipants).toFixed(1)) 
            : 0,
        },
        funnel,
        dailyData,
        rewardDistribution,
        topPerformers,
        activityHeatmap: {
          hourly: hourlyActivity,
          daily: dailyActivity,
          peakHour: peakHour ? { hour: parseInt(peakHour[0]), count: peakHour[1] } : null,
          peakDay: peakDay ? { day: dayNames[parseInt(peakDay[0])], count: peakDay[1] } : null,
        },
        healthScore: {
          total: Math.round(healthScore),
          grade: executiveSummary.healthGrade,
          factors: healthFactors,
        },
        geoBreakdown,
        deviceBreakdown,
        // Raw data for CSV export
        exportData: {
          participants: (participants || []).map((p: any) => ({
            name: p.user?.wechat_nickname || p.user?.name,
            referralCode: p.referral_code,
            helperCount: p.helper_count,
            joinedAt: p.joined_at,
          })),
          helpers: (helpers || []).map((h: any) => ({
            participantCode: h.participant?.referral_code,
            isValid: h.is_valid,
            createdAt: h.created_at,
          })),
        },
      },
    });
  } catch (error: any) {
    console.error('Get campaign report error:', error);
    res.status(500).json({ error: error.message || 'Failed to get report' });
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
 * Supports 4-step wizard setup fields
 */
router.post('/admin/create', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      // Step 1: Basic Info
      name,
      description,
      cover_image_url,
      entry_type = 'simple',
      start_time,
      end_time,
      rules = {},
      anti_cheat_settings = {},
      rewards = [],
      page_style = 'red',
      brand_enabled = false,
      brand_name,
      brand_logo_url,
      activity_info_enabled = false,
      activity_info,
      // Step 2: Poster Settings
      poster_background_url,
      poster_avatar_enabled = true,
      poster_avatar_shape = 'circle',
      poster_nickname_enabled = true,
      poster_nickname_font_size = 24,
      poster_nickname_color = '#333333',
      poster_recommend_enabled = false,
      poster_recommend_text,
      // Step 3: Message Templates
      messages_enabled = true,
      message_to_sharer,
      message_to_helper,
      msg_rule,
      msg_helper_success,
      msg_duplicate_help,
      msg_campaign_ended,
      msg_campaign_ended_image_url,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    // Default message templates
    const defaultSharerMessage = `🎉 好消息！

有人刚刚为你助力了！

📊 当前进度：{{helper_count}}/{{max_helpers}} 人
🎁 还差 {{remaining}} 人即可领取奖励

继续分享给更多好友吧！`;

    const defaultHelperMessage = `✅ 助力成功！

你已成功帮助好友完成助力任务。

感谢你的支持！🙏`;

    const defaultRuleMessage = `@{{user_nickname}}，您好呀，快来参与本次福利活动~

点击下方链接，生成个人专属海报
分享海报，邀请好友扫码助力，即可领取奖品！

奖品数量有限，快去参加吧👇`;

    const defaultHelperSuccessMessage = `@{{user_nickname}}，很高兴认识您，您已为好友助力成功！
同时，诚邀您一起参与本次福利活动~

点击下方链接，生成个人专属海报
分享海报，邀请好友扫码助力，即可领取奖品！`;

    const defaultDuplicateHelpMessage = `@{{user_nickname}}，您已经为好友助力过，不能重复助力哟~
诚邀您一起参与本次福利活动~`;

    const defaultCampaignEndedMessage = `活动已结束，感谢您的参与！敬请期待下次活动~`;

    // Create campaign
    const { data: campaignData, error } = await supabase
      .from('campaigns')
      .insert({
        name,
        description,
        cover_image_url,
        entry_type,
        status: 'active',
        start_time: start_time || new Date().toISOString(),
        end_time: end_time || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        rules,
        anti_cheat_settings,
        // Step 1 fields
        page_style,
        brand_enabled,
        brand_name,
        brand_logo_url,
        activity_info_enabled,
        activity_info,
        // Step 2 fields
        poster_background_url,
        poster_avatar_enabled,
        poster_avatar_shape,
        poster_nickname_enabled,
        poster_nickname_font_size,
        poster_nickname_color,
        poster_recommend_enabled,
        poster_recommend_text,
        // Step 3 fields
        messages_enabled,
        message_to_sharer: message_to_sharer || defaultSharerMessage,
        message_to_helper: message_to_helper || defaultHelperMessage,
        msg_rule: msg_rule || defaultRuleMessage,
        msg_helper_success: msg_helper_success || defaultHelperSuccessMessage,
        msg_duplicate_help: msg_duplicate_help || defaultDuplicateHelpMessage,
        msg_campaign_ended: msg_campaign_ended || defaultCampaignEndedMessage,
        msg_campaign_ended_image_url,
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
        // New fields for Step 4
        reward_image_url: reward.reward_image_url,
        total_quantity: reward.total_quantity ?? 100,
        remaining_quantity: reward.remaining_quantity ?? reward.total_quantity ?? 100,
        claim_method: reward.claim_method || 'link',
        claim_link: reward.claim_link,
        claim_text: reward.claim_text,
        claim_button_text: reward.claim_button_text || '领取奖品',
        activation_source: reward.activation_source || 'manual',
        send_to_email: reward.send_to_email || false,
      }));

      const { error: rewardsError } = await supabase
        .from('campaign_rewards')
        .insert(rewardsToInsert as Record<string, any>[]);

      if (rewardsError) {
        console.error('Create rewards error:', rewardsError);
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
 * PUT /api/campaigns/admin/:id
 * Update campaign details (admin only)
 * Supports 4-step wizard setup fields
 */
router.put('/admin/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const {
      // Step 1: Basic Info
      name,
      description,
      cover_image_url,
      start_time,
      end_time,
      rewards = [],
      page_style,
      brand_enabled,
      brand_name,
      brand_logo_url,
      activity_info_enabled,
      activity_info,
      // Step 2: Poster Settings
      poster_background_url,
      poster_avatar_enabled,
      poster_avatar_shape,
      poster_nickname_enabled,
      poster_nickname_font_size,
      poster_nickname_color,
      poster_recommend_enabled,
      poster_recommend_text,
      // Step 3: Message Templates
      messages_enabled,
      message_to_sharer,
      message_to_helper,
      msg_rule,
      msg_helper_success,
      msg_duplicate_help,
      msg_campaign_ended,
      msg_campaign_ended_image_url,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    // Build update object (only include defined fields)
    const updateData: Record<string, any> = {
      name,
      description,
      cover_image_url,
      start_time,
      end_time,
      updated_at: new Date().toISOString(),
    };

    // Step 1 fields
    if (page_style !== undefined) updateData.page_style = page_style;
    if (brand_enabled !== undefined) updateData.brand_enabled = brand_enabled;
    if (brand_name !== undefined) updateData.brand_name = brand_name;
    if (brand_logo_url !== undefined) updateData.brand_logo_url = brand_logo_url;
    if (activity_info_enabled !== undefined) updateData.activity_info_enabled = activity_info_enabled;
    if (activity_info !== undefined) updateData.activity_info = activity_info;

    // Step 2 fields
    if (poster_background_url !== undefined) updateData.poster_background_url = poster_background_url;
    if (poster_avatar_enabled !== undefined) updateData.poster_avatar_enabled = poster_avatar_enabled;
    if (poster_avatar_shape !== undefined) updateData.poster_avatar_shape = poster_avatar_shape;
    if (poster_nickname_enabled !== undefined) updateData.poster_nickname_enabled = poster_nickname_enabled;
    if (poster_nickname_font_size !== undefined) updateData.poster_nickname_font_size = poster_nickname_font_size;
    if (poster_nickname_color !== undefined) updateData.poster_nickname_color = poster_nickname_color;
    if (poster_recommend_enabled !== undefined) updateData.poster_recommend_enabled = poster_recommend_enabled;
    if (poster_recommend_text !== undefined) updateData.poster_recommend_text = poster_recommend_text;

    // Step 3 fields
    if (messages_enabled !== undefined) updateData.messages_enabled = messages_enabled;
    if (message_to_sharer !== undefined) updateData.message_to_sharer = message_to_sharer;
    if (message_to_helper !== undefined) updateData.message_to_helper = message_to_helper;
    if (msg_rule !== undefined) updateData.msg_rule = msg_rule;
    if (msg_helper_success !== undefined) updateData.msg_helper_success = msg_helper_success;
    if (msg_duplicate_help !== undefined) updateData.msg_duplicate_help = msg_duplicate_help;
    if (msg_campaign_ended !== undefined) updateData.msg_campaign_ended = msg_campaign_ended;
    if (msg_campaign_ended_image_url !== undefined) updateData.msg_campaign_ended_image_url = msg_campaign_ended_image_url;

    // Update campaign
    const { data: campaignData, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;

    // Update rewards if provided
    if (rewards.length > 0) {
      // Delete existing rewards (and their activation codes will cascade)
      await supabase
        .from('campaign_rewards')
        .delete()
        .eq('campaign_id', campaignId);

      // Insert new rewards
      const rewardsToInsert = rewards.map((reward: any, index: number) => ({
        campaign_id: campaignId,
        tier_level: reward.tier_level ?? index,
        helpers_required: reward.helpers_required ?? 0,
        reward_name: reward.reward_name || `奖品${index + 1}`,
        reward_description: reward.reward_description || '',
        reward_type: reward.reward_type || 'digital',
        reward_content: reward.reward_content || {},
        stock: reward.stock ?? -1,
        // New fields for Step 4
        reward_image_url: reward.reward_image_url,
        total_quantity: reward.total_quantity ?? 100,
        remaining_quantity: reward.remaining_quantity ?? reward.total_quantity ?? 100,
        claim_method: reward.claim_method || 'link',
        claim_link: reward.claim_link,
        claim_text: reward.claim_text,
        claim_button_text: reward.claim_button_text || '领取奖品',
        activation_source: reward.activation_source || 'manual',
        send_to_email: reward.send_to_email || false,
      }));

      const { error: rewardsError } = await supabase
        .from('campaign_rewards')
        .insert(rewardsToInsert as Record<string, any>[]);

      if (rewardsError) {
        console.error('Update rewards error:', rewardsError);
      }
    }

    // Log event
    await logEvent({
      event_type: 'campaign_updated',
      user_id: req.userId!,
      event_data: {
        campaign_id: campaignId,
        campaign_name: name,
      },
    });

    res.json({
      success: true,
      data: { campaign: campaignData },
    });
  } catch (error: any) {
    console.error('Update campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to update campaign' });
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

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign and all related data (admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;

    // First verify the campaign exists
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Delete in order of dependencies:
    // 1. Delete reward claims
    const { data: claimsDeleted } = await supabase
      .from('campaign_reward_claims')
      .delete()
      .eq('campaign_id', campaignId)
      .select('id');

    // 2. Delete helpers
    const { data: helpersDeleted } = await supabase
      .from('campaign_helpers')
      .delete()
      .eq('campaign_id', campaignId)
      .select('id');

    // 3. Delete participants
    const { data: participantsDeleted } = await supabase
      .from('campaign_participants')
      .delete()
      .eq('campaign_id', campaignId)
      .select('id');

    // 4. Delete rewards
    const { data: rewardsDeleted } = await supabase
      .from('campaign_rewards')
      .delete()
      .eq('campaign_id', campaignId)
      .select('id');

    // 5. Delete the campaign itself
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (deleteError) throw deleteError;

    // Log event
    await logEvent({
      event_type: 'campaign_deleted',
      user_id: req.userId!,
      event_data: {
        campaign_id: campaignId,
        campaign_name: campaign.name,
        claims_deleted: claimsDeleted?.length || 0,
        helpers_deleted: helpersDeleted?.length || 0,
        participants_deleted: participantsDeleted?.length || 0,
        rewards_deleted: rewardsDeleted?.length || 0,
      },
    });

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
      data: {
        campaign_id: campaignId,
        campaign_name: campaign.name,
        claims_deleted: claimsDeleted?.length || 0,
        helpers_deleted: helpersDeleted?.length || 0,
        participants_deleted: participantsDeleted?.length || 0,
        rewards_deleted: rewardsDeleted?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete campaign' });
  }
});

/**
 * POST /api/campaigns/:id/copy
 * Copy a campaign with all its settings and rewards (admin only)
 */
router.post('/:id/copy', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const { name: newName } = req.body;

    // Get the original campaign
    const { data: originalCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (fetchError || !originalCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get original rewards
    const { data: originalRewards } = await supabase
      .from('campaign_rewards')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('tier_level', { ascending: true });

    // Create new campaign (copy all fields except id, created_at, updated_at)
    const { id, created_at, updated_at, ...campaignFields } = originalCampaign;
    
    const { data: newCampaign, error: createError } = await supabase
      .from('campaigns')
      .insert({
        ...campaignFields,
        name: newName || `${originalCampaign.name} (副本)`,
        status: 'draft', // New campaign starts as draft
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      } as Record<string, any>)
      .select()
      .single();

    if (createError) throw createError;

    // Copy rewards if any
    if (originalRewards && originalRewards.length > 0) {
      const rewardsToInsert = originalRewards.map((reward: any) => {
        const { id, campaign_id, created_at, claimed_count, ...rewardFields } = reward;
        return {
          ...rewardFields,
          campaign_id: (newCampaign as any).id,
          claimed_count: 0,
          remaining_quantity: rewardFields.total_quantity || 100,
        };
      });

      const { error: rewardsError } = await supabase
        .from('campaign_rewards')
        .insert(rewardsToInsert as Record<string, any>[]);

      if (rewardsError) {
        console.error('Copy rewards error:', rewardsError);
      }
    }

    // Log event
    await logEvent({
      event_type: 'campaign_copied',
      user_id: req.userId!,
      event_data: {
        original_campaign_id: campaignId,
        new_campaign_id: (newCampaign as any).id,
        original_name: originalCampaign.name,
        new_name: (newCampaign as any).name,
      },
    });

    res.json({
      success: true,
      message: 'Campaign copied successfully',
      data: { campaign: newCampaign },
    });
  } catch (error: any) {
    console.error('Copy campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to copy campaign' });
  }
});

/**
 * POST /api/campaigns/admin/:id/rewards/:rewardId/activation-codes
 * Import activation codes for a reward (admin only)
 */
router.post('/admin/:id/rewards/:rewardId/activation-codes', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id: campaignId, rewardId } = req.params;
    const { codes } = req.body; // Array of code strings

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of activation codes' });
    }

    // Verify reward exists and belongs to campaign
    const { data: reward, error: rewardError } = await supabase
      .from('campaign_rewards')
      .select('id, campaign_id, reward_name')
      .eq('id', rewardId)
      .eq('campaign_id', campaignId)
      .single();

    if (rewardError || !reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Clean and deduplicate codes
    const cleanedCodes = [...new Set(codes.map((c: string) => c.trim()).filter((c: string) => c.length > 0))];

    // Check for existing codes
    const { data: existingCodes } = await supabase
      .from('activation_codes')
      .select('code')
      .eq('reward_id', rewardId)
      .in('code', cleanedCodes);

    const existingCodeSet = new Set((existingCodes || []).map((c: any) => c.code));
    const newCodes = cleanedCodes.filter(code => !existingCodeSet.has(code));

    if (newCodes.length === 0) {
      return res.json({
        success: true,
        message: 'All codes already exist',
        data: {
          imported: 0,
          duplicates: cleanedCodes.length,
          total: 0,
        },
      });
    }

    // Insert new codes
    const codesToInsert = newCodes.map(code => ({
      campaign_id: campaignId,
      reward_id: rewardId,
      code,
      is_used: false,
    }));

    const { error: insertError } = await supabase
      .from('activation_codes')
      .insert(codesToInsert);

    if (insertError) throw insertError;

    // Update reward remaining quantity
    const { count: totalUnused } = await supabase
      .from('activation_codes')
      .select('*', { count: 'exact', head: true })
      .eq('reward_id', rewardId)
      .eq('is_used', false);

    await supabase
      .from('campaign_rewards')
      .update({ remaining_quantity: totalUnused || 0 })
      .eq('id', rewardId);

    // Log event
    await logEvent({
      event_type: 'activation_codes_imported',
      user_id: req.userId!,
      event_data: {
        campaign_id: campaignId,
        reward_id: rewardId,
        imported_count: newCodes.length,
        duplicate_count: cleanedCodes.length - newCodes.length,
      },
    });

    res.json({
      success: true,
      message: `Successfully imported ${newCodes.length} activation codes`,
      data: {
        imported: newCodes.length,
        duplicates: cleanedCodes.length - newCodes.length,
        total: totalUnused || 0,
      },
    });
  } catch (error: any) {
    console.error('Import activation codes error:', error);
    res.status(500).json({ error: error.message || 'Failed to import activation codes' });
  }
});

/**
 * GET /api/campaigns/admin/:id/rewards/:rewardId/activation-codes
 * Get activation codes for a reward (admin only)
 */
router.get('/admin/:id/rewards/:rewardId/activation-codes', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id: campaignId, rewardId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const showUsed = req.query.show_used === 'true';

    // Get codes
    let query = supabase
      .from('activation_codes')
      .select(`
        *,
        used_by_user:users!activation_codes_used_by_fkey(id, name, wechat_nickname)
      `, { count: 'exact' })
      .eq('reward_id', rewardId)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (!showUsed) {
      query = query.eq('is_used', false);
    }

    const { data: codes, count, error } = await query;

    if (error) throw error;

    // Get stats
    const { count: totalCount } = await supabase
      .from('activation_codes')
      .select('*', { count: 'exact', head: true })
      .eq('reward_id', rewardId);

    const { count: usedCount } = await supabase
      .from('activation_codes')
      .select('*', { count: 'exact', head: true })
      .eq('reward_id', rewardId)
      .eq('is_used', true);

    res.json({
      success: true,
      data: {
        codes: codes || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
        stats: {
          total: totalCount || 0,
          used: usedCount || 0,
          available: (totalCount || 0) - (usedCount || 0),
        },
      },
    });
  } catch (error: any) {
    console.error('Get activation codes error:', error);
    res.status(500).json({ error: error.message || 'Failed to get activation codes' });
  }
});

/**
 * DELETE /api/campaigns/admin/:id/rewards/:rewardId/activation-codes
 * Delete all unused activation codes for a reward (admin only)
 */
router.delete('/admin/:id/rewards/:rewardId/activation-codes', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id: campaignId, rewardId } = req.params;

    const { data: deleted, error } = await supabase
      .from('activation_codes')
      .delete()
      .eq('reward_id', rewardId)
      .eq('campaign_id', campaignId)
      .eq('is_used', false)
      .select('id');

    if (error) throw error;

    // Update reward remaining quantity to 0
    await supabase
      .from('campaign_rewards')
      .update({ remaining_quantity: 0 })
      .eq('id', rewardId);

    res.json({
      success: true,
      message: `Deleted ${deleted?.length || 0} unused activation codes`,
      data: { deleted_count: deleted?.length || 0 },
    });
  } catch (error: any) {
    console.error('Delete activation codes error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete activation codes' });
  }
});

/**
 * GET /api/campaigns/admin/:id/full
 * Get full campaign data including all wizard settings (admin only)
 */
router.get('/admin/:id/full', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;

    // Get campaign with all fields
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get rewards with all fields
    const { data: rewards } = await supabase
      .from('campaign_rewards')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('tier_level', { ascending: true });

    // Get activation code stats for each reward
    const rewardsWithStats = await Promise.all(
      (rewards || []).map(async (reward: any) => {
        const { count: totalCodes } = await supabase
          .from('activation_codes')
          .select('*', { count: 'exact', head: true })
          .eq('reward_id', reward.id);

        const { count: usedCodes } = await supabase
          .from('activation_codes')
          .select('*', { count: 'exact', head: true })
          .eq('reward_id', reward.id)
          .eq('is_used', true);

        return {
          ...reward,
          activation_codes_stats: {
            total: totalCodes || 0,
            used: usedCodes || 0,
            available: (totalCodes || 0) - (usedCodes || 0),
          },
        };
      })
    );

    res.json({
      success: true,
      data: {
        campaign,
        rewards: rewardsWithStats,
      },
    });
  } catch (error: any) {
    console.error('Get full campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to get campaign' });
  }
});

// ============================================
// Poster Generation Routes
// ============================================

/**
 * GET /api/campaigns/:id/poster
 * Generate and return poster for current user
 * Returns: PNG image
 */
router.get('/:id/poster', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;
    const forceRegenerate = req.query.force === 'true';

    console.log(`Generating poster for user ${userId}, campaign ${campaignId}`);

    const { buffer, fromCache } = await generateCampaignPoster(userId, campaignId, forceRegenerate);

    // Log event
    await logEvent({
      event_type: 'poster_generated',
      user_id: userId,
      event_data: {
        campaign_id: campaignId,
        from_cache: fromCache,
      },
    });

    // Set cache headers
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': buffer.length,
      'Cache-Control': fromCache ? 'public, max-age=3600' : 'no-cache',
      'X-From-Cache': fromCache ? 'true' : 'false',
    });

    res.send(buffer);
  } catch (error: any) {
    console.error('Generate poster error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate poster' });
  }
});

/**
 * GET /api/campaigns/:id/poster/base64
 * Generate poster and return as base64 string
 * Useful for mini program to display directly
 */
router.get('/:id/poster/base64', authenticate, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId!;
    const forceRegenerate = req.query.force === 'true';

    console.log(`Generating base64 poster for user ${userId}, campaign ${campaignId}`);

    const { base64, fromCache } = await generateCampaignPosterBase64(userId, campaignId, forceRegenerate);

    // Log event
    await logEvent({
      event_type: 'poster_generated',
      user_id: userId,
      event_data: {
        campaign_id: campaignId,
        from_cache: fromCache,
        format: 'base64',
      },
    });

    res.json({
      success: true,
      data: {
        poster: `data:image/png;base64,${base64}`,
        fromCache,
      },
    });
  } catch (error: any) {
    console.error('Generate base64 poster error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate poster' });
  }
});

/**
 * POST /api/campaigns/admin/:id/poster/clear-cache
 * Clear all cached posters for a campaign (admin only)
 * Call this after updating campaign poster settings
 */
router.post('/admin/:id/poster/clear-cache', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;

    const deletedCount = clearCampaignPosterCache(campaignId);

    res.json({
      success: true,
      message: `Cleared ${deletedCount} cached posters`,
      data: { deleted_count: deletedCount },
    });
  } catch (error: any) {
    console.error('Clear poster cache error:', error);
    res.status(500).json({ error: error.message || 'Failed to clear poster cache' });
  }
});

export default router;
