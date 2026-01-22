import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = express.Router();

/**
 * GET /api/points/balance
 * Get user's point balance
 */
router.get('/balance', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: account, error } = await supabase
      .from('points_accounts')
      .select('total_points')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      data: {
        balance: account?.total_points || 0,
      },
    });
  } catch (error: any) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: error.message || 'Failed to get balance' });
  }
});

/**
 * GET /api/points/logs
 * Get user's point logs
 */
router.get('/logs', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('points_logs')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ data: { logs: logs || [] } });
  } catch (error: any) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: error.message || 'Failed to get logs' });
  }
});

export default router;
