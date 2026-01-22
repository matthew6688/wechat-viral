import { parseString } from 'xml2js';
import { promisify } from 'util';
import crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../config/supabase';
import { oaConfig, OA_API } from '../config/wechat';
import { getOAAccessToken } from './oa-qrcode';
import { logEvent } from './event-logger';
import {
  isCampaignScene,
  parseCampaignScene,
  findParticipantByCode,
  recordHelper,
  invalidateHelper,
  getCampaign,
} from './campaign-service';

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
  const result = await parseXML(xml) as { xml: Record<string, string[]> };
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
 * Parse scene string to get referral code (legacy format)
 * Format: "qrscene_ref_ABC123" (subscribe) or "ref_ABC123" (SCAN)
 */
function parseSceneStr(sceneStr: string): string | null {
  // Skip if it's a campaign scene (new format)
  if (isCampaignScene(sceneStr)) {
    return null;
  }
  
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
  
  // Get user info (includes unionid if bound)
  const userInfo = await getUserInfo(openid);

  // Identify or create user
  const { id: userId, isNew } = await identifyUser(openid, userInfo.unionid);

  // Check if this is a campaign scene (new format: camp_{id}_ref_{code})
  const campaignScene = parseCampaignScene(sceneStr);
  
  if (campaignScene) {
    // Handle campaign fission flow
    return handleCampaignSubscribe(event, openid, userInfo, userId, isNew, campaignScene);
  }

  // Legacy flow: simple referral code
  const referralCode = parseSceneStr(sceneStr);

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
 * Handle campaign subscribe event (new fission flow)
 */
async function handleCampaignSubscribe(
  event: WeChatEvent,
  openid: string,
  userInfo: { openid: string; unionid?: string; nickname?: string },
  userId: string,
  isNew: boolean,
  campaignScene: { campaignId: string; referralCode: string; raw: string }
): Promise<string> {
  const { campaignId, referralCode, raw: sceneStr } = campaignScene;

  console.log('=== Campaign Subscribe Event ===');
  console.log('Campaign ID:', campaignId);
  console.log('Referral Code:', referralCode);
  console.log('Helper OpenID:', openid);
  console.log('Helper UnionID:', userInfo.unionid);
  console.log('Helper User ID:', userId);
  console.log('Is New User:', isNew);

  // Get campaign info
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    console.error('Campaign not found:', campaignId);
    return generateErrorReply(event, '活动不存在或已结束');
  }

  // Find the participant being helped
  const participant = await findParticipantByCode(campaignId, referralCode);
  if (!participant) {
    console.error('Participant not found:', referralCode);
    return generateErrorReply(event, '邀请码无效');
  }

  // Get participant user info
  const { data: inviterUser } = await supabase
    .from('users')
    .select('id, name, wechat_nickname')
    .eq('id', participant.user_id)
    .single();

  const inviterName = inviterUser?.wechat_nickname || inviterUser?.name || '好友';

  // Record the help action
  const helpResult = await recordHelper(
    campaignId,
    participant.id,
    openid,
    userInfo.unionid,
    userId
  );

  console.log('Help Result:', helpResult);

  // Record follow event
  await recordFollowEvent(openid, userInfo.unionid, sceneStr, participant.user_id);

  // Log detailed event
  await logEvent({
    event_type: 'campaign_help',
    user_id: userId,
    related_user_id: participant.user_id,
    event_data: {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      participant_id: participant.id,
      referral_code: referralCode,
      helper_openid: openid,
      helper_unionid: userInfo.unionid,
      is_new_user: isNew,
      is_new_help: helpResult.isNew,
      help_success: helpResult.success,
      help_message: helpResult.message,
      new_helper_count: helpResult.helperCount,
      scene_str: sceneStr,
    },
  });

  // Generate response message
  let message = '';
  
  if (helpResult.success) {
    if (helpResult.isNew) {
      message = `🎉 助力成功！\n\n`;
      message += `您已成功为 ${inviterName} 助力！\n`;
      message += `当前进度：${helpResult.helperCount} 人\n\n`;
    } else {
      message = `✅ 助力已恢复！\n\n`;
      message += `您之前的助力已恢复有效。\n`;
      message += `当前进度：${helpResult.helperCount} 人\n\n`;
    }
  } else {
    message = `⚠️ ${helpResult.message}\n\n`;
    message += `您已经为 ${inviterName} 助力过了。\n\n`;
  }

  message += `━━━━━━━━━━━━━━\n`;
  message += `🎁 活动：${campaign.name}\n`;
  message += `📝 ${campaign.description || '邀请好友，赢取奖励！'}\n\n`;
  message += `👉 点击下方链接参与活动，邀请好友为您助力！`;

  // Generate Mini Program link for the helper to participate
  const mpLink = `pages/campaign/index?id=${campaignId}&from=oa`;

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
 * Generate error reply message
 */
function generateErrorReply(event: WeChatEvent, errorMessage: string): string {
  const openid = event.FromUserName;
  
  return `<xml>
    <ToUserName><![CDATA[${openid}]]></ToUserName>
    <FromUserName><![CDATA[${event.ToUserName}]]></FromUserName>
    <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
    <MsgType><![CDATA[text]]></MsgType>
    <Content><![CDATA[❌ ${errorMessage}\n\n如有问题，请联系客服。]]></Content>
  </xml>`;
}

/**
 * Handle unsubscribe event
 */
export async function handleUnsubscribeEvent(event: WeChatEvent): Promise<void> {
  const openid = event.FromUserName;

  console.log('=== Unsubscribe Event ===');
  console.log('OpenID:', openid);

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

  // Invalidate campaign helpers (new fission system)
  const invalidatedCount = await invalidateHelper(openid, 'unfollow');
  console.log('Invalidated helpers count:', invalidatedCount);
  
  // Log to event_logs
  if (user) {
    await logEvent({
      event_type: 'unfollow_oa',
      user_id: user.id,
      event_data: {
        openid,
        invalidated_helpers: invalidatedCount,
      },
    });
  } else {
    // Log even if user not found (for debugging)
    await logEvent({
      event_type: 'unfollow_oa',
      event_data: {
        openid,
        invalidated_helpers: invalidatedCount,
        user_not_found: true,
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

  // Get user info
  const userInfo = await getUserInfo(openid);

  // Find or create user
  const { id: userId, isNew } = await identifyUser(openid, userInfo.unionid);

  // Check if this is a campaign scene (new format: camp_{id}_ref_{code})
  const campaignScene = parseCampaignScene(sceneStr);
  
  if (campaignScene) {
    // Handle campaign fission flow (already following user scans a campaign QR)
    return handleCampaignScan(event, openid, userInfo, userId, campaignScene);
  }

  // Legacy flow: simple referral code
  const referralCode = parseSceneStr(sceneStr);

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

/**
 * Handle campaign scan event (already following user scans campaign QR)
 */
async function handleCampaignScan(
  event: WeChatEvent,
  openid: string,
  userInfo: { openid: string; unionid?: string; nickname?: string },
  userId: string,
  campaignScene: { campaignId: string; referralCode: string; raw: string }
): Promise<string> {
  const { campaignId, referralCode, raw: sceneStr } = campaignScene;

  console.log('=== Campaign Scan Event (Already Following) ===');
  console.log('Campaign ID:', campaignId);
  console.log('Referral Code:', referralCode);
  console.log('Scanner OpenID:', openid);
  console.log('Scanner User ID:', userId);

  // Get campaign info
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    console.error('Campaign not found:', campaignId);
    return generateErrorReply(event, '活动不存在或已结束');
  }

  // Find the participant being helped
  const participant = await findParticipantByCode(campaignId, referralCode);
  if (!participant) {
    console.error('Participant not found:', referralCode);
    return generateErrorReply(event, '邀请码无效');
  }

  // Get participant user info
  const { data: inviterUser } = await supabase
    .from('users')
    .select('id, name, wechat_nickname')
    .eq('id', participant.user_id)
    .single();

  const inviterName = inviterUser?.wechat_nickname || inviterUser?.name || '好友';

  // Check if scanner is the participant themselves
  if (participant.user_id === userId) {
    // User scanned their own QR code - show their progress
    const mpLink = `pages/campaign/index?id=${campaignId}&from=oa`;
    
    return `<xml>
      <ToUserName><![CDATA[${openid}]]></ToUserName>
      <FromUserName><![CDATA[${event.ToUserName}]]></FromUserName>
      <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[📊 这是您自己的活动二维码\n\n当前进度：${participant.helper_count} 人已助力\n\n分享给好友，让他们扫码为您助力！\n\n小程序链接：${mpLink}]]></Content>
    </xml>`;
  }

  // Record the help action (for already following users)
  const helpResult = await recordHelper(
    campaignId,
    participant.id,
    openid,
    userInfo.unionid,
    userId
  );

  console.log('Help Result:', helpResult);

  // Log detailed event
  await logEvent({
    event_type: 'campaign_help',
    user_id: userId,
    related_user_id: participant.user_id,
    event_data: {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      participant_id: participant.id,
      referral_code: referralCode,
      helper_openid: openid,
      helper_unionid: userInfo.unionid,
      scan_type: 'SCAN', // Already following
      is_new_help: helpResult.isNew,
      help_success: helpResult.success,
      help_message: helpResult.message,
      new_helper_count: helpResult.helperCount,
      scene_str: sceneStr,
    },
  });

  // Generate response message
  let message = '';
  
  if (helpResult.success && helpResult.isNew) {
    message = `🎉 助力成功！\n\n`;
    message += `您已成功为 ${inviterName} 助力！\n`;
    message += `当前进度：${helpResult.helperCount} 人\n\n`;
  } else {
    message = `⚠️ ${helpResult.message}\n\n`;
    message += `您已经为 ${inviterName} 助力过了。\n\n`;
  }

  message += `━━━━━━━━━━━━━━\n`;
  message += `🎁 活动：${campaign.name}\n\n`;
  message += `👉 您也可以参与活动，邀请好友为您助力！`;

  // Generate Mini Program link
  const mpLink = `pages/campaign/index?id=${campaignId}&from=oa`;

  // Return XML reply
  return `<xml>
    <ToUserName><![CDATA[${openid}]]></ToUserName>
    <FromUserName><![CDATA[${event.ToUserName}]]></FromUserName>
    <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
    <MsgType><![CDATA[text]]></MsgType>
    <Content><![CDATA[${message}\n\n小程序链接：${mpLink}]]></Content>
  </xml>`;
}
