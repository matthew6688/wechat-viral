import { parseString } from 'xml2js';
import { promisify } from 'util';
import crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../config/supabase';
import { oaConfig, OA_API } from '../config/wechat';
import { getOAAccessToken } from './oa-qrcode';
import { logEvent } from './event-logger';

const parseXML = promisify(parseString);

export interface WeChatEvent {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: string;
  Event?: string;
  EventKey?: string;
}

/**
 * Verify WeChat server signature
 */
export function verifySignature(
  signature: string,
  timestamp: string,
  nonce: string,
  token: string
): boolean {
  const tmpArr = [token, timestamp, nonce].sort();
  const tmpStr = tmpArr.join('');
  const hash = crypto.createHash('sha1').update(tmpStr).digest('hex');
  return hash === signature;
}

/**
 * Parse WeChat event XML
 */
export async function parseEventXML(xml: string): Promise<WeChatEvent> {
  const result = await parseXML(xml);
  const xmlData = result.xml;
  
  return {
    ToUserName: xmlData.ToUserName[0],
    FromUserName: xmlData.FromUserName[0],
    CreateTime: parseInt(xmlData.CreateTime[0]),
    MsgType: xmlData.MsgType[0],
    Event: xmlData.Event?.[0],
    EventKey: xmlData.EventKey?.[0],
  };
}

/**
 * Parse scene string to get referral code
 */
function parseSceneStr(sceneStr: string): string | null {
  // Format: "qrscene_ref_ABC123" (subscribe) or "ref_ABC123" (SCAN)
  const match = sceneStr.match(/ref_([A-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Find inviter by referral code
 */
async function findInviterByReferralCode(referralCode: string): Promise<string | null> {
  const { data: referral } = await supabase
    .from('user_referrals')
    .select('user_id')
    .eq('short_code', referralCode)
    .single();

  return referral?.user_id || null;
}

/**
 * Get user info from Official Account (includes unionid if bound)
 */
async function getUserInfo(openid: string): Promise<{
  openid: string;
  unionid?: string;
  nickname?: string;
}> {
  try {
    const accessToken = await getOAAccessToken();
    const response = await axios.get(OA_API.getUserInfo, {
      params: {
        access_token: accessToken,
        openid,
        lang: 'zh_CN',
      },
    });

    if (response.data.errcode) {
      console.error('Failed to get user info:', response.data.errmsg);
      return { openid };
    }

    return {
      openid: response.data.openid,
      unionid: response.data.unionid,
      nickname: response.data.nickname,
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    return { openid };
  }
}

/**
 * Identify or create user by openid/unionid
 */
async function identifyUser(
  openid: string,
  unionid?: string
): Promise<{ id: string; isNew: boolean }> {
  // Priority 1: Find by unionid (if bound to Open Platform)
  if (unionid) {
    const { data: userByUnionid } = await supabase
      .from('users')
      .select('id')
      .eq('unionid', unionid)
      .single();

    if (userByUnionid) {
      // Update openid_oa if different
      await supabase
        .from('users')
        .update({ openid_oa: openid })
        .eq('id', userByUnionid.id);
      return { id: userByUnionid.id, isNew: false };
    }
  }

  // Priority 2: Find by openid_oa
  const { data: userByOpenid } = await supabase
    .from('users')
    .select('id')
    .eq('openid_oa', openid)
    .single();

  if (userByOpenid) {
    // Update unionid if available
    if (unionid) {
      await supabase
        .from('users')
        .update({ unionid })
        .eq('id', userByOpenid.id);
    }
    return { id: userByOpenid.id, isNew: false };
  }

  // Priority 3: Find by openid (Mini Program)
  const { data: userByMpOpenid } = await supabase
    .from('users')
    .select('id')
    .eq('openid', openid)
    .single();

  if (userByMpOpenid) {
    // Update openid_oa and unionid
    const updateData: any = { openid_oa: openid };
    if (unionid) updateData.unionid = unionid;
    await supabase.from('users').update(updateData).eq('id', userByMpOpenid.id);
    return { id: userByMpOpenid.id, isNew: false };
  }

  // Create new user (minimal info, will be completed in Mini Program)
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      openid_oa: openid,
      unionid: unionid || null,
      name: '新用户',
      phone: '',
      wechat_id: '',
      company: '',
      role: 'Other',
      main_products: '',
    })
    .select('id')
    .single();

  if (error || !newUser) {
    throw new Error(`Failed to create user: ${error?.message}`);
  }

  return { id: newUser.id, isNew: true };
}

/**
 * Record follow event
 */
async function recordFollowEvent(
  openid: string,
  unionid: string | undefined,
  sceneStr: string | undefined,
  inviterUserId: string | null
) {
  await supabase.from('oa_follow_events').insert({
    openid,
    unionid: unionid || null,
    scene_str: sceneStr || null,
    inviter_user_id: inviterUserId,
    is_following: true,
  });
}

/**
 * Record scan event
 */
async function recordScanEvent(
  openid: string,
  unionid: string | undefined,
  sceneStr: string,
  eventType: 'subscribe' | 'SCAN',
  inviterUserId: string | null
) {
  await supabase.from('oa_scan_events').insert({
    openid,
    unionid: unionid || null,
    scene_str: sceneStr,
    event_type: eventType,
    inviter_user_id: inviterUserId,
  });
}

/**
 * Record invite relationship
 */
async function recordInvite(
  inviterUserId: string,
  inviteeUserId: string,
  activityId: string
) {
  // Check if already exists
  const { data: existing } = await supabase
    .from('invites')
    .select('id')
    .eq('activity_id', activityId)
    .eq('inviter_user_id', inviterUserId)
    .eq('invitee_user_id', inviteeUserId)
    .single();

  if (!existing) {
    await supabase.from('invites').insert({
      activity_id: activityId,
      inviter_user_id: inviterUserId,
      invitee_user_id: inviteeUserId,
    });
  }
}

/**
 * Generate Mini Program link
 */
function generateMiniProgramLink(referralCode: string): string {
  const mpAppId = process.env.WECHAT_APPID; // Mini Program AppID
  return `pages/landing/index?ref=${referralCode}&from=oa`;
}

/**
 * Generate welcome message
 */
function generateWelcomeMessage(inviterName?: string): string {
  let message = '欢迎关注！\n\n';
  
  if (inviterName) {
    message += `${inviterName} 邀请您加入我们的活动。\n\n`;
  }
  
  message += '点击下方链接进入小程序，完成注册即可获得积分奖励！';
  
  return message;
}

/**
 * Handle subscribe event
 */
export async function handleSubscribeEvent(event: WeChatEvent): Promise<string> {
  const openid = event.FromUserName;
  const sceneStr = event.EventKey || '';
  const referralCode = parseSceneStr(sceneStr);

  // Get user info (includes unionid if bound)
  const userInfo = await getUserInfo(openid);

  // Identify or create user
  const { id: userId, isNew } = await identifyUser(openid, userInfo.unionid);

  // Find inviter
  let inviterUserId: string | null = null;
  let inviterName: string | undefined;
  
  if (referralCode) {
    inviterUserId = await findInviterByReferralCode(referralCode);
    
    if (inviterUserId) {
      const { data: inviter } = await supabase
        .from('users')
        .select('name')
        .eq('id', inviterUserId)
        .single();
      inviterName = inviter?.name;
      
      // Record invite relationship
      const { data: activity } = await supabase
        .from('activities')
        .select('id')
        .limit(1)
        .single();
      
      if (activity) {
        await recordInvite(inviterUserId, userId, activity.id);
      }
    }
  }

  // Record events
  await recordFollowEvent(openid, userInfo.unionid, sceneStr, inviterUserId);
  await recordScanEvent(openid, userInfo.unionid, sceneStr || 'none', 'subscribe', inviterUserId);
  
  // Log to event_logs
  await logEvent({
    event_type: 'follow_oa',
    user_id: userId,
    related_user_id: inviterUserId || undefined,
    event_data: {
      openid,
      unionid: userInfo.unionid,
      scene_str: sceneStr,
      referral_code: referralCode || null,
      is_new_user: isNew,
    },
  });
  
  await logEvent({
    event_type: 'scan_qr',
    user_id: userId,
    related_user_id: inviterUserId || undefined,
    event_data: {
      openid,
      unionid: userInfo.unionid,
      scene_str: sceneStr || 'none',
      event_type: 'subscribe',
      referral_code: referralCode || null,
    },
  });

  // Generate Mini Program link
  const mpLink = referralCode
    ? generateMiniProgramLink(referralCode)
    : 'pages/landing/index?from=oa';

  // Generate reply message
  const message = generateWelcomeMessage(inviterName);
  
  // Return XML reply
  return `<xml>
    <ToUserName><![CDATA[${openid}]]></ToUserName>
    <FromUserName><![CDATA[${event.ToUserName}]]></FromUserName>
    <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
    <MsgType><![CDATA[text]]></MsgType>
    <Content><![CDATA[${message}\n\n小程序链接：${mpLink}]]></Content>
  </xml>`;
}

/**
 * Handle unsubscribe event
 */
export async function handleUnsubscribeEvent(event: WeChatEvent): Promise<void> {
  const openid = event.FromUserName;

  // Find user by openid
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('openid_oa', openid)
    .single();
  
  // Update follow status
  await supabase
    .from('oa_follow_events')
    .update({
      is_following: false,
      unfollow_time: new Date().toISOString(),
    })
    .eq('openid', openid)
    .eq('is_following', true);
  
  // Log to event_logs
  if (user) {
    await logEvent({
      event_type: 'unfollow_oa',
      user_id: user.id,
      event_data: {
        openid,
      },
    });
  }
}

/**
 * Handle scan event (user already following)
 */
export async function handleScanEvent(event: WeChatEvent): Promise<string> {
  const openid = event.FromUserName;
  const sceneStr = event.EventKey || '';
  const referralCode = parseSceneStr(sceneStr);

  // Get user info
  const userInfo = await getUserInfo(openid);

  // Find or create user
  const { id: userId } = await identifyUser(openid, userInfo.unionid);

  // Find inviter
  let inviterUserId: string | null = null;
  let inviterName: string | undefined;
  
  if (referralCode) {
    inviterUserId = await findInviterByReferralCode(referralCode);
    
    if (inviterUserId) {
      const { data: inviter } = await supabase
        .from('users')
        .select('name')
        .eq('id', inviterUserId)
        .single();
      inviterName = inviter?.name;
      
      // Record invite relationship
      const { data: activity } = await supabase
        .from('activities')
        .select('id')
        .limit(1)
        .single();
      
      if (activity) {
        await recordInvite(inviterUserId, userId, activity.id);
      }
    }
  }

  // Record scan event
  await recordScanEvent(openid, userInfo.unionid, sceneStr || 'none', 'SCAN', inviterUserId);
  
  // Log to event_logs
  await logEvent({
    event_type: 'scan_qr',
    user_id: userId,
    related_user_id: inviterUserId || undefined,
    event_data: {
      openid,
      unionid: userInfo.unionid,
      scene_str: sceneStr || 'none',
      event_type: 'SCAN',
      referral_code: referralCode || null,
    },
  });

  // Generate Mini Program link
  const mpLink = referralCode
    ? generateMiniProgramLink(referralCode)
    : 'pages/landing/index?from=oa';

  // Generate reply message
  const message = inviterName
    ? `${inviterName} 邀请您加入活动！\n\n点击链接进入小程序：${mpLink}`
    : `欢迎回来！\n\n点击链接进入小程序：${mpLink}`;

  // Return XML reply
  return `<xml>
    <ToUserName><![CDATA[${openid}]]></ToUserName>
    <FromUserName><![CDATA[${event.ToUserName}]]></FromUserName>
    <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
    <MsgType><![CDATA[text]]></MsgType>
    <Content><![CDATA[${message}]]></Content>
  </xml>`;
}
