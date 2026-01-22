import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { supabase } from '../config/supabase';

const router = express.Router();

// SSE endpoint needs special handling (before middleware)
// EventSource doesn't support custom headers, so we handle auth manually
router.get('/debug/logs/stream', async (req, res) => {
  try {
    // Get token from query param (EventSource limitation)
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token manually
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const userId = decoded.userId;

      // Check if user is admin
      const { data: user, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', userId)
        .single();

      if (error || !user || !user.is_admin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // Authentication successful, proceed with SSE
      const { eventStreamManager } = require('../services/event-stream');
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      eventStreamManager.addClient(clientId, res);

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          res.write(`: heartbeat\n\n`);
        } catch (error) {
          clearInterval(heartbeatInterval);
          eventStreamManager.removeClient(clientId);
        }
      }, 30000); // Send heartbeat every 30 seconds

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(heartbeatInterval);
        eventStreamManager.removeClient(clientId);
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error: any) {
    console.error('SSE stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to establish event stream' });
    }
  }
});

// All other admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/debug/scan-events
 * Get scan events for debugging
 */
router.get('/debug/scan-events', async (req: AuthRequest, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const { data: events, error } = await supabase
      .from('oa_scan_events')
      .select(`
        *,
        inviter:users!oa_scan_events_inviter_user_id_fkey(id, name, phone)
      `)
      .order('scan_time', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) {
      throw error;
    }

    res.json({ events, total: events?.length || 0 });
  } catch (error: any) {
    console.error('Get scan events error:', error);
    res.status(500).json({ error: error.message || 'Failed to get scan events' });
  }
});

/**
 * GET /api/admin/debug/follow-events
 * Get follow events for debugging
 */
router.get('/debug/follow-events', async (req: AuthRequest, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const { data: events, error } = await supabase
      .from('oa_follow_events')
      .select(`
        *,
        inviter:users!oa_follow_events_inviter_user_id_fkey(id, name, phone)
      `)
      .order('follow_time', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) {
      throw error;
    }

    res.json({ events, total: events?.length || 0 });
  } catch (error: any) {
    console.error('Get follow events error:', error);
    res.status(500).json({ error: error.message || 'Failed to get follow events' });
  }
});

/**
 * GET /api/admin/debug/referral-chain
 * Get referral chain for a specific user
 */
router.get('/debug/referral-chain/:userId', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    // Get all invites where this user is the inviter
    const { data: invites, error: invitesError } = await supabase
      .from('invites')
      .select(`
        *,
        invitee:users!invites_invitee_user_id_fkey(id, name, phone, created_at)
      `)
      .eq('inviter_user_id', userId);

    if (invitesError) {
      throw invitesError;
    }

    // Get who invited this user
    const { data: inviterInfo, error: inviterError } = await supabase
      .from('invites')
      .select(`
        *,
        inviter:users!invites_inviter_user_id_fkey(id, name, phone, created_at)
      `)
      .eq('invitee_user_id', userId)
      .limit(1)
      .single();

    if (inviterError && inviterError.code !== 'PGRST116') {
      throw inviterError;
    }

    res.json({
      data: {
        inviter: inviterInfo || null,
        invitees: invites || [],
      },
    });
  } catch (error: any) {
    console.error('Get referral chain error:', error);
    res.status(500).json({ error: error.message || 'Failed to get referral chain' });
  }
});

/**
 * GET /api/admin/debug/stats
 * Get overall statistics (updated to use campaign_helpers as primary source)
 */
router.get('/debug/stats', async (req: AuthRequest, res) => {
  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Today's new users
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Total helpers (OA follows via campaign)
    const { count: totalHelpers } = await supabase
      .from('campaign_helpers')
      .select('*', { count: 'exact', head: true });

    // Valid helpers (still following)
    const { count: validHelpers } = await supabase
      .from('campaign_helpers')
      .select('*', { count: 'exact', head: true })
      .eq('is_valid', true);

    // Unfollows
    const { count: unfollows } = await supabase
      .from('campaign_helpers')
      .select('*', { count: 'exact', head: true })
      .eq('is_valid', false);

    // Campaign participants
    const { count: totalParticipants } = await supabase
      .from('campaign_participants')
      .select('*', { count: 'exact', head: true });

    // QR codes generated (from oa_qrcodes)
    const { count: qrGenerated } = await supabase
      .from('oa_qrcodes')
      .select('*', { count: 'exact', head: true });

    // Rewards claimed
    const { count: rewardsClaimed } = await supabase
      .from('campaign_reward_claims')
      .select('*', { count: 'exact', head: true });

    // Today's helpers
    const { count: todayHelpers } = await supabase
      .from('campaign_helpers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Calculate retention rate
    const retentionRate = totalHelpers && totalHelpers > 0 
      ? ((validHelpers || 0) / totalHelpers * 100).toFixed(1) 
      : '0.0';

    // Average helpers per participant
    const avgHelpersPerParticipant = totalParticipants && totalParticipants > 0
      ? ((totalHelpers || 0) / totalParticipants).toFixed(1)
      : '0.0';

    res.json({
      // Core metrics
      totalUsers: totalUsers || 0,
      todayUsers: todayUsers || 0,
      
      // Campaign metrics
      totalParticipants: totalParticipants || 0,
      totalHelpers: totalHelpers || 0,
      validHelpers: validHelpers || 0,
      unfollows: unfollows || 0,
      todayHelpers: todayHelpers || 0,
      
      // Engagement metrics
      qrGenerated: qrGenerated || 0,
      rewardsClaimed: rewardsClaimed || 0,
      
      // Calculated metrics
      retentionRate: retentionRate + '%',
      avgHelpersPerParticipant: avgHelpersPerParticipant,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

/**
 * GET /api/admin/debug/oa-events
 * Get all OA events (scan + follow) for debugging
 */
router.get('/debug/oa-events', async (req: AuthRequest, res) => {
  try {
    const { limit = 100 } = req.query;

    // Get scan events
    const { data: scanEvents, error: scanError } = await supabase
      .from('oa_scan_events')
      .select(`
        *,
        inviter:users!oa_scan_events_inviter_user_id_fkey(id, name, phone)
      `)
      .order('scan_time', { ascending: false })
      .limit(parseInt(limit as string));

    if (scanError) {
      console.error('Get scan events error:', scanError);
    }

    // Get follow events
    const { data: followEvents, error: followError } = await supabase
      .from('oa_follow_events')
      .select(`
        *,
        inviter:users!oa_follow_events_inviter_user_id_fkey(id, name, phone)
      `)
      .order('follow_time', { ascending: false })
      .limit(parseInt(limit as string));

    if (followError) {
      console.error('Get follow events error:', followError);
    }

    res.json({
      data: {
        scanEvents: scanEvents || [],
        followEvents: followEvents || [],
      },
    });
  } catch (error: any) {
    console.error('Get OA events error:', error);
    res.status(500).json({ error: error.message || 'Failed to get OA events' });
  }
});

/**
 * GET /api/admin/debug/all-events
 * Get all events from event_logs table (unified event log)
 */
router.get('/debug/all-events', async (req: AuthRequest, res) => {
  try {
    const { limit = 200, event_type } = req.query;

    let query = supabase
      .from('event_logs')
      .select(`
        *,
        user:users!event_logs_user_id_fkey(id, name, phone, openid, unionid),
        related_user:users!event_logs_related_user_id_fkey(id, name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    // Filter by event type if provided
    if (event_type) {
      query = query.eq('event_type', event_type as string);
    }

    const { data: events, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array with helpful message
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('event_logs table does not exist. Please run migration 007_create_event_logs.sql');
        return res.json({
          data: {
            events: [],
            total: 0,
            message: 'Event logs table not found. Please run migration 007_create_event_logs.sql',
          },
        });
      }
      throw error;
    }

    res.json({
      data: {
        events: events || [],
        total: events?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Get all events error:', error);
    res.status(500).json({ error: error.message || 'Failed to get all events' });
  }
});

/**
 * GET /api/admin/users
 * Get all users for selection
 */
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const { limit = 100 } = req.query;

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, phone, created_at, is_admin')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    res.json({ 
      data: {
        users: users || [],
      },
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message || 'Failed to get users' });
  }
});

/**
 * GET /api/admin/debug/invites
 * Get all invite relationships for debugging
 */
router.get('/debug/invites', async (req: AuthRequest, res) => {
  try {
    const { limit = 100 } = req.query;

    const { data: invites, error } = await supabase
      .from('invites')
      .select(`
        *,
        inviter:users!invites_inviter_user_id_fkey(id, name, phone),
        invitee:users!invites_invitee_user_id_fkey(id, name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    res.json({ 
      data: {
        invites: invites || [],
      },
    });
  } catch (error: any) {
    console.error('Get invites error:', error);
    res.status(500).json({ error: error.message || 'Failed to get invites' });
  }
});

/**
 * GET /api/admin/settings/activity
 * Get activity settings
 */
router.get('/settings/activity', async (req: AuthRequest, res) => {
  try {
    // Get activity settings
    const { data: activity, error } = await supabase
      .from('activities')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      activity: activity || null,
    });
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to get settings' });
  }
});

/**
 * PUT /api/admin/settings/activity
 * Update activity settings
 */
router.put('/settings/activity', async (req: AuthRequest, res) => {
  try {
    const activity = req.body;

    if (!activity) {
      return res.status(400).json({ error: 'Activity data is required' });
    }

    const { data: existing } = await supabase
      .from('activities')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('activities')
        .update(activity)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('activities')
        .insert(activity);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
});

/**
 * GET /api/admin/settings/debug/:key
 * Get a specific debug setting
 * NOTE: This must come BEFORE /settings/debug to avoid route conflicts
 */
router.get('/settings/debug/:key', async (req: AuthRequest, res) => {
  try {
    const { key } = req.params;
    const { getDebugSetting } = require('../services/debug-settings');
    const value = await getDebugSetting(key);

    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({
      data: {
        key,
        value,
      },
    });
  } catch (error: any) {
    console.error('Get debug setting error:', error);
    res.status(500).json({ error: error.message || 'Failed to get debug setting' });
  }
});

/**
 * GET /api/admin/settings/debug
 * Get debug settings
 */
router.get('/settings/debug', async (req: AuthRequest, res) => {
  try {
    const { getDebugSettings } = require('../services/debug-settings');
    const settings = await getDebugSettings();

    res.json({
      data: {
        settings,
      },
    });
  } catch (error: any) {
    console.error('Get debug settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to get debug settings' });
  }
});

/**
 * PUT /api/admin/settings/debug
 * Update debug settings
 */
router.put('/settings/debug', async (req: AuthRequest, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const { updateDebugSettings } = require('../services/debug-settings');
    await updateDebugSettings(settings, req.userId);

    res.json({
      success: true,
      message: 'Debug settings updated successfully',
    });
  } catch (error: any) {
    console.error('Update debug settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update debug settings' });
  }
});

/**
 * GET /api/admin/validate/environment
 * Comprehensive environment validation
 */
router.get('/validate/environment', async (req: AuthRequest, res) => {
  try {
    const { validateEnvironment } = require('../services/environment-validator');
    const report = await validateEnvironment();
    res.json({ data: report });
  } catch (error: any) {
    console.error('Environment validation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate environment' });
  }
});

/**
 * GET /api/admin/validate/wechat
 * WeChat API validation
 */
router.get('/validate/wechat', async (req: AuthRequest, res) => {
  try {
    const { validateWeChatMiniProgram, validateWeChatOfficialAccount } = require('../services/wechat-validator');
    const [mpResult, oaResult] = await Promise.all([
      validateWeChatMiniProgram(),
      validateWeChatOfficialAccount(),
    ]);
    res.json({
      data: {
        wechat_mp: mpResult,
        wechat_oa: oaResult,
      },
    });
  } catch (error: any) {
    console.error('WeChat validation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate WeChat APIs' });
  }
});

/**
 * GET /api/admin/validate/database
 * Database connection validation
 */
router.get('/validate/database', async (req: AuthRequest, res) => {
  try {
    const { validateDatabase } = require('../services/environment-validator');
    const result = await validateDatabase();
    res.json({ data: result });
  } catch (error: any) {
    console.error('Database validation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate database' });
  }
});

/**
 * GET /api/admin/validate/cloudflare
 * Cloudflare tunnel validation
 */
router.get('/validate/cloudflare', async (req: AuthRequest, res) => {
  try {
    const { getCloudflareTunnelInfo, getCloudflareTunnelUrlFromRequest } = require('../services/cloudflare-validator');
    
    // Try to get URL from request headers (runtime detection)
    const runtimeUrl = getCloudflareTunnelUrlFromRequest(req);
    
    // Get validation result
    const result = await getCloudflareTunnelInfo();
    
    // If we detected URL from headers, add it to the result
    if (runtimeUrl && !result.details?.url) {
      result.details = {
        ...result.details,
        runtimeUrl,
        note: 'URL detected from request headers',
      };
    }
    
    res.json({ data: result });
  } catch (error: any) {
    console.error('Cloudflare validation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate Cloudflare tunnel' });
  }
});

/**
 * GET /api/admin/validate/env-vars
 * Environment variables check
 */
router.get('/validate/env-vars', async (req: AuthRequest, res) => {
  try {
    const { checkEnvironmentVariables } = require('../services/environment-validator');
    const result = checkEnvironmentVariables();
    
    // Mask sensitive values
    const maskedVars: Record<string, string> = {};
    result.configured_vars.forEach((varName: string) => {
      const value = process.env[varName];
      if (value) {
        if (varName.includes('SECRET') || varName.includes('KEY') || varName.includes('TOKEN')) {
          // Show first 4 and last 4 characters
          maskedVars[varName] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          maskedVars[varName] = value;
        }
      }
    });
    
    res.json({
      data: {
        ...result,
        masked_values: maskedVars,
        node_env: process.env.NODE_ENV || 'development',
      },
    });
  } catch (error: any) {
    console.error('Environment variables check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check environment variables' });
  }
});


/**
 * POST /api/admin/test/trigger-scan
 * Simulate QR code scan event
 */
router.post('/test/trigger-scan', async (req: AuthRequest, res) => {
  try {
    const { triggerTestScanEvent } = require('../services/test-webhook');
    const result = await triggerTestScanEvent();
    res.json({ data: result });
  } catch (error: any) {
    console.error('Trigger test scan error:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger test scan event' });
  }
});

/**
 * POST /api/admin/test/trigger-follow
 * Simulate OA follow event
 */
router.post('/test/trigger-follow', async (req: AuthRequest, res) => {
  try {
    const { triggerTestFollowEvent } = require('../services/test-webhook');
    const result = await triggerTestFollowEvent();
    res.json({ data: result });
  } catch (error: any) {
    console.error('Trigger test follow error:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger test follow event' });
  }
});

/**
 * POST /api/admin/test/trigger-unfollow
 * Simulate OA unfollow event
 */
router.post('/test/trigger-unfollow', async (req: AuthRequest, res) => {
  try {
    const { triggerTestUnfollowEvent } = require('../services/test-webhook');
    const result = await triggerTestUnfollowEvent();
    res.json({ data: result });
  } catch (error: any) {
    console.error('Trigger test unfollow error:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger test unfollow event' });
  }
});

/**
 * POST /api/admin/test/trigger-login
 * Simulate user login event
 */
router.post('/test/trigger-login', async (req: AuthRequest, res) => {
  try {
    const { triggerTestLoginEvent } = require('../services/test-webhook');
    const result = await triggerTestLoginEvent();
    res.json({ data: result });
  } catch (error: any) {
    console.error('Trigger test login error:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger test login event' });
  }
});

/**
 * POST /api/admin/test/trigger-register
 * Simulate user registration event
 */
router.post('/test/trigger-register', async (req: AuthRequest, res) => {
  try {
    const { triggerTestRegisterEvent } = require('../services/test-webhook');
    const result = await triggerTestRegisterEvent();
    res.json({ data: result });
  } catch (error: any) {
    console.error('Trigger test register error:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger test register event' });
  }
});

/**
 * GET /api/admin/tunnel/status
 * Get current tunnel status
 */
router.get('/tunnel/status', async (req: AuthRequest, res) => {
  try {
    const { getTunnelStatus, getCloudflareTunnelUrlFromRequest, testTunnelConnection } = require('../services/cloudflare-validator');
    
    // Get stored status
    const storedStatus = await getTunnelStatus();
    
    // Try to detect from request headers
    const runtimeUrl = getCloudflareTunnelUrlFromRequest(req);
    
    // Prefer runtime URL if available, otherwise use stored
    const tunnelUrl = runtimeUrl || storedStatus.url;
    
    let accessible = false;
    if (tunnelUrl) {
      try {
        const testResult = await testTunnelConnection(tunnelUrl);
        accessible = testResult.accessible;
      } catch (e) {
        accessible = false;
      }
    }
    
    res.json({
      tunnelUrl,
      accessible,
      verified: storedStatus.verified,
      last_checked: storedStatus.last_checked,
      status: storedStatus.status,
      source: runtimeUrl ? 'runtime' : 'stored',
    });
  } catch (error: any) {
    console.error('Get tunnel status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tunnel status' });
  }
});

/**
 * POST /api/admin/tunnel/update-url
 * Update tunnel URL manually
 */
router.post('/tunnel/update-url', async (req: AuthRequest, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const { updateTunnelUrl, testTunnelConnection } = require('../services/cloudflare-validator');
    
    // Update URL
    await updateTunnelUrl(url, req.userId);
    
    // Test connection
    const testResult = await testTunnelConnection(url);
    
    res.json({
      data: {
        url,
        verified: testResult.accessible,
        test_result: testResult,
        message: testResult.accessible 
          ? 'Tunnel URL updated and verified' 
          : 'Tunnel URL updated but verification failed',
      },
    });
  } catch (error: any) {
    console.error('Update tunnel URL error:', error);
    res.status(500).json({ error: error.message || 'Failed to update tunnel URL' });
  }
});

/**
 * POST /api/admin/tunnel/test
 * Test tunnel connectivity
 */
router.post('/tunnel/test', async (req: AuthRequest, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const { testTunnelConnection } = require('../services/cloudflare-validator');
    const result = await testTunnelConnection(url);
    
    res.json({
      data: {
        accessible: result.accessible,
        latency: result.latency,
        httpsValid: result.httpsValid,
        error: result.error,
        message: result.accessible 
          ? 'Tunnel is accessible' 
          : `Tunnel test failed: ${result.error || 'Unknown error'}`,
      },
    });
  } catch (error: any) {
    console.error('Test tunnel error:', error);
    res.status(500).json({ error: error.message || 'Failed to test tunnel' });
  }
});

/**
 * POST /api/admin/tunnel/recheck
 * Re-check tunnel status
 */
router.post('/tunnel/recheck', async (req: AuthRequest, res) => {
  try {
    const { getStoredTunnelUrl, getCloudflareTunnelUrlFromRequest, testTunnelConnection } = require('../services/cloudflare-validator');
    
    // Get URL from stored or runtime
    const storedUrl = await getStoredTunnelUrl();
    const runtimeUrl = getCloudflareTunnelUrlFromRequest(req);
    const url = runtimeUrl || storedUrl;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'No tunnel URL found. Please update tunnel URL first.',
      });
    }
    
    // Test connection
    const testResult = await testTunnelConnection(url);
    
    res.json({
      data: {
        url,
        verified: testResult.accessible,
        latency: testResult.latency,
        httpsValid: testResult.httpsValid,
        error: testResult.error,
        last_checked: new Date().toISOString(),
        status: testResult.accessible ? 'connected' : 'disconnected',
        message: testResult.accessible 
          ? 'Tunnel is connected and accessible' 
          : `Tunnel check failed: ${testResult.error || 'Unknown error'}`,
      },
    });
  } catch (error: any) {
    console.error('Re-check tunnel error:', error);
    res.status(500).json({ error: error.message || 'Failed to re-check tunnel' });
  }
});

/**
 * POST /api/admin/tunnel/validate-local
 * Validate local tunnel setup (server, cloudflared, tunnel URL)
 */
router.post('/tunnel/validate-local', async (req: AuthRequest, res) => {
  try {
    const { validateLocalTunnel } = require('../services/cloudflare-validator');
    const result = await validateLocalTunnel();
    res.json({ data: result });
  } catch (error: any) {
    console.error('Validate local tunnel error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate local tunnel' });
  }
});

/**
 * GET /api/admin/env/oa-status
 * Get WeChat Official Account status
 */
router.get('/env/oa-status', async (req: AuthRequest, res) => {
  try {
    const OA_APPID = process.env.OA_APPID || '';
    const OA_SECRET = process.env.OA_SECRET || '';
    
    let hasAccessToken = false;
    let tokenError = null;
    
    // Try to get access token
    if (OA_APPID && OA_SECRET) {
      try {
        const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${OA_APPID}&secret=${OA_SECRET}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json() as any;
        
        if (tokenData.access_token) {
          hasAccessToken = true;
        } else {
          tokenError = tokenData.errmsg || 'Failed to get access token';
        }
      } catch (error: any) {
        tokenError = error.message;
      }
    }
    
    res.json({
      appId: OA_APPID ? `${OA_APPID.substring(0, 6)}...` : 'Not configured',
      hasAccessToken,
      tokenError,
      configured: !!(OA_APPID && OA_SECRET),
    });
  } catch (error: any) {
    console.error('Get OA status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get OA status' });
  }
});

/**
 * GET /api/admin/env/db-status
 * Get database connection status
 */
router.get('/env/db-status', async (req: AuthRequest, res) => {
  try {
    // Test database connection by counting tables
    const { data, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      throw error;
    }
    
    // Get table count
    const tables = [
      'users', 'invites', 'oa_qrcodes', 'oa_scan_events', 'oa_follow_events',
      'event_logs', 'campaigns', 'campaign_rewards', 'campaign_participants', 'campaign_helpers'
    ];
    
    let existingTables = 0;
    for (const table of tables) {
      try {
        const { error: tableError } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true });
        
        if (!tableError) {
          existingTables++;
        }
      } catch (e) {
        // Table doesn't exist
      }
    }
    
    res.json({
      connected: true,
      tableCount: existingTables,
      totalExpected: tables.length,
    });
  } catch (error: any) {
    console.error('Get DB status error:', error);
    res.json({
      connected: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/test-webhook
 * Test webhook endpoint accessibility
 */
router.post('/test-webhook', async (req: AuthRequest, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }
    
    // Test the webhook endpoint with a GET request (WeChat verification style)
    const testParams = new URLSearchParams({
      signature: 'test',
      timestamp: Date.now().toString(),
      nonce: 'test',
      echostr: 'test_echo'
    });
    
    const testUrl = `${webhookUrl}?${testParams.toString()}`;
    
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Admin-Dashboard-Test'
        }
      });
      
      const responseText = await response.text();
      
      res.json({
        success: response.ok || response.status === 200,
        status: response.status,
        statusText: response.statusText,
        response: responseText.substring(0, 200), // Limit response length
        message: response.ok 
          ? 'Webhook endpoint is accessible' 
          : `Webhook returned status ${response.status}`,
      });
    } catch (fetchError: any) {
      res.json({
        success: false,
        error: fetchError.message,
        message: 'Could not reach webhook endpoint. Check if tunnel is running.',
      });
    }
  } catch (error: any) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: error.message || 'Failed to test webhook' });
  }
});

/**
 * GET /api/admin/analytics/influencers
 * Get top influencers (users who brought the most helpers)
 */
router.get('/analytics/influencers', async (req: AuthRequest, res) => {
  try {
    const { limit = 20, campaign_id } = req.query;

    // Get participants with their helper counts
    let query = supabase
      .from('campaign_participants')
      .select(`
        id,
        user_id,
        campaign_id,
        referral_code,
        helper_count,
        total_helper_count,
        joined_at,
        user:users!campaign_participants_user_id_fkey(id, name, phone),
        campaign:campaigns!campaign_participants_campaign_id_fkey(id, name)
      `)
      .order('helper_count', { ascending: false })
      .limit(parseInt(limit as string));

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }

    const { data: participants, error } = await query;

    if (error) throw error;

    // Calculate additional metrics for each participant
    const influencers = await Promise.all((participants || []).map(async (p: any) => {
      // Get valid vs invalid helpers
      const { count: validHelpers } = await supabase
        .from('campaign_helpers')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', p.id)
        .eq('is_valid', true);

      const { count: invalidHelpers } = await supabase
        .from('campaign_helpers')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', p.id)
        .eq('is_valid', false);

      // Calculate retention rate
      const totalHelpers = (validHelpers || 0) + (invalidHelpers || 0);
      const retentionRate = totalHelpers > 0 
        ? ((validHelpers || 0) / totalHelpers * 100).toFixed(1) 
        : '100.0';

      return {
        id: p.id,
        user_id: p.user_id,
        user_name: p.user?.name || 'Unknown',
        user_phone: p.user?.phone || '',
        campaign_id: p.campaign_id,
        campaign_name: p.campaign?.name || 'Unknown',
        referral_code: p.referral_code,
        helper_count: p.helper_count || 0,
        valid_helpers: validHelpers || 0,
        invalid_helpers: invalidHelpers || 0,
        retention_rate: retentionRate + '%',
        joined_at: p.joined_at,
      };
    }));

    res.json({
      data: {
        influencers,
        total: influencers.length,
      },
    });
  } catch (error: any) {
    console.error('Get influencers error:', error);
    res.status(500).json({ error: error.message || 'Failed to get influencers' });
  }
});

/**
 * GET /api/admin/analytics/campaigns
 * Get campaign comparison analytics
 */
router.get('/analytics/campaigns', async (req: AuthRequest, res) => {
  try {
    // Get all campaigns with their stats
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, start_time, end_time, created_at')
      .order('created_at', { ascending: false });

    if (campaignsError) throw campaignsError;

    // Get stats for each campaign
    const campaignStats = await Promise.all((campaigns || []).map(async (campaign: any) => {
      // Participants count
      const { count: participants } = await supabase
        .from('campaign_participants')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      // Total helpers
      const { count: totalHelpers } = await supabase
        .from('campaign_helpers')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      // Valid helpers
      const { count: validHelpers } = await supabase
        .from('campaign_helpers')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('is_valid', true);

      // Rewards claimed
      const { count: rewardsClaimed } = await supabase
        .from('campaign_reward_claims')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      // QR codes generated
      const { count: qrGenerated } = await supabase
        .from('oa_qrcodes')
        .select('*', { count: 'exact', head: true })
        .like('scene_str', `camp_${campaign.id}%`);

      // Calculate metrics
      const avgHelpersPerParticipant = participants && participants > 0
        ? ((totalHelpers || 0) / participants).toFixed(1)
        : '0.0';

      const retentionRate = totalHelpers && totalHelpers > 0
        ? ((validHelpers || 0) / totalHelpers * 100).toFixed(1)
        : '0.0';

      const conversionRate = qrGenerated && qrGenerated > 0
        ? ((totalHelpers || 0) / qrGenerated * 100).toFixed(1)
        : '0.0';

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        start_time: campaign.start_time,
        end_time: campaign.end_time,
        participants: participants || 0,
        total_helpers: totalHelpers || 0,
        valid_helpers: validHelpers || 0,
        unfollows: (totalHelpers || 0) - (validHelpers || 0),
        rewards_claimed: rewardsClaimed || 0,
        qr_generated: qrGenerated || 0,
        avg_helpers_per_participant: avgHelpersPerParticipant,
        retention_rate: retentionRate + '%',
        conversion_rate: conversionRate + '%',
      };
    }));

    res.json({
      data: {
        campaigns: campaignStats,
        total: campaignStats.length,
      },
    });
  } catch (error: any) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get campaign analytics' });
  }
});

/**
 * GET /api/admin/analytics/source
 * Get source channel breakdown
 */
router.get('/analytics/source', async (req: AuthRequest, res) => {
  try {
    const { campaign_id } = req.query;

    // Get helpers grouped by source_channel
    let query = supabase
      .from('campaign_helpers')
      .select('source_channel, is_valid');

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }

    const { data: helpers, error } = await query;

    if (error) throw error;

    // Group by source channel
    const sourceStats: Record<string, { total: number; valid: number }> = {};
    
    (helpers || []).forEach((h: any) => {
      const channel = h.source_channel || 'unknown';
      if (!sourceStats[channel]) {
        sourceStats[channel] = { total: 0, valid: 0 };
      }
      sourceStats[channel].total++;
      if (h.is_valid) {
        sourceStats[channel].valid++;
      }
    });

    // Convert to array and calculate percentages
    const totalHelpers = helpers?.length || 0;
    const sources = Object.entries(sourceStats).map(([channel, stats]) => ({
      channel,
      channel_name: getChannelName(channel),
      total: stats.total,
      valid: stats.valid,
      percentage: totalHelpers > 0 ? ((stats.total / totalHelpers) * 100).toFixed(1) + '%' : '0%',
      retention_rate: stats.total > 0 ? ((stats.valid / stats.total) * 100).toFixed(1) + '%' : '0%',
    }));

    // Sort by total descending
    sources.sort((a, b) => b.total - a.total);

    res.json({
      data: {
        sources,
        total_helpers: totalHelpers,
      },
    });
  } catch (error: any) {
    console.error('Get source analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get source analytics' });
  }
});

// Helper function to get friendly channel names
function getChannelName(channel: string): string {
  const names: Record<string, string> = {
    'wechat_scan': '微信扫码',
    'wechat_article': '公众号文章',
    'wechat_menu': '公众号菜单',
    'moments': '朋友圈',
    'group_chat': '群聊',
    'private_chat': '私聊',
    'unknown': '未知来源',
  };
  return names[channel] || channel;
}

/**
 * GET /api/admin/analytics/daily
 * Get daily trend data
 */
router.get('/analytics/daily', async (req: AuthRequest, res) => {
  try {
    const { campaign_id, days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));
    startDate.setHours(0, 0, 0, 0);

    // Get helpers grouped by date
    let query = supabase
      .from('campaign_helpers')
      .select('created_at, is_valid')
      .gte('created_at', startDate.toISOString());

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }

    const { data: helpers, error } = await query;

    if (error) throw error;

    // Group by date
    const dailyStats: Record<string, { total: number; valid: number }> = {};
    
    (helpers || []).forEach((h: any) => {
      const date = new Date(h.created_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, valid: 0 };
      }
      dailyStats[date].total++;
      if (h.is_valid) {
        dailyStats[date].valid++;
      }
    });

    // Fill in missing dates
    const result = [];
    const currentDate = new Date(startDate);
    const endDate = new Date();
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const stats = dailyStats[dateStr] || { total: 0, valid: 0 };
      result.push({
        date: dateStr,
        new_helpers: stats.total,
        valid_helpers: stats.valid,
        unfollows: stats.total - stats.valid,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      data: {
        daily: result,
        total_days: result.length,
      },
    });
  } catch (error: any) {
    console.error('Get daily analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get daily analytics' });
  }
});

export default router;
