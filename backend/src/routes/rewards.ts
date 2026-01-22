import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { logEvent, getClientIp, getUserAgent } from '../services/event-logger';

const router = express.Router();

/**
 * GET /api/rewards
 * Get all rewards
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: rewards, error } = await supabase
      .from('rewards')
      .select('*')
      .order('points_required', { ascending: true });

    if (error) throw error;

    res.json({ data: { rewards: rewards || [] } });
  } catch (error: any) {
    console.error('Get rewards error:', error);
    res.status(500).json({ error: error.message || 'Failed to get rewards' });
  }
});

/**
 * POST /api/rewards/:id/redeem
 * Redeem a reward
 */
router.post('/:id/redeem', authenticate, async (req: AuthRequest, res) => {
  try {
    const rewardId = req.params.id;

    // Get reward
    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError || !reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Check user balance
    const { data: account } = await supabase
      .from('points_accounts')
      .select('total_points')
      .eq('user_id', req.userId)
      .single();

    const balance = account?.total_points || 0;

    if (balance < reward.points_required) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    // Create redemption
    const { data: redemption, error: redeemError } = await supabase
      .from('redemptions')
      .insert({
        user_id: req.userId,
        reward_id: rewardId,
        status: 'completed',
        deliver_content: reward.deliver_content || '',
      })
      .select('*')
      .single();

    if (redeemError) throw redeemError;

    // Deduct points (handled by trigger)
    // The trigger will automatically deduct points from points_accounts

    // Log redeem event
    await logEvent({
      event_type: 'redeem',
      user_id: req.userId,
      event_data: {
        reward_id: reward.id,
        reward_name: reward.name,
        points_used: reward.points_required,
        redemption_id: redemption.id,
      },
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
    });

    res.json({
      data: {
        redemption: {
          id: redemption.id,
          reward_name: reward.name,
          points_used: reward.points_required,
          status: redemption.status,
          deliver_content: redemption.deliver_content,
          deliver_method: reward.deliver_method,
          created_at: redemption.created_at,
        },
      },
    });
  } catch (error: any) {
    console.error('Redeem reward error:', error);
    res.status(500).json({ error: error.message || 'Failed to redeem reward' });
  }
});

/**
 * GET /api/rewards/redemptions
 * Get user's redemption history
 */
router.get('/redemptions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: redemptions, error } = await supabase
      .from('redemptions')
      .select(`
        *,
        reward:rewards(name)
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (redemptions || []).map((r: any) => ({
      id: r.id,
      reward_name: r.reward?.name || 'Unknown',
      points_used: r.reward?.points_required || 0,
      status: r.status,
      deliver_content: r.deliver_content,
      created_at: r.created_at,
    }));

    res.json({ data: { redemptions: formatted } });
  } catch (error: any) {
    console.error('Get redemptions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get redemptions' });
  }
});

/**
 * GET /api/rewards/redemptions/:id
 * Get specific redemption
 */
router.get('/redemptions/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: redemption, error } = await supabase
      .from('redemptions')
      .select(`
        *,
        reward:rewards(name, points_required, deliver_method, deliver_content)
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !redemption) {
      return res.status(404).json({ error: 'Redemption not found' });
    }

    res.json({
      data: {
        redemption: {
          id: redemption.id,
          reward_name: redemption.reward?.name || 'Unknown',
          points_used: redemption.reward?.points_required || 0,
          status: redemption.status,
          deliver_content: redemption.deliver_content,
          deliver_method: redemption.reward?.deliver_method,
          created_at: redemption.created_at,
        },
      },
    });
  } catch (error: any) {
    console.error('Get redemption error:', error);
    res.status(500).json({ error: error.message || 'Failed to get redemption' });
  }
});

export default router;
