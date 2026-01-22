/**
 * Campaign Fission Service
 * 
 * Handles campaign-related operations including:
 * - QR code generation with campaign scene parameters
 * - Participant management
 * - Helper tracking
 * - Progress calculation
 */

import axios from 'axios';
import { supabase } from '../config/supabase';
import { OA_API } from '../config/wechat';
import { getOAAccessToken } from './oa-qrcode';
import { logEvent } from './event-logger';

// Type helper for Supabase queries
type AnyRecord = Record<string, any>;

// ============================================
// Types
// ============================================

export interface Campaign {
  id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  entry_type: string;
  status: string;
  start_time: string;
  end_time: string;
  rules: Record<string, any>;
  anti_cheat_settings: Record<string, any>;
}

export interface CampaignReward {
  id: string;
  campaign_id: string;
  tier_level: number;
  helpers_required: number;
  reward_name: string;
  reward_description: string;
  reward_type: string;
  reward_content: Record<string, any>;
  stock: number;
  claimed_count: number;
}

export interface CampaignParticipant {
  id: string;
  campaign_id: string;
  user_id: string;
  referral_code: string;
  helper_count: number;
  total_helper_count: number;
  highest_tier_claimed: number;
  joined_at: string;
}

export interface CampaignHelper {
  id: string;
  campaign_id: string;
  participant_id: string;
  helper_openid: string;
  helper_unionid: string | null;
  helper_user_id: string | null;
  is_valid: boolean;
  invalidated_at: string | null;
  invalidate_reason: string | null;
  created_at: string;
}

export interface ParsedCampaignScene {
  campaignId: string;
  referralCode: string;
  raw: string;
}

// ============================================
// Scene Parsing
// ============================================

/**
 * Parse campaign scene string
 * Format: "camp_{campaignId}_ref_{referralCode}" or "qrscene_camp_{campaignId}_ref_{referralCode}"
 */
export function parseCampaignScene(sceneStr: string): ParsedCampaignScene | null {
  // Remove "qrscene_" prefix if present (added by WeChat for subscribe events)
  const cleanScene = sceneStr.replace(/^qrscene_/, '');
  
  // Match pattern: camp_{uuid}_ref_{code}
  // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const match = cleanScene.match(/^camp_([a-f0-9-]{36})_ref_([A-Z0-9]+)$/i);
  
  if (match) {
    return {
      campaignId: match[1],
      referralCode: match[2],
      raw: sceneStr,
    };
  }
  
  return null;
}

/**
 * Check if a scene string is a campaign scene
 */
export function isCampaignScene(sceneStr: string): boolean {
  return parseCampaignScene(sceneStr) !== null;
}

// ============================================
// Campaign Operations
// ============================================

/**
 * Get active campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    console.error('Get campaign error:', error);
    return null;
  }

  return data;
}

/**
 * Get all active campaigns
 */
export async function getActiveCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .lte('start_time', new Date().toISOString())
    .gte('end_time', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Get active campaigns error:', error);
    return [];
  }

  return data || [];
}

/**
 * Get campaign rewards
 */
export async function getCampaignRewards(campaignId: string): Promise<CampaignReward[]> {
  const { data, error } = await supabase
    .from('campaign_rewards')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('tier_level', { ascending: true });

  if (error) {
    console.error('Get campaign rewards error:', error);
    return [];
  }

  return data || [];
}

// ============================================
// Participant Operations
// ============================================

/**
 * Generate a unique referral code for campaign participant
 */
function generateCampaignReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get or create campaign participant
 */
export async function getOrCreateParticipant(
  campaignId: string,
  userId: string
): Promise<CampaignParticipant> {
  // Check if already a participant
  const { data: existing } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    return existing as unknown as CampaignParticipant;
  }

  // Generate unique referral code
  let referralCode = generateCampaignReferralCode();
  let attempts = 0;
  
  while (attempts < 5) {
    const { data: newParticipant, error } = await supabase
      .from('campaign_participants')
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        referral_code: referralCode,
      } as AnyRecord)
      .select()
      .single();

    if (newParticipant && !error) {
      // Log event
      await logEvent({
        event_type: 'campaign_join',
        user_id: userId,
        event_data: {
          campaign_id: campaignId,
          referral_code: referralCode,
        },
      });
      
      return newParticipant as unknown as CampaignParticipant;
    }

    // If duplicate code, try again
    if (error?.code === '23505') {
      referralCode = generateCampaignReferralCode();
      attempts++;
      continue;
    }

    throw new Error(`Failed to create participant: ${error?.message}`);
  }

  throw new Error('Failed to generate unique referral code');
}

/**
 * Find participant by referral code
 */
export async function findParticipantByCode(
  campaignId: string,
  referralCode: string
): Promise<CampaignParticipant | null> {
  const { data, error } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('referral_code', referralCode)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get participant by user ID
 */
export async function getParticipantByUserId(
  campaignId: string,
  userId: string
): Promise<CampaignParticipant | null> {
  const { data, error } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// ============================================
// Helper Operations
// ============================================

/**
 * Record a help action
 * Returns: { success: boolean, isNew: boolean, message: string }
 */
export async function recordHelper(
  campaignId: string,
  participantId: string,
  helperOpenid: string,
  helperUnionid?: string,
  helperUserId?: string
): Promise<{ success: boolean; isNew: boolean; message: string; helperCount?: number }> {
  // Check if already helped
  const { data: existingHelperData } = await supabase
    .from('campaign_helpers')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('participant_id', participantId)
    .eq('helper_openid', helperOpenid)
    .single();

  const existingHelper = existingHelperData as unknown as CampaignHelper | null;

  if (existingHelper) {
    // If previously invalidated (unfollowed), revalidate
    if (!existingHelper.is_valid) {
      await supabase
        .from('campaign_helpers')
        .update({
          is_valid: true,
          invalidated_at: null,
          invalidate_reason: null,
        } as AnyRecord)
        .eq('id', existingHelper.id);

      // Update helper count
      const newCount = await updateHelperCount(participantId);
      
      return {
        success: true,
        isNew: false,
        message: '助力已恢复',
        helperCount: newCount,
      };
    }
    
    return {
      success: false,
      isNew: false,
      message: '已经助力过了',
    };
  }

  // Create new helper record
  const { error } = await supabase.from('campaign_helpers').insert({
    campaign_id: campaignId,
    participant_id: participantId,
    helper_openid: helperOpenid,
    helper_unionid: helperUnionid || null,
    helper_user_id: helperUserId || null,
    is_valid: true,
  } as AnyRecord);

  if (error) {
    console.error('Record helper error:', error);
    return {
      success: false,
      isNew: false,
      message: `助力失败: ${error.message}`,
    };
  }

  // Update helper counts
  const newCount = await updateHelperCount(participantId);
  await incrementTotalHelperCount(participantId);

  return {
    success: true,
    isNew: true,
    message: '助力成功',
    helperCount: newCount,
  };
}

/**
 * Invalidate helper (when user unfollows)
 */
export async function invalidateHelper(
  helperOpenid: string,
  reason: 'unfollow' | 'cheat' | 'manual' = 'unfollow'
): Promise<number> {
  // Find all valid helpers by this openid
  const { data: helpersData, error } = await supabase
    .from('campaign_helpers')
    .select('id, participant_id')
    .eq('helper_openid', helperOpenid)
    .eq('is_valid', true);

  const helpers = helpersData as unknown as { id: string; participant_id: string }[] | null;

  if (error || !helpers || helpers.length === 0) {
    return 0;
  }

  // Invalidate all
  await supabase
    .from('campaign_helpers')
    .update({
      is_valid: false,
      invalidated_at: new Date().toISOString(),
      invalidate_reason: reason,
    } as AnyRecord)
    .eq('helper_openid', helperOpenid)
    .eq('is_valid', true);

  // Update helper counts for affected participants
  for (const helper of helpers) {
    await updateHelperCount(helper.participant_id);
  }

  return helpers.length;
}

/**
 * Update helper count (count valid helpers)
 */
async function updateHelperCount(participantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('campaign_helpers')
    .select('*', { count: 'exact', head: true })
    .eq('participant_id', participantId)
    .eq('is_valid', true);

  if (error) {
    console.error('Count helpers error:', error);
    return 0;
  }

  const helperCount = count || 0;

  await supabase
    .from('campaign_participants')
    .update({
      helper_count: helperCount,
      updated_at: new Date().toISOString(),
    } as AnyRecord)
    .eq('id', participantId);

  return helperCount;
}

/**
 * Increment total helper count
 */
async function incrementTotalHelperCount(participantId: string): Promise<void> {
  const { data: participantData } = await supabase
    .from('campaign_participants')
    .select('total_helper_count')
    .eq('id', participantId)
    .single();

  const participant = participantData as unknown as { total_helper_count: number } | null;

  if (participant) {
    await supabase
      .from('campaign_participants')
      .update({
        total_helper_count: (participant.total_helper_count || 0) + 1,
      } as AnyRecord)
      .eq('id', participantId);
  }
}

/**
 * Get helpers for a participant
 */
export async function getHelpers(
  participantId: string,
  validOnly: boolean = true
): Promise<CampaignHelper[]> {
  let query = supabase
    .from('campaign_helpers')
    .select('*')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false });

  if (validOnly) {
    query = query.eq('is_valid', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get helpers error:', error);
    return [];
  }

  return data || [];
}

// ============================================
// QR Code Generation
// ============================================

/**
 * Generate campaign scene string
 */
export function generateCampaignSceneStr(campaignId: string, referralCode: string): string {
  return `camp_${campaignId}_ref_${referralCode}`;
}

/**
 * Create campaign QR code (permanent)
 */
export async function createCampaignQRCode(
  campaignId: string,
  userId: string
): Promise<{ ticket: string; url: string; sceneStr: string }> {
  // Get or create participant
  const participant = await getOrCreateParticipant(campaignId, userId);
  
  // Generate scene string
  const sceneStr = generateCampaignSceneStr(campaignId, participant.referral_code);
  
  // Check if QR code already exists
  const { data: existingData } = await supabase
    .from('oa_qrcodes')
    .select('ticket, qr_url, scene_str')
    .eq('user_id', userId)
    .eq('scene_str', sceneStr)
    .single();

  const existing = existingData as unknown as { ticket: string; qr_url: string; scene_str: string } | null;

  if (existing) {
    return {
      ticket: existing.ticket,
      url: existing.qr_url,
      sceneStr: existing.scene_str,
    };
  }

  // Get access token
  const accessToken = await getOAAccessToken();

  // Create permanent QR code
  const response = await axios.post(
    `${OA_API.createQRCode}?access_token=${accessToken}`,
    {
      action_name: 'QR_LIMIT_STR_SCENE',
      action_info: {
        scene: {
          scene_str: sceneStr,
        },
      },
    }
  );

  if (response.data.errcode) {
    throw new Error(`Failed to create QR code: ${response.data.errmsg}`);
  }

  const ticket = response.data.ticket;
  const url = `${OA_API.getQRCodeImage}?ticket=${encodeURIComponent(ticket)}`;

  // Save to database
  await supabase.from('oa_qrcodes').insert({
    user_id: userId,
    scene_str: sceneStr,
    ticket,
    qr_type: 'permanent',
    qr_url: url,
  } as AnyRecord);

  // Log event
  await logEvent({
    event_type: 'campaign_qr_created',
    user_id: userId,
    event_data: {
      campaign_id: campaignId,
      referral_code: participant.referral_code,
      scene_str: sceneStr,
      ticket,
    },
  });

  return { ticket, url, sceneStr };
}

/**
 * Get QR code image as buffer
 */
export async function getCampaignQRCodeImage(ticket: string): Promise<Buffer> {
  const response = await axios.get(
    `${OA_API.getQRCodeImage}?ticket=${encodeURIComponent(ticket)}`,
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(response.data);
}

// ============================================
// Debug / Admin Operations
// ============================================

/**
 * Get campaign statistics
 */
export async function getCampaignStats(campaignId: string): Promise<{
  totalParticipants: number;
  totalHelpers: number;
  validHelpers: number;
  avgHelpersPerParticipant: number;
}> {
  // Count participants
  const { count: participantCount } = await supabase
    .from('campaign_participants')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  // Count total helpers
  const { count: totalHelperCount } = await supabase
    .from('campaign_helpers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  // Count valid helpers
  const { count: validHelperCount } = await supabase
    .from('campaign_helpers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('is_valid', true);

  const totalParticipants = participantCount || 0;
  const totalHelpers = totalHelperCount || 0;
  const validHelpers = validHelperCount || 0;

  return {
    totalParticipants,
    totalHelpers,
    validHelpers,
    avgHelpersPerParticipant: totalParticipants > 0 
      ? Math.round((validHelpers / totalParticipants) * 100) / 100 
      : 0,
  };
}

/**
 * Get recent campaign events for debugging
 */
export async function getCampaignDebugEvents(
  campaignId: string,
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabase
    .from('event_logs')
    .select('*')
    .or(`event_data->campaign_id.eq.${campaignId},event_type.in.(campaign_join,campaign_help,campaign_qr_created)`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Get campaign debug events error:', error);
    return [];
  }

  return data || [];
}

// ============================================
// Reward Claiming
// ============================================

export interface RewardClaim {
  id: string;
  campaign_id: string;
  participant_id: string;
  reward_id: string;
  user_id: string;
  tier_level: number;
  helper_count_at_claim: number;
  reward_content: Record<string, any>;
  claimed_at: string;
}

export interface ClaimRewardResult {
  success: boolean;
  message: string;
  claim?: RewardClaim;
  reward?: CampaignReward;
}

/**
 * Check if a reward can be claimed
 */
export async function canClaimReward(
  participantId: string,
  rewardId: string
): Promise<{ canClaim: boolean; reason?: string; helperCount?: number; helpersRequired?: number }> {
  // Get participant
  const { data: participantData } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('id', participantId)
    .single();

  const participant = participantData as unknown as CampaignParticipant | null;

  if (!participant) {
    return { canClaim: false, reason: '参与记录不存在' };
  }

  // Get reward
  const { data: rewardData } = await supabase
    .from('campaign_rewards')
    .select('*')
    .eq('id', rewardId)
    .single();

  const reward = rewardData as unknown as CampaignReward | null;

  if (!reward) {
    return { canClaim: false, reason: '奖品不存在' };
  }

  // Check if already claimed
  const { data: existingClaim } = await supabase
    .from('campaign_reward_claims')
    .select('id')
    .eq('participant_id', participantId)
    .eq('reward_id', rewardId)
    .single();

  if (existingClaim) {
    return { canClaim: false, reason: '已经领取过该奖品' };
  }

  // Recalculate valid helper count (in case of unfollows)
  const { count: validHelperCount } = await supabase
    .from('campaign_helpers')
    .select('*', { count: 'exact', head: true })
    .eq('participant_id', participantId)
    .eq('is_valid', true);

  const helperCount = validHelperCount || 0;

  // Check if enough helpers
  if (helperCount < reward.helpers_required) {
    const shortfall = reward.helpers_required - helperCount;
    return { 
      canClaim: false, 
      reason: `还差 ${shortfall} 人助力才能领取`,
      helperCount,
      helpersRequired: reward.helpers_required,
    };
  }

  // Check stock
  if (reward.stock !== -1 && reward.claimed_count >= reward.stock) {
    return { canClaim: false, reason: '奖品已被领完' };
  }

  return { 
    canClaim: true, 
    helperCount,
    helpersRequired: reward.helpers_required,
  };
}

/**
 * Claim a reward
 */
export async function claimReward(
  participantId: string,
  rewardId: string,
  userId: string
): Promise<ClaimRewardResult> {
  // Check if can claim
  const checkResult = await canClaimReward(participantId, rewardId);
  
  if (!checkResult.canClaim) {
    return {
      success: false,
      message: checkResult.reason || '无法领取',
    };
  }

  // Get reward details
  const { data: rewardData } = await supabase
    .from('campaign_rewards')
    .select('*')
    .eq('id', rewardId)
    .single();

  const reward = rewardData as unknown as CampaignReward | null;

  if (!reward) {
    return { success: false, message: '奖品不存在' };
  }

  // Get participant for campaign_id
  const { data: participantData } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('id', participantId)
    .single();

  const participant = participantData as unknown as CampaignParticipant | null;

  if (!participant) {
    return { success: false, message: '参与记录不存在' };
  }

  // Create claim record
  const { data: claimData, error: claimError } = await supabase
    .from('campaign_reward_claims')
    .insert({
      campaign_id: participant.campaign_id,
      participant_id: participantId,
      reward_id: rewardId,
      user_id: userId,
      tier_level: reward.tier_level,
      helper_count_at_claim: checkResult.helperCount || 0,
      reward_content: reward.reward_content,
    } as AnyRecord)
    .select()
    .single();

  if (claimError) {
    // Check if duplicate
    if (claimError.code === '23505') {
      return { success: false, message: '已经领取过该奖品' };
    }
    console.error('Claim reward error:', claimError);
    return { success: false, message: `领取失败: ${claimError.message}` };
  }

  const claim = claimData as unknown as RewardClaim;

  // Update reward claimed_count
  await supabase
    .from('campaign_rewards')
    .update({
      claimed_count: (reward.claimed_count || 0) + 1,
    } as AnyRecord)
    .eq('id', rewardId);

  // Update participant highest_tier_claimed
  if (reward.tier_level > participant.highest_tier_claimed) {
    await supabase
      .from('campaign_participants')
      .update({
        highest_tier_claimed: reward.tier_level,
        updated_at: new Date().toISOString(),
      } as AnyRecord)
      .eq('id', participantId);
  }

  // Log event
  await logEvent({
    event_type: 'campaign_reward_claimed',
    user_id: userId,
    event_data: {
      campaign_id: participant.campaign_id,
      participant_id: participantId,
      reward_id: rewardId,
      tier_level: reward.tier_level,
      reward_name: reward.reward_name,
      helper_count_at_claim: checkResult.helperCount,
    },
  });

  return {
    success: true,
    message: '领取成功',
    claim,
    reward,
  };
}

/**
 * Get claimed rewards for a participant
 */
export async function getClaimedRewards(participantId: string): Promise<RewardClaim[]> {
  const { data, error } = await supabase
    .from('campaign_reward_claims')
    .select('*')
    .eq('participant_id', participantId)
    .order('claimed_at', { ascending: true });

  if (error) {
    console.error('Get claimed rewards error:', error);
    return [];
  }

  return (data || []) as unknown as RewardClaim[];
}

/**
 * Get claimable rewards for a participant (rewards they can claim based on helper count)
 */
export async function getClaimableRewards(
  campaignId: string,
  participantId: string
): Promise<{ reward: CampaignReward; canClaim: boolean; claimed: boolean }[]> {
  // Get all rewards for campaign
  const rewards = await getCampaignRewards(campaignId);
  
  // Get participant's current helper count
  const { data: participantData } = await supabase
    .from('campaign_participants')
    .select('helper_count')
    .eq('id', participantId)
    .single();

  const participant = participantData as unknown as { helper_count: number } | null;
  const helperCount = participant?.helper_count || 0;

  // Get already claimed rewards
  const claimedRewards = await getClaimedRewards(participantId);
  const claimedRewardIds = new Set(claimedRewards.map(c => c.reward_id));

  // Map rewards with claim status
  return rewards.map(reward => ({
    reward,
    canClaim: helperCount >= reward.helpers_required && !claimedRewardIds.has(reward.id),
    claimed: claimedRewardIds.has(reward.id),
  }));
}
