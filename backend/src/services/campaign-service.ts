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
  // Message fields
  messages_enabled?: boolean;
  message_to_sharer?: string;
  message_to_helper?: string;
  msg_rule?: string;
  msg_helper_success?: string;
  msg_duplicate_help?: string;
  msg_campaign_ended?: string;
  msg_campaign_ended_image_url?: string;
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
 * Note: Due to WeChat's 64-character limit, IDs may be truncated to 8 characters
 */
export function parseCampaignScene(sceneStr: string): ParsedCampaignScene | null {
  // Remove "qrscene_" prefix if present (added by WeChat for subscribe events)
  const cleanScene = sceneStr.replace(/^qrscene_/, '');
  
  // Match pattern: camp_{id}_ref_{code}
  // ID can be:
  // - Full UUID (36 chars): xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // - Short ID (8 chars): xxxxxxxx (first 8 chars of UUID, used due to WeChat's 64-char limit)
  const match = cleanScene.match(/^camp_([a-f0-9-]{8,36})_ref_([A-Z0-9]{1,8})$/i);
  
  if (match) {
    console.log('[parseCampaignScene] Matched scene:', {
      campaignIdFragment: match[1],
      referralCode: match[2],
      raw: sceneStr,
    });
    return {
      campaignId: match[1], // This may be a partial ID (first 8 chars)
      referralCode: match[2],
      raw: sceneStr,
    };
  }
  
  console.log('[parseCampaignScene] No match for scene:', cleanScene);
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
 * Get active campaign by ID (supports both full UUID and partial ID)
 */
export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  // If it's a full UUID (36 chars), use exact match
  if (campaignId.length === 36) {
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
  
  // If it's a partial ID (8 chars), query using raw SQL
  console.log('[getCampaign] Looking up campaign by partial ID:', campaignId);
  
  // Use raw SQL query for partial ID matching (UUID needs to be cast to text for LIKE)
  const { data, error } = await supabase
    .rpc('get_campaign_by_partial_id', { partial_id: campaignId });

  if (error) {
    // Fallback: fetch all campaigns and filter in code
    console.log('[getCampaign] RPC not available, using fallback query');
    const { data: allCampaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('*');
    
    if (fetchError || !allCampaigns) {
      console.error('Get campaigns error:', fetchError);
      return null;
    }
    
    // Find campaign where ID starts with the partial ID
    const campaign = allCampaigns.find(c => c.id.startsWith(campaignId));
    if (campaign) {
      console.log('[getCampaign] Found campaign via fallback:', campaign.id, campaign.name);
      return campaign;
    }
    
    console.error('Campaign not found with partial ID:', campaignId);
    return null;
  }
  
  if (data && data.length > 0) {
    console.log('[getCampaign] Found campaign:', data[0].id, data[0].name);
    return data[0];
  }
  
  return null;
}

/**
 * Get full campaign ID from a partial ID
 */
export async function getFullCampaignId(partialId: string): Promise<string | null> {
  if (partialId.length === 36) {
    return partialId; // Already full ID
  }
  
  // Fetch all campaigns and find by partial ID prefix
  const { data: allCampaigns, error } = await supabase
    .from('campaigns')
    .select('id');
  
  if (error || !allCampaigns) {
    console.error('Get full campaign ID error:', error);
    return null;
  }
  
  const campaign = allCampaigns.find(c => c.id.startsWith(partialId));
  return campaign?.id || null;
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
 * Supports both full IDs and partial IDs (8-char prefix)
 * Also handles QR code -> user lookup for data consistency
 */
export async function findParticipantByCode(
  campaignId: string,
  referralCode: string
): Promise<CampaignParticipant | null> {
  console.log('[findParticipantByCode] Looking for:', { campaignId, referralCode });
  
  // First, get the full campaign ID if we have a partial one
  const fullCampaignId = await getFullCampaignId(campaignId);
  if (!fullCampaignId) {
    console.error('[findParticipantByCode] Campaign not found for ID:', campaignId);
    return null;
  }
  
  // Try exact match first
  let { data, error } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', fullCampaignId)
    .eq('referral_code', referralCode)
    .single();

  if (data) {
    console.log('[findParticipantByCode] Found participant by exact match:', data.id);
    return data;
  }
  
  // If referral code might be truncated, try prefix match on participants
  const { data: allParticipants } = await supabase
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', fullCampaignId);
  
  if (allParticipants) {
    // Check if any participant's referral code starts with or equals the provided code
    const participant = allParticipants.find(p => 
      p.referral_code === referralCode ||
      p.referral_code.startsWith(referralCode) ||
      referralCode.startsWith(p.referral_code)
    );
    
    if (participant) {
      console.log('[findParticipantByCode] Found participant by prefix match:', participant.id);
      return participant;
    }
  }
  
  // Fallback: look up by QR code scene string to find the user
  // This handles cases where the QR code has a different referral code than the participant record
  console.log('[findParticipantByCode] Trying QR code lookup fallback');
  const scenePattern = `camp_${campaignId}_ref_${referralCode}`;
  
  const { data: qrCodes } = await supabase
    .from('oa_qrcodes')
    .select('user_id, scene_str');
  
  if (qrCodes) {
    // Find QR code that matches the scene pattern
    const qrCode = qrCodes.find(qr => 
      qr.scene_str === scenePattern ||
      qr.scene_str.includes(`_ref_${referralCode}`)
    );
    
    if (qrCode) {
      console.log('[findParticipantByCode] Found QR code for user:', qrCode.user_id);
      
      // Now find the participant for this user
      const { data: participantByUser } = await supabase
        .from('campaign_participants')
        .select('*')
        .eq('campaign_id', fullCampaignId)
        .eq('user_id', qrCode.user_id)
        .single();
      
      if (participantByUser) {
        console.log('[findParticipantByCode] Found participant via QR code lookup:', participantByUser.id);
        return participantByUser;
      }
    }
  }
  
  console.log('[findParticipantByCode] No participant found');
  return null;
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
 * 
 * @param sourceChannel - Source of the helper: wechat_scan, wechat_article, wechat_menu, moments, group_chat, private_chat
 */
export async function recordHelper(
  campaignId: string,
  participantId: string,
  helperOpenid: string,
  helperUnionid?: string,
  helperUserId?: string,
  sourceChannel?: string
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
    source_channel: sourceChannel || 'wechat_scan',
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
    .select(`
      *,
      helper_user:users!campaign_helpers_helper_user_id_fkey(
        id, name, wechat_nickname, wechat_avatar_url
      )
    `)
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

  // Transform to include display name
  return (data || []).map((helper: any) => ({
    ...helper,
    display_name: helper.helper_user?.wechat_nickname || helper.helper_user?.name || '微信用户',
    avatar_url: helper.helper_user?.wechat_avatar_url || null,
  }));
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
 * Get enhanced campaign statistics
 */
export async function getCampaignStats(campaignId: string): Promise<{
  totalParticipants: number;
  totalHelpers: number;
  validHelpers: number;
  invalidHelpers: number;
  avgHelpersPerParticipant: number;
  rewardsClaimed: number;
  totalRewardsAvailable: number;
  conversionRate: number;
  retentionRate: number;
  topPerformer: { name: string; helperCount: number } | null;
  helpersToday: number;
  helpersThisWeek: number;
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

  // Count invalid helpers (unfollowed)
  const { count: invalidHelperCount } = await supabase
    .from('campaign_helpers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('is_valid', false);

  // Count rewards claimed
  const { count: rewardsClaimedCount } = await supabase
    .from('campaign_reward_claims')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  // Count total rewards available
  const { count: totalRewardsCount } = await supabase
    .from('campaign_rewards')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  // Get top performer
  const { data: topPerformerData } = await supabase
    .from('campaign_participants')
    .select(`
      helper_count,
      user:users(name, wechat_nickname)
    `)
    .eq('campaign_id', campaignId)
    .order('helper_count', { ascending: false })
    .limit(1) as any;

  // Count helpers today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: helpersTodayCount } = await supabase
    .from('campaign_helpers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', today.toISOString());

  // Count helpers this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: helpersWeekCount } = await supabase
    .from('campaign_helpers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', weekAgo.toISOString());

  const totalParticipants = participantCount || 0;
  const totalHelpers = totalHelperCount || 0;
  const validHelpers = validHelperCount || 0;
  const invalidHelpers = invalidHelperCount || 0;
  const rewardsClaimed = rewardsClaimedCount || 0;
  const totalRewardsAvailable = totalRewardsCount || 0;

  // Calculate conversion rate (helpers who became participants)
  const conversionRate = totalHelpers > 0 
    ? Math.round((totalParticipants / totalHelpers) * 100) 
    : 0;

  // Calculate retention rate
  const retentionRate = totalHelpers > 0
    ? Math.round((validHelpers / totalHelpers) * 100)
    : 100;

  // Get top performer info
  let topPerformer = null;
  if (topPerformerData && topPerformerData.length > 0) {
    const tp = topPerformerData[0] as any;
    topPerformer = {
      name: tp.user?.wechat_nickname || tp.user?.name || 'Unknown',
      helperCount: tp.helper_count || 0,
    };
  }

  return {
    totalParticipants,
    totalHelpers,
    validHelpers,
    invalidHelpers,
    avgHelpersPerParticipant: totalParticipants > 0 
      ? Math.round((validHelpers / totalParticipants) * 100) / 100 
      : 0,
    rewardsClaimed,
    totalRewardsAvailable,
    conversionRate,
    retentionRate,
    topPerformer,
    helpersToday: helpersTodayCount || 0,
    helpersThisWeek: helpersWeekCount || 0,
  };
}

/**
 * Get recent campaign events for debugging
 */
export async function getCampaignDebugEvents(
  campaignId: string,
  limit: number = 50
): Promise<any[]> {
  // First get all campaign events, then filter in JS
  // This is a workaround for Supabase's limited JSON filtering
  // Use explicit relationship name to avoid ambiguity
  const { data: allEvents, error } = await supabase
    .from('event_logs')
    .select(`
      *,
      user:users!event_logs_user_id_fkey(id, name, wechat_nickname, wechat_avatar_url)
    `)
    .or(`event_type.ilike.campaign%,event_type.eq.follow_oa,event_type.eq.unfollow_oa`)
    .order('created_at', { ascending: false })
    .limit(200);
  
  if (error) {
    console.error('Get campaign debug events error:', error);
    return [];
  }
  
  // Filter events that belong to this campaign
  const filteredEvents = (allEvents || []).filter((event: any) => {
    const eventCampaignId = event.event_data?.campaign_id;
    return eventCampaignId === campaignId;
  }).slice(0, limit);

  // Add user_display field for consistent frontend rendering
  return filteredEvents.map((event: any) => ({
    ...event,
    user_display: event.user ? {
      name: event.user.name,
      nickname: event.user.wechat_nickname,
      avatar: event.user.wechat_avatar_url,
    } : null,
  }));
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

  // Get reward details with all fields
  const { data: rewardData } = await supabase
    .from('campaign_rewards')
    .select('*')
    .eq('id', rewardId)
    .single();

  const reward = rewardData as unknown as (CampaignReward & {
    claim_method?: string;
    claim_link?: string;
    claim_text?: string;
    activation_source?: string;
  }) | null;

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

  // Handle activation code claim
  let activationCode: string | null = null;
  const claimMethod = (reward as any).claim_method || 'link';
  
  if (claimMethod === 'activation_code') {
    // Get an unused activation code
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('id, code')
      .eq('reward_id', rewardId)
      .eq('is_used', false)
      .limit(1)
      .single();

    if (codeError || !codeData) {
      return { success: false, message: '激活码已用完，请联系客服' };
    }

    // Mark the code as used
    const { error: updateError } = await supabase
      .from('activation_codes')
      .update({
        is_used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      } as AnyRecord)
      .eq('id', codeData.id)
      .eq('is_used', false); // Double check to prevent race condition

    if (updateError) {
      console.error('Failed to mark activation code as used:', updateError);
      return { success: false, message: '领取失败，请重试' };
    }

    activationCode = codeData.code;

    // Update remaining quantity
    const { count: remainingCount } = await supabase
      .from('activation_codes')
      .select('*', { count: 'exact', head: true })
      .eq('reward_id', rewardId)
      .eq('is_used', false);

    await supabase
      .from('campaign_rewards')
      .update({
        remaining_quantity: remainingCount || 0,
      } as AnyRecord)
      .eq('id', rewardId);
  }

  // Build reward content for the claim
  const rewardContent: Record<string, any> = {
    ...(reward.reward_content || {}),
    claim_method: claimMethod,
  };

  if (claimMethod === 'link' && (reward as any).claim_link) {
    rewardContent.claim_link = (reward as any).claim_link;
  } else if (claimMethod === 'text' && (reward as any).claim_text) {
    rewardContent.claim_text = (reward as any).claim_text;
  } else if (claimMethod === 'activation_code' && activationCode) {
    rewardContent.activation_code = activationCode;
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
      reward_content: rewardContent,
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
      claim_method: claimMethod,
      has_activation_code: !!activationCode,
    },
  });

  // Return with enhanced reward info
  const enhancedReward = {
    ...reward,
    claim_content: rewardContent,
  };

  return {
    success: true,
    message: '领取成功',
    claim,
    reward: enhancedReward as any,
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
