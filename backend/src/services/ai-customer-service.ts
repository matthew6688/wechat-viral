/**
 * AI Customer Service via n8n Webhook
 * 
 * This service handles:
 * 1. Forwarding user messages to n8n webhook for AI processing
 * 2. Receiving AI-generated replies
 * 3. Detecting when to transfer to human customer service
 * 4. Managing configuration from database
 */

import axios from 'axios';
import { supabase } from '../config/supabase';
import { logEvent } from './event-logger';

// Configuration interface
export interface AICustomerServiceConfig {
  id: string;
  enabled: boolean;
  n8n_webhook_url: string | null;
  timeout_ms: number;
  transfer_keywords: string[];
  fallback_message: string;
  transfer_message: string;
}

// Request payload to n8n
export interface N8nWebhookRequest {
  openid: string;
  message: string;
  message_type: 'text' | 'image' | 'voice' | 'video';
  timestamp: number;
  user_info: {
    nickname?: string;
    avatar_url?: string;
    user_id?: string;
  };
  // Callback URL for n8n to send the response back
  callback_url: string;
  // Unique request ID for tracking
  request_id: string;
}

// Response from n8n (via callback)
export interface N8nWebhookResponse {
  reply: string;
  transfer_to_human: boolean;
  metadata?: Record<string, any>;
}

// Callback payload that n8n sends back to us
export interface N8nCallbackPayload {
  request_id: string;
  openid: string;
  reply: string;
  transfer_to_human: boolean;
  metadata?: Record<string, any>;
}

// Cache for config to avoid frequent DB calls
let configCache: AICustomerServiceConfig | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Get AI customer service configuration
 * Uses caching to reduce database calls
 */
export async function getAICustomerServiceConfig(): Promise<AICustomerServiceConfig | null> {
  const now = Date.now();
  
  // Return cached config if still valid
  if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return configCache;
  }
  
  try {
    const { data, error } = await supabase
      .from('ai_customer_service_config')
      .select('*')
      .single();
    
    if (error) {
      console.error('[AI CS] Failed to get config:', error);
      return null;
    }
    
    configCache = data as AICustomerServiceConfig;
    configCacheTime = now;
    
    return configCache;
  } catch (error) {
    console.error('[AI CS] Error getting config:', error);
    return null;
  }
}

/**
 * Clear the config cache (call after config update)
 */
export function clearAIConfigCache(): void {
  configCache = null;
  configCacheTime = 0;
}

/**
 * Update AI customer service configuration
 */
export async function updateAICustomerServiceConfig(
  updates: Partial<AICustomerServiceConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('ai_customer_service_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');
    
    if (error) {
      console.error('[AI CS] Failed to update config:', error);
      return { success: false, error: error.message };
    }
    
    // Clear cache to force reload
    clearAIConfigCache();
    
    return { success: true };
  } catch (error: any) {
    console.error('[AI CS] Error updating config:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if message contains transfer keywords
 */
export function containsTransferKeyword(
  message: string,
  keywords: string[]
): boolean {
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

/**
 * Send message to n8n webhook (fire and forget)
 * n8n will call our callback URL with the response
 * 
 * @param request - The request payload (includes callback_url)
 * @param config - AI customer service config
 * @returns true if request was sent successfully
 */
export async function sendToN8nWebhook(
  request: N8nWebhookRequest,
  config: AICustomerServiceConfig
): Promise<boolean> {
  if (!config.n8n_webhook_url) {
    console.error('[AI CS] No webhook URL configured');
    return false;
  }
  
  const startTime = Date.now();
  
  try {
    console.log('[AI CS] Sending to n8n webhook (fire & forget):', {
      url: config.n8n_webhook_url.slice(0, 50) + '...',
      openid: request.openid.slice(0, 10) + '...',
      message_length: request.message.length,
      request_id: request.request_id,
      callback_url: request.callback_url,
    });
    
    // Fire and forget - we don't wait for a meaningful response
    // n8n Webhook node should be set to "Immediately" response
    // n8n will process and call our callback_url with the result
    axios.post(
      config.n8n_webhook_url,
      request,
      {
        timeout: 5000, // Short timeout - just need to know n8n received it
        headers: {
          'Content-Type': 'application/json',
        },
      }
    ).then(response => {
      const duration = Date.now() - startTime;
      console.log('[AI CS] n8n acknowledged request:', {
        request_id: request.request_id,
        duration_ms: duration,
        status: response.status,
      });
      
      // Log the event
      logEvent({
        event_type: 'ai_cs_webhook_sent',
        event_data: {
          openid: request.openid,
          request_id: request.request_id,
          message_length: request.message.length,
          duration_ms: duration,
          success: true,
        },
      });
    }).catch(error => {
      const duration = Date.now() - startTime;
      console.error('[AI CS] n8n request error (will still try callback):', {
        request_id: request.request_id,
        message: error.message,
        code: error.code,
        duration_ms: duration,
      });
      
      // Log the error
      logEvent({
        event_type: 'ai_cs_webhook_error',
        event_data: {
          openid: request.openid,
          request_id: request.request_id,
          error: error.message,
          code: error.code,
          duration_ms: duration,
        },
      });
    });
    
    // Return immediately - don't wait for n8n response
    return true;
  } catch (error: any) {
    console.error('[AI CS] Failed to send to n8n:', error.message);
    return false;
  }
}

/**
 * Send user message to n8n for AI processing (fire and forget)
 * n8n will call our callback URL with the response
 * 
 * @param openid - User's OpenID
 * @param message - Message content
 * @param messageType - Type of message
 * @param userInfo - Optional user information
 * @param callbackUrl - URL for n8n to send the response back
 * @returns Result indicating if message was sent or if handled locally
 */
export async function sendUserMessageToAI(
  openid: string,
  message: string,
  messageType: 'text' | 'image' | 'voice' | 'video' = 'text',
  userInfo?: { nickname?: string; avatar_url?: string; user_id?: string },
  callbackUrl?: string
): Promise<{
  sent: boolean;
  handled_locally: boolean;
  local_reply?: string;
  transfer_to_human?: boolean;
  error?: string;
}> {
  // Get config
  const config = await getAICustomerServiceConfig();
  
  if (!config || !config.enabled) {
    return {
      sent: false,
      handled_locally: false,
      error: 'AI customer service is not enabled',
    };
  }
  
  // Check for transfer keywords first (backup mechanism - handle locally)
  if (containsTransferKeyword(message, config.transfer_keywords)) {
    console.log('[AI CS] Transfer keyword detected:', message.slice(0, 50));
    return {
      sent: false,
      handled_locally: true,
      local_reply: config.transfer_message,
      transfer_to_human: true,
    };
  }
  
  // Generate unique request ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  // Build request with callback URL
  const request: N8nWebhookRequest = {
    openid,
    message,
    message_type: messageType,
    timestamp: Math.floor(Date.now() / 1000),
    user_info: userInfo || {},
    callback_url: callbackUrl || '',
    request_id: requestId,
  };
  
  // Send to n8n (fire and forget)
  const sent = await sendToN8nWebhook(request, config);
  
  if (!sent) {
    // Failed to send, return fallback
    console.log('[AI CS] Failed to send to n8n, using fallback');
    return {
      sent: false,
      handled_locally: true,
      local_reply: config.fallback_message,
      transfer_to_human: false,
    };
  }
  
  // Message sent successfully - n8n will call back with the response
  return {
    sent: true,
    handled_locally: false,
  };
}

/**
 * @deprecated Use sendUserMessageToAI instead
 * Process a user message with AI customer service (legacy sync version)
 */
export async function processUserMessage(
  openid: string,
  message: string,
  messageType: 'text' | 'image' | 'voice' | 'video' = 'text',
  userInfo?: { nickname?: string; avatar_url?: string; user_id?: string }
): Promise<{
  reply: string | null;
  transfer_to_human: boolean;
  error?: string;
}> {
  // This is a legacy function - just return fallback for now
  const config = await getAICustomerServiceConfig();
  
  if (!config || !config.enabled) {
    return {
      reply: null,
      transfer_to_human: false,
      error: 'AI customer service is not enabled',
    };
  }
  
  // Check for transfer keywords
  if (containsTransferKeyword(message, config.transfer_keywords)) {
    return {
      reply: config.transfer_message,
      transfer_to_human: true,
    };
  }
  
  // Return fallback - actual AI processing happens via callback now
  return {
    reply: config.fallback_message,
    transfer_to_human: false,
  };
}

/**
 * Process callback from n8n with AI response
 * This is called by n8n via HTTP Request node
 */
export async function processN8nCallback(
  payload: N8nCallbackPayload
): Promise<{ success: boolean; error?: string }> {
  const { sendCustomerServiceMessage } = await import('./oa-message');
  
  try {
    console.log('[AI CS] Processing n8n callback:', {
      request_id: payload.request_id,
      openid: payload.openid.slice(0, 10) + '...',
      has_reply: !!payload.reply,
      transfer_to_human: payload.transfer_to_human,
    });
    
    const config = await getAICustomerServiceConfig();
    
    if (payload.transfer_to_human) {
      // Send transfer message
      const message = config?.transfer_message || '您好，已为您转接人工客服，请稍候。';
      await sendCustomerServiceMessage(payload.openid, message);
      console.log('[AI CS] Transfer message sent');
      
      // Log event
      await logEvent({
        event_type: 'ai_cs_transfer_to_human',
        event_data: {
          openid: payload.openid,
          request_id: payload.request_id,
        },
      });
    } else if (payload.reply) {
      // Send AI reply
      await sendCustomerServiceMessage(payload.openid, payload.reply);
      console.log('[AI CS] AI reply sent via callback');
      
      // Log event
      await logEvent({
        event_type: 'ai_cs_reply_sent',
        event_data: {
          openid: payload.openid,
          request_id: payload.request_id,
          reply_length: payload.reply.length,
        },
      });
    } else {
      console.warn('[AI CS] Callback received but no reply or transfer');
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[AI CS] Callback processing error:', error);
    
    // Try to send fallback message
    try {
      const config = await getAICustomerServiceConfig();
      const fallback = config?.fallback_message || '抱歉，系统繁忙，请稍后再试。';
      await sendCustomerServiceMessage(payload.openid, fallback);
    } catch (sendErr) {
      console.error('[AI CS] Failed to send fallback in callback:', sendErr);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Generate transfer to customer service XML response
 * This triggers WeChat to transfer the user to human customer service
 */
export function generateTransferCustomerServiceXML(
  toUser: string,
  fromUser: string
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  
  return `<xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${timestamp}</CreateTime>
  <MsgType><![CDATA[transfer_customer_service]]></MsgType>
</xml>`;
}

/**
 * Test n8n webhook connectivity
 */
export async function testN8nWebhook(
  webhookUrl: string,
  timeoutMs: number = 5000
): Promise<{ success: boolean; message: string; duration_ms?: number }> {
  const startTime = Date.now();
  
  try {
    const testRequest: N8nWebhookRequest = {
      openid: 'test_openid_12345',
      message: '这是一条测试消息',
      message_type: 'text',
      timestamp: Math.floor(Date.now() / 1000),
      user_info: {
        nickname: '测试用户',
      },
      callback_url: 'https://example.com/api/oa/ai-callback',
      request_id: `test_${Date.now()}`,
    };
    
    const response = await axios.post(webhookUrl, testRequest, {
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const duration = Date.now() - startTime;
    
    // Check if response has expected format
    if (response.data && typeof response.data === 'object') {
      const hasReply = 'reply' in response.data;
      const hasTransfer = 'transfer_to_human' in response.data;
      
      if (hasReply || hasTransfer) {
        return {
          success: true,
          message: `连接成功！响应时间: ${duration}ms`,
          duration_ms: duration,
        };
      } else {
        return {
          success: true,
          message: `连接成功，但响应格式可能不正确（缺少 reply 或 transfer_to_human 字段）。响应时间: ${duration}ms`,
          duration_ms: duration,
        };
      }
    }
    
    return {
      success: true,
      message: `连接成功，响应时间: ${duration}ms`,
      duration_ms: duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        message: `连接超时（${timeoutMs}ms）`,
        duration_ms: duration,
      };
    }
    
    if (error.response) {
      return {
        success: false,
        message: `HTTP ${error.response.status}: ${error.response.statusText}`,
        duration_ms: duration,
      };
    }
    
    return {
      success: false,
      message: error.message || '连接失败',
      duration_ms: duration,
    };
  }
}
