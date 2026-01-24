import axios from 'axios';
import { supabase } from '../config/supabase';
import { oaConfig, OA_API } from '../config/wechat';
import { getUserReferralCode } from './scene';

/**
 * Create a user-linking QR code
 * This QR code, when scanned, will link the OA openid to an existing Mini Program user
 * Scene format: link_user_{userId}
 */
export async function createUserLinkingQRCode(
  userId: string,
  retryCount: number = 0
): Promise<{
  ticket: string;
  url: string;
  sceneStr: string;
}> {
  // Check if linking QR code already exists
  const { data: existing } = await supabase
    .from('oa_qrcodes')
    .select('ticket, qr_url, scene_str')
    .eq('user_id', userId)
    .eq('qr_type', 'user_linking')
    .single();

  if (existing) {
    return {
      ticket: existing.ticket,
      url: existing.qr_url,
      sceneStr: existing.scene_str,
    };
  }

  // Create new QR code with user_id in scene
  const accessToken = await getOAAccessToken();
  const sceneStr = `link_user_${userId}`;

  console.log('[OA QRCode] Creating user-linking QR code:', { userId, sceneStr });

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

  // Handle token expiry error - retry with fresh token
  if (response.data.errcode === 40001 || response.data.errcode === 42001) {
    console.log('[OA QRCode] Token error, refreshing and retrying...');
    if (retryCount < 2) {
      clearAccessTokenCache();
      await getOAAccessToken(true); // Force refresh
      return createUserLinkingQRCode(userId, retryCount + 1);
    }
  }

  if (response.data.errcode) {
    console.error('[OA QRCode] Failed to create linking QR code:', response.data);
    throw new Error(`Failed to create linking QR code: ${response.data.errmsg}`);
  }

  const ticket = response.data.ticket;
  const url = `${OA_API.getQRCodeImage}?ticket=${encodeURIComponent(ticket)}`;

  // Save to database
  await supabase.from('oa_qrcodes').insert({
    user_id: userId,
    ticket,
    qr_url: url,
    scene_str: sceneStr,
    qr_type: 'user_linking',
  });

  console.log(`[OA QRCode] Created user-linking QR code for user ${userId}`);

  return { ticket, url, sceneStr };
}

let accessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get Official Account access token (with caching)
 * @param forceRefresh - If true, forces a new token to be fetched
 */
export async function getOAAccessToken(forceRefresh: boolean = false): Promise<string> {
  // Check cache (unless force refresh)
  if (!forceRefresh && accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    console.log('[OA Token] Using cached token, expires in', Math.round((accessTokenCache.expiresAt - Date.now()) / 1000), 'seconds');
    return accessTokenCache.token;
  }

  console.log('[OA Token] Fetching new access token...');

  // Get new token
  const response = await axios.get(OA_API.getAccessToken, {
    params: {
      grant_type: 'client_credential',
      appid: oaConfig.appId,
      secret: oaConfig.secret,
    },
  });

  if (response.data.errcode) {
    console.error('[OA Token] Failed to get access token:', response.data);
    throw new Error(`Failed to get access token: ${response.data.errmsg}`);
  }

  // Cache token (expires in 7200 seconds, cache for 7000 seconds to be safe)
  accessTokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + (response.data.expires_in - 200) * 1000,
  };

  console.log('[OA Token] New token obtained, expires in', response.data.expires_in, 'seconds');

  return accessTokenCache.token;
}

/**
 * Force refresh the access token (used after token errors)
 */
export function clearAccessTokenCache(): void {
  console.log('[OA Token] Cache cleared');
  accessTokenCache = null;
}

/**
 * Create permanent QR code for user
 */
export async function createPermanentQRCode(
  userId: string,
  referralCode: string,
  retryCount: number = 0
): Promise<{ ticket: string; url: string }> {
  const accessToken = await getOAAccessToken();
  const sceneStr = `ref_${referralCode}`;

  console.log('[OA QRCode] Creating permanent QR code:', { userId, sceneStr });

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

  // Handle token expiry error - retry with fresh token
  if (response.data.errcode === 40001 || response.data.errcode === 42001) {
    console.log('[OA QRCode] Token error, refreshing and retrying...');
    if (retryCount < 2) {
      clearAccessTokenCache();
      await getOAAccessToken(true); // Force refresh
      return createPermanentQRCode(userId, referralCode, retryCount + 1);
    }
  }

  if (response.data.errcode) {
    console.error('[OA QRCode] Failed to create QR code:', response.data);
    throw new Error(`Failed to create QR code: ${response.data.errmsg}`);
  }

  const ticket = response.data.ticket;
  const url = `${OA_API.getQRCodeImage}?ticket=${encodeURIComponent(ticket)}`;

  return { ticket, url };
}

/**
 * Get or create user's Official Account QR code
 */
export async function getOrCreateUserQRCode(userId: string): Promise<{
  ticket: string;
  url: string;
  sceneStr: string;
}> {
  // Check if QR code already exists
  const { data: existing } = await supabase
    .from('oa_qrcodes')
    .select('ticket, qr_url, scene_str')
    .eq('user_id', userId)
    .eq('qr_type', 'permanent')
    .single();

  if (existing) {
    return {
      ticket: existing.ticket,
      url: existing.qr_url,
      sceneStr: existing.scene_str,
    };
  }

  // Get user's referral code
  const { data: activity } = await supabase
    .from('activities')
    .select('id')
    .limit(1)
    .single();

  if (!activity) {
    throw new Error('No activity found');
  }

  const referralCode = await getUserReferralCode(userId, activity.id);

  // Create new QR code
  const { ticket, url } = await createPermanentQRCode(userId, referralCode);
  const sceneStr = `ref_${referralCode}`;

  // Save to database (use upsert to handle duplicates)
  const { error } = await supabase.from('oa_qrcodes').upsert(
    {
      user_id: userId,
      scene_str: sceneStr,
      ticket,
      qr_type: 'permanent',
      qr_url: url,
    },
    {
      onConflict: 'ticket',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    // If it's a duplicate key error, try to fetch the existing record
    if (error.code === '23505') {
      const { data: existingByTicket } = await supabase
        .from('oa_qrcodes')
        .select('ticket, qr_url, scene_str')
        .eq('ticket', ticket)
        .single();
      
      if (existingByTicket) {
        return {
          ticket: existingByTicket.ticket,
          url: existingByTicket.qr_url,
          sceneStr: existingByTicket.scene_str,
        };
      }
    }
    throw new Error(`Failed to save QR code: ${error.message}`);
  }

  return { ticket, url, sceneStr };
}

/**
 * Get QR code image as buffer
 */
export async function getQRCodeImage(ticket: string): Promise<Buffer> {
  const response = await axios.get(`${OA_API.getQRCodeImage}?ticket=${encodeURIComponent(ticket)}`, {
    responseType: 'arraybuffer',
  });

  return Buffer.from(response.data);
}

/**
 * Create campaign-specific QR code for a participant
 * Scene format: camp_{campaignId}_ref_{referralCode}
 */
export async function createCampaignQRCode(
  userId: string,
  campaignId: string,
  referralCode: string,
  retryCount: number = 0
): Promise<{ ticket: string; url: string; sceneStr: string }> {
  const accessToken = await getOAAccessToken();
  // Scene string must be ≤64 characters
  const sceneStr = `camp_${campaignId.slice(0, 8)}_ref_${referralCode.slice(0, 8)}`;

  console.log('[OA QRCode] Creating campaign QR code:', { campaignId, referralCode, sceneStr });

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

  // Handle token expiry error - retry with fresh token
  if (response.data.errcode === 40001 || response.data.errcode === 42001) {
    console.log('[OA QRCode] Token error, refreshing and retrying...');
    if (retryCount < 2) {
      clearAccessTokenCache();
      await getOAAccessToken(true); // Force refresh
      return createCampaignQRCode(userId, campaignId, referralCode, retryCount + 1);
    }
  }

  if (response.data.errcode) {
    console.error('[OA QRCode] Failed to create QR code:', response.data);
    throw new Error(`Failed to create campaign QR code: ${response.data.errmsg}`);
  }

  const ticket = response.data.ticket;
  const url = `${OA_API.getQRCodeImage}?ticket=${encodeURIComponent(ticket)}`;

  console.log('[OA QRCode] QR code created successfully:', { ticket: ticket.slice(0, 20) + '...' });

  return { ticket, url, sceneStr };
}

/**
 * Get or create campaign-specific QR code for a participant
 */
export async function getOrCreateCampaignQRCode(
  userId: string,
  campaignId: string
): Promise<{
  ticket: string;
  url: string;
  sceneStr: string;
}> {
  // Check if QR code already exists for this user+campaign combo
  const { data: existing } = await supabase
    .from('oa_qrcodes')
    .select('ticket, qr_url, scene_str')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .eq('qr_type', 'campaign')
    .single();

  if (existing) {
    return {
      ticket: existing.ticket,
      url: existing.qr_url,
      sceneStr: existing.scene_str,
    };
  }

  // Get user's referral code for this campaign
  const { data: participant } = await supabase
    .from('campaign_participants')
    .select('referral_code')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .single();

  let referralCode: string;
  if (participant?.referral_code) {
    referralCode = participant.referral_code;
  } else {
    // Generate a new referral code
    referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Create or update participant record
    await supabase
      .from('campaign_participants')
      .upsert({
        user_id: userId,
        campaign_id: campaignId,
        referral_code: referralCode,
        helper_count: 0,
      }, {
        onConflict: 'user_id,campaign_id',
      });
  }

  // Create new campaign QR code
  const { ticket, url, sceneStr } = await createCampaignQRCode(userId, campaignId, referralCode);

  // Save to database
  const { error } = await supabase.from('oa_qrcodes').upsert(
    {
      user_id: userId,
      campaign_id: campaignId,
      scene_str: sceneStr,
      ticket,
      qr_type: 'campaign',
      qr_url: url,
    },
    {
      onConflict: 'ticket',
      ignoreDuplicates: true,
    }
  );

  if (error && error.code !== '23505') {
    console.error('Failed to save campaign QR code:', error);
  }

  return { ticket, url, sceneStr };
}
