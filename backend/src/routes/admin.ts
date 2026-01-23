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
 * Get all events from event_logs table (unified event log) with enhanced data
 */
router.get('/debug/all-events', async (req: AuthRequest, res) => {
  try {
    const { limit = 200, event_type, search, device_type, location } = req.query;

    let query = supabase
      .from('event_logs')
      .select(`
        *,
        user:users!event_logs_user_id_fkey(id, name, phone, openid, unionid, wechat_nickname, wechat_avatar_url),
        related_user:users!event_logs_related_user_id_fkey(id, name, phone, wechat_nickname, wechat_avatar_url)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    // Filter by event type if provided
    if (event_type && event_type !== 'all') {
      query = query.eq('event_type', event_type as string);
    }

    // Filter by device type
    if (device_type && device_type !== 'all') {
      query = query.eq('device_type', device_type as string);
    }

    // Filter by location (city)
    if (location && location !== 'all') {
      query = query.eq('location_city', location as string);
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

    // Enrich events with campaign names if campaign_id is in event_data
    const enrichedEvents = await Promise.all((events || []).map(async (event: any) => {
      let campaignName = null;
      const campaignId = event.event_data?.campaign_id;
      
      if (campaignId) {
        try {
          const { data: campaign } = await supabase
            .from('campaigns')
            .select('name')
            .eq('id', campaignId)
            .single();
          campaignName = campaign?.name;
        } catch (e) {
          // Ignore campaign lookup errors
        }
      }

      return {
        ...event,
        campaign_name: campaignName,
        // Ensure user profile data is easily accessible
        user_display: event.user ? {
          name: event.user.name || event.user.wechat_nickname || 'Unknown',
          nickname: event.user.wechat_nickname,
          avatar: event.user.wechat_avatar_url,
          phone: event.user.phone,
        } : null,
        related_user_display: event.related_user ? {
          name: event.related_user.name || event.related_user.wechat_nickname || 'Unknown',
          nickname: event.related_user.wechat_nickname,
          avatar: event.related_user.wechat_avatar_url,
        } : null,
      };
    }));

    // Get unique values for filters
    const { data: deviceTypes } = await supabase
      .from('event_logs')
      .select('device_type')
      .not('device_type', 'is', null)
      .limit(100);
    
    const { data: locations } = await supabase
      .from('event_logs')
      .select('location_city')
      .not('location_city', 'is', null)
      .limit(100);

    const uniqueDeviceTypes = [...new Set((deviceTypes || []).map((d: any) => d.device_type).filter(Boolean))];
    const uniqueLocations = [...new Set((locations || []).map((l: any) => l.location_city).filter(Boolean))];

    res.json({
      data: {
        events: enrichedEvents,
        total: enrichedEvents.length,
        filters: {
          device_types: uniqueDeviceTypes,
          locations: uniqueLocations,
        },
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
 * GET /api/admin/validate/backend
 * Backend server health check
 */
router.get('/validate/backend', async (req: AuthRequest, res) => {
  try {
    const startTime = Date.now();
    
    // Check database connection
    const { data: dbTest, error: dbError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    // Get server info
    const serverInfo = {
      status: 'healthy',
      port: process.env.PORT || 3000,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      responseTime: `${responseTime}ms`,
      databaseConnected: !dbError,
      timestamp: new Date().toISOString(),
    };
    
    res.json({ data: serverInfo });
  } catch (error: any) {
    console.error('Backend validation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to validate backend',
      data: {
        status: 'unhealthy',
        error: error.message,
      }
    });
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

// ============================================
// TESTING TOOLS - Reset APIs
// ============================================

/**
 * POST /api/admin/testing/reset-all-campaign-data
 * Reset all campaign data (helpers, participants, claims, events)
 * Keeps: users, campaigns, rewards structure
 */
router.post('/testing/reset-all-campaign-data', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const results: Record<string, number> = {};

    // Count before delete for campaign reward claims
    const { count: claimsCountBefore } = await (supabase
      .from('campaign_reward_claims')
      .select('*', { count: 'exact', head: true }) as any);
    
    // Delete campaign reward claims
    await (supabase
      .from('campaign_reward_claims')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') as any);
    results.reward_claims_deleted = claimsCountBefore || 0;

    // Count before delete for campaign helpers
    const { count: helpersCountBefore } = await (supabase
      .from('campaign_helpers')
      .select('*', { count: 'exact', head: true }) as any);
    
    // Delete campaign helpers
    await (supabase
      .from('campaign_helpers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') as any);
    results.helpers_deleted = helpersCountBefore || 0;

    // Count before delete for campaign participants
    const { count: participantsCountBefore } = await (supabase
      .from('campaign_participants')
      .select('*', { count: 'exact', head: true }) as any);
    
    // Delete campaign participants
    await (supabase
      .from('campaign_participants')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') as any);
    results.participants_deleted = participantsCountBefore || 0;

    // Count before delete for campaign-related event logs
    const { count: eventsCountBefore } = await (supabase
      .from('event_logs')
      .select('*', { count: 'exact', head: true })
      .or('event_type.like.campaign_%,event_type.like.oa_%') as any);
    
    // Delete campaign-related event logs
    await (supabase
      .from('event_logs')
      .delete()
      .or('event_type.like.campaign_%,event_type.like.oa_%') as any);
    results.events_deleted = eventsCountBefore || 0;

    // Log this action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_reset_all_campaign_data',
      user_id: (req as any).user?.id,
      event_data: results,
    });

    res.json({
      success: true,
      message: 'All campaign data has been reset',
      data: results,
    });
  } catch (error: any) {
    console.error('Reset all campaign data error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset campaign data' });
  }
});

/**
 * POST /api/admin/testing/reset-campaign/:id
 * Reset a specific campaign's data
 */
router.post('/testing/reset-campaign/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.params.id;
    const results: Record<string, number> = {};

    // Count before delete for campaign reward claims
    const { count: claimsCountBefore } = await (supabase
      .from('campaign_reward_claims')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId) as any);
    
    // Delete campaign reward claims for this campaign
    await (supabase
      .from('campaign_reward_claims')
      .delete()
      .eq('campaign_id', campaignId) as any);
    results.reward_claims_deleted = claimsCountBefore || 0;

    // Count before delete for campaign helpers
    const { count: helpersCountBefore } = await (supabase
      .from('campaign_helpers')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId) as any);
    
    // Delete campaign helpers for this campaign
    await (supabase
      .from('campaign_helpers')
      .delete()
      .eq('campaign_id', campaignId) as any);
    results.helpers_deleted = helpersCountBefore || 0;

    // Count before delete for campaign participants
    const { count: participantsCountBefore } = await (supabase
      .from('campaign_participants')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId) as any);
    
    // Delete campaign participants for this campaign
    await (supabase
      .from('campaign_participants')
      .delete()
      .eq('campaign_id', campaignId) as any);
    results.participants_deleted = participantsCountBefore || 0;

    // Count before delete for campaign-related event logs
    const { count: eventsCountBefore } = await (supabase
      .from('event_logs')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId) as any);
    
    // Delete campaign-related event logs for this campaign
    await (supabase
      .from('event_logs')
      .delete()
      .eq('campaign_id', campaignId) as any);
    results.events_deleted = eventsCountBefore || 0;

    // Log this action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_reset_campaign',
      user_id: (req as any).user?.id,
      campaign_id: campaignId,
      event_data: results,
    });

    res.json({
      success: true,
      message: `Campaign ${campaignId} data has been reset`,
      data: results,
    });
  } catch (error: any) {
    console.error('Reset campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset campaign' });
  }
});

/**
 * POST /api/admin/testing/reset-helper
 * Reset a specific helper's records (by OpenID or UnionID)
 * Allows them to help again in campaigns
 */
router.post('/testing/reset-helper', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { openid, unionid, campaign_id } = req.body;
    
    if (!openid && !unionid) {
      return res.status(400).json({ error: 'Either openid or unionid is required' });
    }

    const results: Record<string, number> = {};
    
    // Count before delete
    let countQuery = supabase.from('campaign_helpers').select('*', { count: 'exact', head: true });
    if (openid) {
      countQuery = countQuery.eq('helper_openid', openid);
    } else if (unionid) {
      countQuery = countQuery.eq('helper_unionid', unionid);
    }
    if (campaign_id) {
      countQuery = countQuery.eq('campaign_id', campaign_id);
    }
    const { count: helpersCountBefore } = await (countQuery as any);
    
    // Build delete query based on provided identifiers
    let deleteQuery = supabase.from('campaign_helpers').delete();
    if (openid) {
      deleteQuery = deleteQuery.eq('helper_openid', openid);
    } else if (unionid) {
      deleteQuery = deleteQuery.eq('helper_unionid', unionid);
    }
    if (campaign_id) {
      deleteQuery = deleteQuery.eq('campaign_id', campaign_id);
    }
    
    await (deleteQuery as any);
    results.helpers_deleted = helpersCountBefore || 0;

    // Log this action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_reset_helper',
      user_id: (req as any).user?.id,
      event_data: { openid, unionid, campaign_id, ...results },
    });

    res.json({
      success: true,
      message: `Helper records deleted`,
      data: results,
    });
  } catch (error: any) {
    console.error('Reset helper error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset helper' });
  }
});

/**
 * GET /api/admin/testing/test-accounts
 * Get saved test WeChat accounts
 */
router.get('/testing/test-accounts', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { data: settings } = await supabase
      .from('debug_settings')
      .select('value')
      .eq('key', 'test_wechat_accounts')
      .single();

    const accounts = settings?.value || [];

    res.json({
      success: true,
      data: { accounts },
    });
  } catch (error: any) {
    console.error('Get test accounts error:', error);
    res.status(500).json({ error: error.message || 'Failed to get test accounts' });
  }
});

/**
 * POST /api/admin/testing/test-accounts
 * Save test WeChat accounts
 */
router.post('/testing/test-accounts', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { accounts } = req.body;

    if (!Array.isArray(accounts)) {
      return res.status(400).json({ error: 'Accounts must be an array' });
    }

    // Upsert the test accounts setting
    const { error } = await supabase
      .from('debug_settings')
      .upsert({
        key: 'test_wechat_accounts',
        value: accounts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Test accounts saved',
      data: { accounts },
    });
  } catch (error: any) {
    console.error('Save test accounts error:', error);
    res.status(500).json({ error: error.message || 'Failed to save test accounts' });
  }
});

/**
 * GET /api/admin/testing/known-helpers
 * Get all known helper OpenIDs from the database
 */
router.get('/testing/known-helpers', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Get unique helper OpenIDs
    const { data: helpers } = await supabase
      .from('campaign_helpers')
      .select('helper_openid, helper_unionid, created_at, campaign_id')
      .order('created_at', { ascending: false })
      .limit(100);

    // Get unique values
    const uniqueHelpers = new Map();
    (helpers || []).forEach((h: any) => {
      const key = h.helper_openid || h.helper_unionid;
      if (key && !uniqueHelpers.has(key)) {
        uniqueHelpers.set(key, {
          openid: h.helper_openid,
          unionid: h.helper_unionid,
          first_seen: h.created_at,
          campaign_id: h.campaign_id,
        });
      }
    });

    res.json({
      success: true,
      data: {
        helpers: Array.from(uniqueHelpers.values()),
        total: uniqueHelpers.size,
      },
    });
  } catch (error: any) {
    console.error('Get known helpers error:', error);
    res.status(500).json({ error: error.message || 'Failed to get known helpers' });
  }
});

/**
 * POST /api/admin/testing/nuclear-reset
 * Delete ALL data (requires confirmation)
 */
router.post('/testing/nuclear-reset', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE ALL') {
      return res.status(400).json({ error: 'Invalid confirmation. Type "DELETE ALL" to confirm.' });
    }

    const results: Record<string, number | string> = {};

    // Delete in order of dependencies
    const tables = [
      'campaign_reward_claims',
      'campaign_helpers',
      'campaign_participants',
      'campaign_rewards',
      'campaigns',
      'event_logs',
      'invites',
      'users',
    ];

    for (const table of tables) {
      try {
        // Count before delete
        const { count } = await (supabase
          .from(table)
          .select('*', { count: 'exact', head: true }) as any);
        
        // Delete all
        await (supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') as any);
        
        results[`${table}_deleted`] = count || 0;
      } catch (err: any) {
        console.warn(`Failed to delete from ${table}:`, err.message);
        results[`${table}_error`] = err.message;
      }
    }

    res.json({
      success: true,
      message: '⚠️ All data has been deleted!',
      data: results,
    });
  } catch (error: any) {
    console.error('Nuclear reset error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform nuclear reset' });
  }
});

// ============================================
// CONTACTS MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/admin/contacts
 * List all contacts with filters and pagination
 */
router.get('/contacts', async (req: AuthRequest, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      source = '',
      status = '',
      hasMP = '',
      hasOA = '',
      hasEmail = '',
      hasPhone = '',
      isAdmin = '',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build query
    let query = supabase
      .from('users')
      .select(`
        id, name, phone, email, wechat_id, company, role,
        openid, openid_oa, unionid,
        wechat_avatar_url, wechat_nickname, wechat_gender,
        wechat_city, wechat_province, wechat_country, wechat_language,
        source, status, tags, notes, is_admin,
        first_seen_at, last_active_at, created_at
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,wechat_nickname.ilike.%${search}%,openid.ilike.%${search}%,openid_oa.ilike.%${search}%`);
    }
    if (source) {
      query = query.eq('source', source);
    }
    // Filter by status - by default exclude deleted users unless explicitly requested
    if (status) {
      query = query.eq('status', status);
    } else {
      // Exclude deleted users by default
      query = query.neq('status', 'deleted');
    }
    if (hasMP === 'true') {
      query = query.not('openid', 'is', null);
    }
    if (hasOA === 'true') {
      query = query.not('openid_oa', 'is', null);
    }
    if (hasEmail === 'true') {
      query = query.not('email', 'is', null);
    }
    if (hasPhone === 'true') {
      query = query.not('phone', 'is', null);
    }
    if (isAdmin === 'true') {
      query = query.eq('is_admin', true);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy as string, { ascending: sortOrder === 'asc' })
      .range(offset, offset + parseInt(limit as string) - 1);

    const { data: contacts, error, count } = await query;

    if (error) throw error;

    // Get engagement stats for each contact
    const contactsWithStats = await Promise.all((contacts || []).map(async (contact: any) => {
      // Get campaign participation stats
      const { count: campaignsJoined } = await supabase
        .from('campaign_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', contact.id);

      // Get total helpers brought
      const { data: participations } = await supabase
        .from('campaign_participants')
        .select('helper_count')
        .eq('user_id', contact.id);

      const totalHelpers = (participations || []).reduce((sum: number, p: any) => sum + (p.helper_count || 0), 0);

      // Get rewards claimed
      const { count: rewardsClaimed } = await supabase
        .from('campaign_reward_claims')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', contact.id);

      // Get points balance
      const { data: pointsAccount } = await supabase
        .from('points_accounts')
        .select('total_points')
        .eq('user_id', contact.id)
        .single();

      // Check OA follow status
      const { data: oaFollow } = await supabase
        .from('oa_follow_events')
        .select('is_following')
        .eq('openid', contact.openid_oa)
        .order('follow_time', { ascending: false })
        .limit(1)
        .single();

      return {
        ...contact,
        engagement: {
          campaigns_joined: campaignsJoined || 0,
          total_helpers: totalHelpers,
          rewards_claimed: rewardsClaimed || 0,
          points_balance: pointsAccount?.total_points || 0,
          oa_following: oaFollow?.is_following ?? null,
        },
      };
    }));

    res.json({
      success: true,
      data: {
        contacts: contactsWithStats,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
        },
      },
    });
  } catch (error: any) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: error.message || 'Failed to get contacts' });
  }
});

/**
 * GET /api/admin/contacts/stats
 * Get contact statistics
 */
router.get('/contacts/stats', async (req: AuthRequest, res) => {
  try {
    // Total users (excluding deleted)
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'deleted');

    // Users with MP OpenID (excluding deleted)
    const { count: mpUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('openid', 'is', null)
      .neq('status', 'deleted');

    // Users with OA OpenID (excluding deleted)
    const { count: oaUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('openid_oa', 'is', null)
      .neq('status', 'deleted');

    // Registered users (with email or phone, excluding deleted)
    const { count: registeredUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .or('email.not.is.null,phone.not.is.null')
      .neq('status', 'deleted');

    // Admin users (excluding deleted)
    const { count: adminUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', true)
      .neq('status', 'deleted');

    // Active users (last 7 days, excluding deleted)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', sevenDaysAgo.toISOString())
      .neq('status', 'deleted');

    // Blocked users
    const { count: blockedUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'blocked');

    // New users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: newUsersToday } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    res.json({
      success: true,
      data: {
        total: totalUsers || 0,
        mp_users: mpUsers || 0,
        oa_users: oaUsers || 0,
        registered: registeredUsers || 0,
        admins: adminUsers || 0,
        active_7d: activeUsers || 0,
        blocked: blockedUsers || 0,
        new_today: newUsersToday || 0,
      },
    });
  } catch (error: any) {
    console.error('Get contacts stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get contacts stats' });
  }
});

/**
 * GET /api/admin/contacts/:id
 * Get single contact details
 */
router.get('/contacts/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Get user details
    const { data: contact, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get campaign participations
    const { data: participations } = await supabase
      .from('campaign_participants')
      .select(`
        *,
        campaign:campaigns(id, name, status)
      `)
      .eq('user_id', id)
      .order('joined_at', { ascending: false });

    // Get reward claims
    const { data: rewardClaims } = await supabase
      .from('campaign_reward_claims')
      .select(`
        *,
        campaign:campaigns(name),
        reward:campaign_rewards(reward_name, tier_level)
      `)
      .eq('user_id', id)
      .order('claimed_at', { ascending: false });

    // Get points account
    const { data: pointsAccount } = await supabase
      .from('points_accounts')
      .select('total_points')
      .eq('user_id', id)
      .single();

    // Get points history
    const { data: pointsHistory } = await supabase
      .from('points_logs')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get OA follow status
    const { data: oaFollowEvents } = await supabase
      .from('oa_follow_events')
      .select('*')
      .eq('openid', contact.openid_oa)
      .order('follow_time', { ascending: false })
      .limit(5);

    // Get recent events
    const { data: recentEvents } = await supabase
      .from('event_logs')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate engagement summary
    const totalHelpers = (participations || []).reduce((sum: number, p: any) => sum + (p.helper_count || 0), 0);

    res.json({
      success: true,
      data: {
        contact,
        engagement: {
          campaigns_joined: participations?.length || 0,
          total_helpers: totalHelpers,
          rewards_claimed: rewardClaims?.length || 0,
          points_balance: pointsAccount?.total_points || 0,
          oa_following: oaFollowEvents?.[0]?.is_following ?? null,
        },
        participations: participations || [],
        rewardClaims: rewardClaims || [],
        pointsHistory: pointsHistory || [],
        oaFollowEvents: oaFollowEvents || [],
        recentEvents: recentEvents || [],
      },
    });
  } catch (error: any) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: error.message || 'Failed to get contact' });
  }
});

/**
 * PUT /api/admin/contacts/:id
 * Update contact info
 */
router.put('/contacts/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, company, role, tags, notes, status } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (company !== undefined) updateData.company = company;
    if (role !== undefined) updateData.role = role;
    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const { data: contact, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_update_contact',
      user_id: (req as any).user?.id,
      related_user_id: id,
      event_data: { updated_fields: Object.keys(updateData) },
    });

    res.json({
      success: true,
      message: 'Contact updated',
      data: { contact },
    });
  } catch (error: any) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: error.message || 'Failed to update contact' });
  }
});

/**
 * POST /api/admin/contacts/:id/make-admin
 * Make user an admin
 */
router.post('/contacts/:id/make-admin', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const { data: contact, error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_grant_admin',
      user_id: (req as any).user?.id,
      related_user_id: id,
      event_data: { action: 'make_admin' },
    });

    res.json({
      success: true,
      message: 'User is now an admin',
      data: { contact },
    });
  } catch (error: any) {
    console.error('Make admin error:', error);
    res.status(500).json({ error: error.message || 'Failed to make admin' });
  }
});

/**
 * POST /api/admin/contacts/:id/remove-admin
 * Remove admin privileges
 */
router.post('/contacts/:id/remove-admin', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent removing own admin
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
    }

    const { data: contact, error } = await supabase
      .from('users')
      .update({ is_admin: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_revoke_admin',
      user_id: (req as any).user?.id,
      related_user_id: id,
      event_data: { action: 'remove_admin' },
    });

    res.json({
      success: true,
      message: 'Admin privileges removed',
      data: { contact },
    });
  } catch (error: any) {
    console.error('Remove admin error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove admin' });
  }
});

/**
 * POST /api/admin/contacts/:id/block
 * Block a user
 */
router.post('/contacts/:id/block', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent blocking yourself
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const { data: contact, error } = await supabase
      .from('users')
      .update({ status: 'blocked' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_block_user',
      user_id: (req as any).user?.id,
      related_user_id: id,
      event_data: { action: 'block' },
    });

    res.json({
      success: true,
      message: 'User blocked',
      data: { contact },
    });
  } catch (error: any) {
    console.error('Block user error:', error);
    res.status(500).json({ error: error.message || 'Failed to block user' });
  }
});

/**
 * POST /api/admin/contacts/:id/unblock
 * Unblock a user
 */
router.post('/contacts/:id/unblock', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const { data: contact, error } = await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_unblock_user',
      user_id: (req as any).user?.id,
      related_user_id: id,
      event_data: { action: 'unblock' },
    });

    res.json({
      success: true,
      message: 'User unblocked',
      data: { contact },
    });
  } catch (error: any) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: error.message || 'Failed to unblock user' });
  }
});

/**
 * POST /api/admin/contacts/:id/reset
 * Reset user's campaign data
 */
router.post('/contacts/:id/reset', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const results: Record<string, number> = {};

    // Count before delete - reward claims
    const { count: claimsCount } = await supabase
      .from('campaign_reward_claims')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);
    
    // Delete reward claims
    await (supabase
      .from('campaign_reward_claims')
      .delete()
      .eq('user_id', id) as any);
    results.reward_claims_deleted = claimsCount || 0;

    // Count before delete - campaign participations
    const { count: participationsCount } = await supabase
      .from('campaign_participants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);

    // Delete campaign participations (this will cascade to helpers)
    await (supabase
      .from('campaign_participants')
      .delete()
      .eq('user_id', id) as any);
    results.participations_deleted = participationsCount || 0;

    // Delete helpers where this user was the helper
    const { data: user } = await supabase
      .from('users')
      .select('openid, openid_oa')
      .eq('id', id)
      .single();

    if (user?.openid) {
      await (supabase
        .from('campaign_helpers')
        .delete()
        .eq('helper_openid', user.openid) as any);
    }
    if (user?.openid_oa) {
      await (supabase
        .from('campaign_helpers')
        .delete()
        .eq('helper_openid', user.openid_oa) as any);
    }

    // Log the action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_reset_user',
      user_id: (req as any).user?.id,
      related_user_id: id,
      event_data: results,
    });

    res.json({
      success: true,
      message: 'User campaign data reset',
      data: results,
    });
  } catch (error: any) {
    console.error('Reset user error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset user' });
  }
});

/**
 * DELETE /api/admin/contacts/:id
 * Soft delete a user
 */
router.delete('/contacts/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const { data: contact, error } = await supabase
      .from('users')
      .update({ status: 'deleted' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_delete_user',
      user_id: (req as any).user?.id,
      related_user_id: id,
      event_data: { action: 'soft_delete' },
    });

    res.json({
      success: true,
      message: 'User deleted',
      data: { contact },
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

/**
 * DELETE /api/admin/contacts/:id/hard
 * Hard delete a user (permanent)
 */
router.delete('/contacts/:id/hard', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Invalid confirmation. Type "DELETE" to confirm.' });
    }

    // Prevent deleting yourself
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const results: Record<string, number | string> = {};

    // Delete in order of dependencies
    try {
      await (supabase.from('campaign_reward_claims').delete().eq('user_id', id) as any);
      results.reward_claims = 'deleted';
    } catch (e) {}

    try {
      await (supabase.from('campaign_participants').delete().eq('user_id', id) as any);
      results.participations = 'deleted';
    } catch (e) {}

    try {
      await (supabase.from('points_logs').delete().eq('user_id', id) as any);
      results.points_logs = 'deleted';
    } catch (e) {}

    try {
      await (supabase.from('points_accounts').delete().eq('user_id', id) as any);
      results.points_account = 'deleted';
    } catch (e) {}

    try {
      await (supabase.from('event_logs').delete().eq('user_id', id) as any);
      results.event_logs = 'deleted';
    } catch (e) {}

    // Finally delete the user
    const { error } = await (supabase.from('users').delete().eq('id', id) as any);
    if (error) throw error;

    results.user = 'deleted';

    res.json({
      success: true,
      message: 'User permanently deleted',
      data: results,
    });
  } catch (error: any) {
    console.error('Hard delete user error:', error);
    res.status(500).json({ error: error.message || 'Failed to hard delete user' });
  }
});

/**
 * POST /api/admin/contacts/:id/tags
 * Add or remove tags
 */
router.post('/contacts/:id/tags', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, tag } = req.body;

    if (!tag || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action or tag' });
    }

    // Get current tags
    const { data: user } = await supabase
      .from('users')
      .select('tags')
      .eq('id', id)
      .single();

    let tags = user?.tags || [];

    if (action === 'add' && !tags.includes(tag)) {
      tags.push(tag);
    } else if (action === 'remove') {
      tags = tags.filter((t: string) => t !== tag);
    }

    const { data: contact, error } = await supabase
      .from('users')
      .update({ tags })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: action === 'add' ? 'Tag added' : 'Tag removed',
      data: { contact },
    });
  } catch (error: any) {
    console.error('Update tags error:', error);
    res.status(500).json({ error: error.message || 'Failed to update tags' });
  }
});

/**
 * POST /api/admin/contacts/export
 * Export contacts
 */
router.post('/contacts/export', async (req: AuthRequest, res) => {
  try {
    const { format = 'json', filters = {} } = req.body;

    let query = supabase
      .from('users')
      .select('*');

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.source) {
      query = query.eq('source', filters.source);
    }

    const { data: contacts, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['ID', 'Name', 'Phone', 'Email', 'WeChat Nickname', 'MP OpenID', 'OA OpenID', 'UnionID', 'Source', 'Status', 'Created At'];
      const rows = (contacts || []).map((c: any) => [
        c.id,
        c.name || '',
        c.phone || '',
        c.email || '',
        c.wechat_nickname || '',
        c.openid || '',
        c.openid_oa || '',
        c.unionid || '',
        c.source || '',
        c.status || '',
        c.created_at || '',
      ]);

      const csv = [headers.join(','), ...rows.map((r: any[]) => r.map(v => `"${v}"`).join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: { contacts },
    });
  } catch (error: any) {
    console.error('Export contacts error:', error);
    res.status(500).json({ error: error.message || 'Failed to export contacts' });
  }
});

/**
 * POST /api/admin/contacts/bulk-action
 * Perform bulk actions on multiple contacts
 */
router.post('/contacts/bulk-action', async (req: AuthRequest, res) => {
  try {
    const { action, ids, data } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No contacts selected' });
    }

    const results: Record<string, any> = { success: [], failed: [] };

    for (const id of ids) {
      try {
        switch (action) {
          case 'add_tag':
            if (data?.tag) {
              const { data: user } = await supabase.from('users').select('tags').eq('id', id).single();
              const tags = [...(user?.tags || []), data.tag].filter((v, i, a) => a.indexOf(v) === i);
              await supabase.from('users').update({ tags }).eq('id', id);
            }
            break;
          case 'remove_tag':
            if (data?.tag) {
              const { data: user } = await supabase.from('users').select('tags').eq('id', id).single();
              const tags = (user?.tags || []).filter((t: string) => t !== data.tag);
              await supabase.from('users').update({ tags }).eq('id', id);
            }
            break;
          case 'block':
            await supabase.from('users').update({ status: 'blocked' }).eq('id', id);
            break;
          case 'unblock':
            await supabase.from('users').update({ status: 'active' }).eq('id', id);
            break;
          case 'delete':
            await supabase.from('users').update({ status: 'deleted' }).eq('id', id);
            break;
          default:
            throw new Error('Unknown action');
        }
        results.success.push(id);
      } catch (e: any) {
        results.failed.push({ id, error: e.message });
      }
    }

    // Log the bulk action
    const { logEvent } = require('../services/event-logger');
    await logEvent({
      event_type: 'admin_bulk_action',
      user_id: (req as any).user?.id,
      event_data: { action, count: ids.length, results },
    });

    res.json({
      success: true,
      message: `Bulk action completed: ${results.success.length} succeeded, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error: any) {
    console.error('Bulk action error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform bulk action' });
  }
});

export default router;
