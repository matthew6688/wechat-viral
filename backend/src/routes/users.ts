import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { logEvent, getClientIp, getUserAgent } from '../services/event-logger';

const router = express.Router();

/**
 * GET /api/users/me
 * Get current user
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (error) throw error;

    res.json({
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        wechat_id: user.wechat_id,
        company: user.company,
        role: user.role,
        main_products: user.main_products,
        is_admin: user.is_admin || false,
        unionid: user.unionid || null, // WeChat unique ID across all products
        openid: user.openid || null, // WeChat Mini Program unique ID
        avatar_url: user.avatar_url || null, // WeChat avatar URL
        nickname: user.nickname || null, // WeChat nickname
      },
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

/**
 * GET /api/users/find
 * Find user by phone, openid, or unionid (for admin setup purposes)
 * This is a public endpoint to help users find their user ID
 */
router.get('/find', async (req: express.Request, res) => {
  try {
    const { phone, openid, unionid } = req.query;

    if (!phone && !openid && !unionid) {
      return res.status(400).json({ error: 'phone, openid, or unionid is required' });
    }

    let query = supabase.from('users').select('id, name, phone, openid, unionid, is_admin, created_at');

    if (phone) {
      query = query.eq('phone', phone);
    } else if (unionid) {
      query = query.eq('unionid', unionid);
    } else if (openid) {
      query = query.eq('openid', openid);
    }

    const { data: users, error } = await query.limit(1).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'User not found' });
      }
      throw error;
    }

    res.json({
      data: {
        user: {
          id: users.id,
          name: users.name,
          phone: users.phone,
          openid: users.openid,
          unionid: users.unionid,
          is_admin: users.is_admin || false,
          created_at: users.created_at,
        },
      },
    });
  } catch (error: any) {
    console.error('Find user error:', error);
    res.status(500).json({ error: error.message || 'Failed to find user' });
  }
});

/**
 * POST /api/users/register
 * Register or update user
 */
router.post('/register', authenticate, async (req: AuthRequest, res) => {
  try {
    const { 
      name, 
      phone, 
      wechatId, 
      company, 
      role, 
      mainProducts, 
      referralCode,
      wechat_avatar,
      wechat_nickname,
      unionid,
      openid,
    } = req.body;

    // Prepare update data
    const updateData: any = {
      name,
      phone,
      wechat_id: wechatId,
      company,
      role: role || 'Other',
      main_products: mainProducts,
    };

    // Add WeChat profile info if provided
    if (wechat_avatar) {
      updateData.avatar_url = wechat_avatar; // Store avatar URL if column exists
    }
    if (wechat_nickname) {
      updateData.nickname = wechat_nickname; // Store nickname if column exists
    }

    // Note: unionid and openid are already set during login, but we can verify them here
    // They're included in the request as hidden fields for reference

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.userId)
      .select('*')
      .single();

    if (error) throw error;

    // Handle referral relationship if referralCode is provided
    if (referralCode) {
      try {
        const { resolveScene } = require('../services/scene');
        const sceneContext = await resolveScene(referralCode);
        
        if (sceneContext && sceneContext.inviterUserId) {
          // Get default activity (use from sceneContext if available, otherwise get default)
          const activityId = sceneContext.activityId || (await supabase
            .from('activities')
            .select('id')
            .limit(1)
            .single()).data?.id;

          if (activityId) {
            // Check if invite relationship already exists
            const { data: existing } = await supabase
              .from('invites')
              .select('id')
              .eq('inviter_user_id', sceneContext.inviterUserId)
              .eq('invitee_user_id', req.userId)
              .eq('activity_id', activityId)
              .single();

            if (!existing) {
              // Create invite relationship
              const { error: inviteError } = await supabase
                .from('invites')
                .insert({
                  inviter_user_id: sceneContext.inviterUserId,
                  invitee_user_id: req.userId,
                  activity_id: activityId,
                });

              if (inviteError) {
                console.error('Failed to create invite relationship:', inviteError);
              } else {
                console.log('Invite relationship created successfully');
                
                // Log invite event
                await logEvent({
                  event_type: 'invite',
                  user_id: req.userId,
                  related_user_id: sceneContext.inviterUserId,
                  event_data: {
                    referral_code: referralCode,
                    activity_id: activityId,
                  },
                  ip_address: getClientIp(req),
                  user_agent: getUserAgent(req),
                });
                
                // Award points to inviter (if points system is set up)
                // This can be handled by a trigger or separate service
              }
            }
          }
        }
      } catch (referralError) {
        console.error('Error processing referral:', referralError);
        // Don't fail registration if referral processing fails
      }
    }

    res.json({
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        wechat_id: user.wechat_id,
        company: user.company,
        role: user.role,
        main_products: user.main_products,
        is_admin: user.is_admin || false,
        unionid: user.unionid || null, // WeChat unique ID across all products
        openid: user.openid || null, // WeChat Mini Program unique ID
        avatar_url: user.avatar_url || null, // WeChat avatar URL
        nickname: user.nickname || null, // WeChat nickname
      },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    console.error('Register error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    res.status(500).json({ error: error.message || 'Failed to register' });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile (nickname and avatar from wx.getUserProfile)
 */
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const { wechat_nickname, wechat_avatar_url } = req.body;

    if (!wechat_nickname && !wechat_avatar_url) {
      return res.status(400).json({ error: 'wechat_nickname or wechat_avatar_url is required' });
    }

    // Prepare update data
    const updateData: any = {};
    if (wechat_nickname) {
      updateData.wechat_nickname = wechat_nickname;
      updateData.name = wechat_nickname; // Also update name field
    }
    if (wechat_avatar_url) {
      updateData.wechat_avatar_url = wechat_avatar_url;
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.userId)
      .select('*')
      .single();

    if (error) throw error;

    // Log profile update event
    await logEvent({
      event_type: 'profile_update',
      user_id: req.userId,
      event_data: {
        updated_fields: Object.keys(updateData),
        has_nickname: !!wechat_nickname,
        has_avatar: !!wechat_avatar_url,
      },
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
    });

    res.json({
      data: {
        id: user.id,
        name: user.name,
        wechat_nickname: user.wechat_nickname,
        wechat_avatar_url: user.wechat_avatar_url,
        is_admin: user.is_admin || false,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

export default router;
