import { supabase } from '../config/supabase';

export interface SceneContext {
  activityId: string;
  inviterUserId?: string;
  channelId?: string;
}

/**
 * Resolve short_code from scene parameter to full context
 */
export async function resolveScene(shortCode: string): Promise<SceneContext | null> {
  // First check channels table
  const { data: channel, error: channelError } = await supabase
    .from('channels')
    .select('activity_id, id')
    .eq('short_code', shortCode)
    .single();

  if (channel && !channelError) {
    return {
      activityId: channel.activity_id,
      channelId: channel.id,
    };
  }

  // Then check user_referrals table (for referral codes)
  const { data: referral, error: referralError } = await supabase
    .from('user_referrals')
    .select('user_id, activity_id')
    .eq('short_code', shortCode)
    .single();

  if (referral && !referralError) {
    return {
      activityId: referral.activity_id,
      inviterUserId: referral.user_id,
    };
  }

  return null;
}

/**
 * Get or create user's referral short_code
 */
export async function getUserReferralCode(
  userId: string,
  activityId: string
): Promise<string> {
  // Check if user already has a referral code for this activity
  const { data: existing } = await supabase
    .from('user_referrals')
    .select('short_code')
    .eq('user_id', userId)
    .eq('activity_id', activityId)
    .single();

  if (existing?.short_code) {
    return existing.short_code;
  }

  // Generate new short code
  const shortCode = generateShortCode();

  // Insert new referral code
  const { error } = await supabase.from('user_referrals').insert({
    user_id: userId,
    activity_id: activityId,
    short_code: shortCode,
  });

  if (error) {
    // If duplicate, try again with new code
    if (error.code === '23505') {
      return getUserReferralCode(userId, activityId);
    }
    throw error;
  }

  return shortCode;
}

/**
 * Generate a random short code (6-8 characters)
 */
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
