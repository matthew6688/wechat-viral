import { supabase } from '../config/supabase';
import { logEvent } from './event-logger';
import { handleScanEvent, handleSubscribeEvent, handleUnsubscribeEvent } from './oa-events';

export interface TestWebhookResult {
  success: boolean;
  message: string;
  event_data: any;
  error?: string;
}

/**
 * Generate mock user data for testing
 */
function generateMockUser() {
  const mockUsers = [
    { name: 'Test User 1', phone: '13800138001' },
    { name: 'Test User 2', phone: '13800138002' },
    { name: 'Test User 3', phone: '13800138003' },
  ];
  return mockUsers[Math.floor(Math.random() * mockUsers.length)];
}

/**
 * Generate mock referral code
 */
function generateMockReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Test trigger: Simulate QR code scan event
 */
export async function triggerTestScanEvent(): Promise<TestWebhookResult> {
  try {
    const mockCode = generateMockReferralCode();
    const sceneStr = `ref_${mockCode}`;
    
    const mockEvent = {
      ToUserName: 'gh_test',
      FromUserName: 'test_openid_' + Date.now(),
      CreateTime: Math.floor(Date.now() / 1000),
      MsgType: 'event',
      Event: 'SCAN',
      EventKey: sceneStr,
      Ticket: 'test_ticket_' + Date.now(),
    };

    // Log test event
    await logEvent({
      event_type: 'scan_qr',
      event_data: {
        scene_str: sceneStr,
        referral_code: mockCode,
        is_test: true,
      },
      source: 'test_webhook',
      is_test: true,
    });

    // Trigger actual scan event handler
    await handleScanEvent(mockEvent);

    return {
      success: true,
      message: `Test scan event triggered: ${sceneStr}`,
      event_data: {
        scene_str: sceneStr,
        referral_code: mockCode,
        event_type: 'scan_qr',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to trigger test scan event',
      event_data: {},
      error: error.message,
    };
  }
}

/**
 * Test trigger: Simulate OA follow event
 */
export async function triggerTestFollowEvent(): Promise<TestWebhookResult> {
  try {
    const mockOpenId = 'test_openid_follow_' + Date.now();
    const mockCode = generateMockReferralCode();
    const sceneStr = `ref_${mockCode}`;
    
    const mockEvent = {
      ToUserName: 'gh_test',
      FromUserName: mockOpenId,
      CreateTime: Math.floor(Date.now() / 1000),
      MsgType: 'event',
      Event: 'subscribe',
      EventKey: sceneStr,
      Ticket: 'test_ticket_' + Date.now(),
    };

    // Log test event
    await logEvent({
      event_type: 'follow_oa',
      event_data: {
        scene_str: sceneStr,
        referral_code: mockCode,
        is_test: true,
      },
      source: 'test_webhook',
      is_test: true,
    });

    // Trigger actual follow event handler
    await handleSubscribeEvent(mockEvent);

    return {
      success: true,
      message: `Test follow event triggered: ${sceneStr}`,
      event_data: {
        scene_str: sceneStr,
        referral_code: mockCode,
        event_type: 'follow_oa',
        openid: mockOpenId,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to trigger test follow event',
      event_data: {},
      error: error.message,
    };
  }
}

/**
 * Test trigger: Simulate OA unfollow event
 */
export async function triggerTestUnfollowEvent(): Promise<TestWebhookResult> {
  try {
    const mockOpenId = 'test_openid_unfollow_' + Date.now();
    
    const mockEvent = {
      ToUserName: 'gh_test',
      FromUserName: mockOpenId,
      CreateTime: Math.floor(Date.now() / 1000),
      MsgType: 'event',
      Event: 'unsubscribe',
    };

    // Log test event
    await logEvent({
      event_type: 'unfollow_oa',
      event_data: {
        is_test: true,
      },
      source: 'test_webhook',
      is_test: true,
    });

    // Trigger actual unfollow event handler
    await handleUnsubscribeEvent(mockEvent);

    return {
      success: true,
      message: 'Test unfollow event triggered',
      event_data: {
        event_type: 'unfollow_oa',
        openid: mockOpenId,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to trigger test unfollow event',
      event_data: {},
      error: error.message,
    };
  }
}

/**
 * Test trigger: Simulate user login event
 */
export async function triggerTestLoginEvent(): Promise<TestWebhookResult> {
  try {
    // Get a random user or create test user
    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone')
      .limit(10);

    const testUser = users && users.length > 0 
      ? users[Math.floor(Math.random() * users.length)]
      : generateMockUser();

    // Log test event
    await logEvent({
      event_type: 'login',
      user_id: (testUser as any).id,
      event_data: {
        is_test: true,
        source: 'miniprogram',
      },
      source: 'test_webhook',
      is_test: true,
    });

    return {
      success: true,
      message: 'Test login event triggered',
      event_data: {
        event_type: 'login',
        user: testUser,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to trigger test login event',
      event_data: {},
      error: error.message,
    };
  }
}

/**
 * Test trigger: Simulate user registration event
 */
export async function triggerTestRegisterEvent(): Promise<TestWebhookResult> {
  try {
    const mockUser = generateMockUser();
    const mockCode = generateMockReferralCode();
    
    // Log test event
    await logEvent({
      event_type: 'register',
      event_data: {
        name: mockUser.name,
        phone: mockUser.phone,
        referral_code: mockCode,
        is_test: true,
      },
      source: 'test_webhook',
      is_test: true,
    });

    return {
      success: true,
      message: 'Test register event triggered',
      event_data: {
        event_type: 'register',
        user: mockUser,
        referral_code: mockCode,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to trigger test register event',
      event_data: {},
      error: error.message,
    };
  }
}
