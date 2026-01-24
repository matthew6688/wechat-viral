/**
 * WeChat Official Account Customer Service Message Service
 * 
 * Sends customer service messages to users who have interacted with the OA
 * within the last 48 hours.
 * 
 * Message Types:
 * 1. Rule Message - Sent when user first joins campaign
 * 2. Message to Sharer - Sent to sharer when someone helps
 * 3. Message to Helper (Helper Success) - Sent to helper after successful help
 * 4. Duplicate Help Message - Sent when user tries to help again
 * 5. Campaign Ended Message - Sent when campaign has ended
 */

import axios from 'axios';
import { OA_API } from '../config/wechat';
import { getOAAccessToken, clearAccessTokenCache } from './oa-qrcode';

// Message context for template processing
export interface MessageContext {
  helper_count: number;
  max_helpers: number;
  remaining: number;
  helper_name: string;
  sharer_name: string;
  campaign_name: string;
  reward_name?: string;
  user_name?: string;  // For rule message
}

// Default message templates
export const DEFAULT_MESSAGE_TO_SHARER = `🎉 好消息！

有人刚刚为你助力了！

📊 当前进度：{{helper_count}}/{{max_helpers}} 人
🎁 还差 {{remaining}} 人即可领取奖励

继续分享给更多好友吧！`;

export const DEFAULT_MESSAGE_TO_HELPER = `✅ 助力成功！

你已成功帮助 {{sharer_name}} 完成助力任务。

感谢你的支持！🙏`;

export const DEFAULT_RULE_MESSAGE = `🎁 欢迎参与「{{campaign_name}}」！

📋 活动规则：
1️⃣ 生成你的专属海报
2️⃣ 分享给好友，邀请他们扫码关注
3️⃣ 每位好友关注后，为你助力+1
4️⃣ 达到指定人数，即可领取对应奖励

👉 点击下方链接进入小程序，开始邀请吧！`;

export const DEFAULT_DUPLICATE_HELP_MESSAGE = `⚠️ 你已经为 {{sharer_name}} 助力过了

每位用户只能为同一位好友助力一次哦~

💡 你也可以参与活动，邀请好友为你助力！`;

export const DEFAULT_CAMPAIGN_ENDED_MESSAGE = `📢 活动已结束

「{{campaign_name}}」活动已于 {{end_date}} 结束。

感谢你的参与！关注我们，获取更多精彩活动～`;

/**
 * Process message template by replacing placeholders with actual values
 * 
 * Supported placeholders:
 * - {{helper_count}} - Current helper count
 * - {{max_helpers}} - Maximum helpers needed for highest tier
 * - {{remaining}} - Remaining helpers needed
 * - {{helper_name}} - Name of the person who helped
 * - {{sharer_name}} - Name of the person being helped
 * - {{campaign_name}} - Campaign name
 * - {{reward_name}} - Reward name
 * - {{user_name}} - Current user's name
 * - {{end_date}} - Campaign end date (for ended message)
 */
export function processMessageTemplate(
  template: string, 
  context: MessageContext & { end_date?: string }
): string {
  return template
    .replace(/\{\{helper_count\}\}/g, String(context.helper_count || 0))
    .replace(/\{\{max_helpers\}\}/g, String(context.max_helpers || 8))
    .replace(/\{\{remaining\}\}/g, String(Math.max(0, (context.max_helpers || 8) - (context.helper_count || 0))))
    .replace(/\{\{helper_name\}\}/g, context.helper_name || '微信用户')
    .replace(/\{\{sharer_name\}\}/g, context.sharer_name || '好友')
    .replace(/\{\{campaign_name\}\}/g, context.campaign_name || '活动')
    .replace(/\{\{reward_name\}\}/g, context.reward_name || '奖励')
    .replace(/\{\{user_name\}\}/g, context.user_name || '微信用户')
    .replace(/\{\{end_date\}\}/g, context.end_date || '');
}

/**
 * Send a customer service text message to a user
 * 
 * @param openid - User's OpenID (OA OpenID)
 * @param content - Message content
 * @param retryCount - Internal retry counter for token refresh
 * @returns Success status and any error message
 */
export async function sendCustomerServiceMessage(
  openid: string,
  content: string,
  retryCount: number = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getOAAccessToken();
    
    const response = await axios.post(
      `${OA_API.sendMessage}?access_token=${accessToken}`,
      {
        touser: openid,
        msgtype: 'text',
        text: {
          content: content,
        },
      }
    );

    // Handle token expiry error - retry with fresh token
    if ((response.data.errcode === 40001 || response.data.errcode === 42001) && retryCount < 2) {
      console.log('[OA Message] Token error, refreshing and retrying...');
      clearAccessTokenCache();
      await getOAAccessToken(true); // Force refresh
      return sendCustomerServiceMessage(openid, content, retryCount + 1);
    }

    if (response.data.errcode === 0) {
      console.log(`[OA Message] Sent to ${openid.slice(0, 10)}...`);
      return { success: true };
    } else {
      console.error(`[OA Message] Failed to send to ${openid}:`, response.data);
      return { 
        success: false, 
        error: `WeChat API error: ${response.data.errcode} - ${response.data.errmsg}` 
      };
    }
  } catch (error: any) {
    console.error('[OA Message] Error sending message:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Campaign with all message templates
 */
export interface CampaignWithMessages {
  id: string;
  name: string;
  messages_enabled?: boolean;
  message_to_sharer?: string;
  message_to_helper?: string;
  msg_rule?: string;
  msg_helper_success?: string;
  msg_duplicate_help?: string;
  msg_campaign_ended?: string;
  msg_campaign_ended_image_url?: string;
  end_time?: string;
}

/**
 * Send notification messages when a helper helps a participant
 * 
 * @param campaign - Campaign data with message templates
 * @param sharerOpenId - OA OpenID of the person being helped
 * @param helperOpenId - OA OpenID of the person who helped
 * @param context - Message context with counts and names
 */
export async function sendHelpNotifications(
  campaign: CampaignWithMessages,
  sharerOpenId: string | null,
  helperOpenId: string,
  context: MessageContext
): Promise<{
  sharerMessageSent: boolean;
  helperMessageSent: boolean;
  errors: string[];
}> {
  const result = {
    sharerMessageSent: false,
    helperMessageSent: false,
    errors: [] as string[],
  };

  // Check if messages are enabled for this campaign
  if (campaign.messages_enabled === false) {
    console.log(`[OA Message] Messages disabled for campaign ${campaign.id}`);
    return result;
  }

  // Send message to sharer (participant)
  if (sharerOpenId) {
    const sharerTemplate = campaign.message_to_sharer || DEFAULT_MESSAGE_TO_SHARER;
    const sharerMessage = processMessageTemplate(sharerTemplate, context);
    
    const sharerResult = await sendCustomerServiceMessage(sharerOpenId, sharerMessage);
    result.sharerMessageSent = sharerResult.success;
    if (!sharerResult.success && sharerResult.error) {
      result.errors.push(`Sharer: ${sharerResult.error}`);
    }
  } else {
    console.log('[OA Message] Sharer has no OA OpenID, skipping message');
  }

  // Send message to helper (use msg_helper_success or message_to_helper)
  if (helperOpenId) {
    const helperTemplate = campaign.msg_helper_success || campaign.message_to_helper || DEFAULT_MESSAGE_TO_HELPER;
    const helperMessage = processMessageTemplate(helperTemplate, context);
    
    const helperResult = await sendCustomerServiceMessage(helperOpenId, helperMessage);
    result.helperMessageSent = helperResult.success;
    if (!helperResult.success && helperResult.error) {
      result.errors.push(`Helper: ${helperResult.error}`);
    }
  }

  console.log(`[OA Message] Notifications sent - Sharer: ${result.sharerMessageSent}, Helper: ${result.helperMessageSent}`);
  
  return result;
}

/**
 * Send rule message when user first joins a campaign
 * 
 * @param campaign - Campaign data
 * @param userOpenId - OA OpenID of the user
 * @param context - Message context
 */
export async function sendRuleMessage(
  campaign: CampaignWithMessages,
  userOpenId: string,
  context: MessageContext
): Promise<{ success: boolean; error?: string }> {
  // Check if messages are enabled
  if (campaign.messages_enabled === false) {
    console.log(`[OA Message] Messages disabled for campaign ${campaign.id}`);
    return { success: false, error: 'Messages disabled' };
  }

  const template = campaign.msg_rule || DEFAULT_RULE_MESSAGE;
  const message = processMessageTemplate(template, context);
  
  const result = await sendCustomerServiceMessage(userOpenId, message);
  console.log(`[OA Message] Rule message sent to ${userOpenId.slice(0, 10)}...: ${result.success}`);
  
  return result;
}

/**
 * Send duplicate help message when user tries to help the same person again
 * 
 * @param campaign - Campaign data
 * @param helperOpenId - OA OpenID of the helper
 * @param context - Message context
 */
export async function sendDuplicateHelpMessage(
  campaign: CampaignWithMessages,
  helperOpenId: string,
  context: MessageContext
): Promise<{ success: boolean; error?: string }> {
  // Check if messages are enabled
  if (campaign.messages_enabled === false) {
    console.log(`[OA Message] Messages disabled for campaign ${campaign.id}`);
    return { success: false, error: 'Messages disabled' };
  }

  const template = campaign.msg_duplicate_help || DEFAULT_DUPLICATE_HELP_MESSAGE;
  const message = processMessageTemplate(template, context);
  
  const result = await sendCustomerServiceMessage(helperOpenId, message);
  console.log(`[OA Message] Duplicate help message sent to ${helperOpenId.slice(0, 10)}...: ${result.success}`);
  
  return result;
}

/**
 * Send campaign ended message
 * 
 * @param campaign - Campaign data
 * @param userOpenId - OA OpenID of the user
 * @param context - Message context
 */
export async function sendCampaignEndedMessage(
  campaign: CampaignWithMessages,
  userOpenId: string,
  context: MessageContext & { end_date?: string }
): Promise<{ success: boolean; error?: string }> {
  // Check if messages are enabled
  if (campaign.messages_enabled === false) {
    console.log(`[OA Message] Messages disabled for campaign ${campaign.id}`);
    return { success: false, error: 'Messages disabled' };
  }

  // Add end date to context if not already present
  if (!context.end_date && campaign.end_time) {
    const endDate = new Date(campaign.end_time);
    context.end_date = endDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const template = campaign.msg_campaign_ended || DEFAULT_CAMPAIGN_ENDED_MESSAGE;
  const message = processMessageTemplate(template, context);
  
  const result = await sendCustomerServiceMessage(userOpenId, message);
  console.log(`[OA Message] Campaign ended message sent to ${userOpenId.slice(0, 10)}...: ${result.success}`);
  
  return result;
}

/**
 * Check if a campaign has ended
 */
export function isCampaignEnded(campaign: CampaignWithMessages): boolean {
  if (!campaign.end_time) return false;
  return new Date(campaign.end_time) < new Date();
}
