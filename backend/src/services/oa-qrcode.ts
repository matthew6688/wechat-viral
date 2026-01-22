import axios from 'axios';
import { supabase } from '../config/supabase';
import { oaConfig, OA_API } from '../config/wechat';
import { getUserReferralCode } from './scene';

let accessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get Official Account access token (with caching)
 */
export async function getOAAccessToken(): Promise<string> {
  // Check cache
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  // Get new token
  const response = await axios.get(OA_API.getAccessToken, {
    params: {
      grant_type: 'client_credential',
      appid: oaConfig.appId,
      secret: oaConfig.secret,
    },
  });

  if (response.data.errcode) {
    throw new Error(`Failed to get access token: ${response.data.errmsg}`);
  }

  // Cache token (expires in 7200 seconds, cache for 7000 seconds)
  accessTokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + (response.data.expires_in - 200) * 1000,
  };

  return accessTokenCache.token;
}

/**
 * Create permanent QR code for user
 */
export async function createPermanentQRCode(
  userId: string,
  referralCode: string
): Promise<{ ticket: string; url: string }> {
  const accessToken = await getOAAccessToken();
  const sceneStr = `ref_${referralCode}`;

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

  // Save to database
  const { error } = await supabase.from('oa_qrcodes').insert({
    user_id: userId,
    scene_str: sceneStr,
    ticket,
    qr_type: 'permanent',
    qr_url: url,
  });

  if (error) {
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
