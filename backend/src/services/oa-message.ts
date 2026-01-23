/**
 * WeChat Official Account Customer Service Message Service
 * 
 * Sends customer service messages to users who have interacted with the OA
 * within the last 48 hours.
 */

import axios from 'axios';
import { OA_API } from '../config/wechat';
import { getOAAccessToken } from './oa-qrcode';

// Message context for template processing
export interface MessageContext {
  helper_count: number;
  max_helpers: number;
  remaining: number;
  helper_name: string;
  sharer_name: string;
  campaign_name: string;
  reward_name?: string;
}

// Default message templates
export const DEFAULT_MESSAGE_TO_SHARER = `🎉 好消息！

有人刚刚为你助力了！

📊 当前进度：{{helper_count}}/{{max_helpers}} 人
🎁 还差 {{remaining}} 人即可领取奖励

继续分享给更多好友吧！`;

export const DEFAULT_MESSAGE_TO_HELPER = `✅ 助力成功！

你已成功帮助好友完成助力任务。

感谢你的支持！🙏`;

/**
 * Process message template by replacing placeholders with actual values
 */
export function processMessageTemplate(template: string, context: MessageContext): string {
  return template
    .replace(/\{\{helper_count\}\}/g, String(context.helper_count))
    .replace(/\{\{max_helpers\}\}/g, String(context.max_helpers))
    .replace(/\{\{remaining\}\}/g, String(Math.max(0, context.max_helpers - context.helper_count)))
    .replace(/\{\{helper_name\}\}/g, context.helper_name || '微信用户')
    .replace(/\{\{sharer_name\}\}/g, context.sharer_name || '好友')
    .replace(/\{\{campaign_name\}\}/g, context.campaign_name || '活动')
    .replace(/\{\{reward_name\}\}/g, context.reward_name || '奖励');
}

/**
 * Send a customer service text message to a user
 * 
 * @param openid - User's OpenID (OA OpenID)
 * @param content - Message content
 * @returns Success status and any error message
 */
export async function sendCustomerServiceMessage(
  openid: string,
  content: string
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
 * Send notification messages when a helper helps a participant
 * 
 * @param campaign - Campaign data with message templates
 * @param sharerOpenId - OA OpenID of the person being helped
 * @param helperOpenId - OA OpenID of the person who helped
 * @param context - Message context with counts and names
 */
export async function sendHelpNotifications(
  campaign: {
    id: string;
    name: string;
    messages_enabled?: boolean;
    message_to_sharer?: string;
    message_to_helper?: string;
  },
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

  // Send message to helper
  if (helperOpenId) {
    const helperTemplate = campaign.message_to_helper || DEFAULT_MESSAGE_TO_HELPER;
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
