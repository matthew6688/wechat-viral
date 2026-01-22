import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { supabase } from '../config/supabase';

const router = express.Router();

// All admin routes require authentication and admin role
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

export default router;
