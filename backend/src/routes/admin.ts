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
 * Get overall statistics
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

    // Total scan events
    const { count: totalScans } = await supabase
      .from('oa_scan_events')
      .select('*', { count: 'exact', head: true });

    // Total follow events
    const { count: totalFollows } = await supabase
      .from('oa_follow_events')
      .select('*', { count: 'exact', head: true })
      .eq('is_following', true);

    // Total invites
    const { count: totalInvites } = await supabase
      .from('invites')
      .select('*', { count: 'exact', head: true });

    res.json({
      totalUsers: totalUsers || 0,
      todayUsers: todayUsers || 0,
      totalScans: totalScans || 0,
      totalFollows: totalFollows || 0,
      totalInvites: totalInvites || 0,
      conversionRate: totalFollows && totalScans ? (totalFollows / totalScans * 100).toFixed(2) : '0.00',
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
    result.configured_vars.forEach((varName) => {
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
    const { getTunnelStatus, getCloudflareTunnelUrlFromRequest } = require('../services/cloudflare-validator');
    
    // Get stored status
    const storedStatus = await getTunnelStatus();
    
    // Try to detect from request headers
    const runtimeUrl = getCloudflareTunnelUrlFromRequest(req);
    
    // Prefer runtime URL if available, otherwise use stored
    const url = runtimeUrl || storedStatus.url;
    
    res.json({
      data: {
        url,
        verified: storedStatus.verified,
        last_checked: storedStatus.last_checked,
        status: storedStatus.status,
        source: runtimeUrl ? 'runtime' : 'stored',
      },
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

export default router;
