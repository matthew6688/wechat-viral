import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { code2Session } from '../services/wechat';
import { supabase } from '../config/supabase';
import { logEvent, getClientIp, getUserAgent } from '../services/event-logger';

const router = express.Router();

/**
 * GET /api/auth/settings
 * Get public authentication settings (no auth required)
 */
router.get('/settings', async (req, res) => {
  try {
    const { data: settings } = await supabase
      .from('debug_settings')
      .select('key, value')
      .in('key', ['registration_required']);
    
    const result: Record<string, any> = {
      registration_required: true, // Default to true
    };
    
    if (settings) {
      for (const setting of settings) {
        if (setting.key === 'registration_required') {
          result.registration_required = setting.value === 'true';
        }
      }
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get auth settings error:', error);
    res.json({ success: true, data: { registration_required: true } });
  }
});

/**
 * POST /api/auth/login
 * WeChat Mini Program login
 */
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;

    console.log('Login request received:', { code: code ? 'present' : 'missing' });

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Exchange code for openid
    console.log('Calling code2Session...');
    const session = await code2Session(code);
    console.log('code2Session success, openid:', session.openid);

    // Find or create user - Priority: unionid > openid
    // This ensures users who first follow OA then use MP are properly linked
    console.log('Looking up user, unionid:', session.unionid, 'openid:', session.openid);

    let user: any = null;
    let userError: any = null;
    let foundBy: string = 'none';

    // Priority 1: Find by unionid (if bound to Open Platform)
    if (session.unionid) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('unionid', session.unionid)
        .single();
      
      if (data) {
        user = data;
        foundBy = 'unionid';
        console.log('Found user by unionid:', user.id);
        
        // Update openid if not set (user was created from OA first)
        if (!user.openid) {
          await supabase
            .from('users')
            .update({ openid: session.openid })
            .eq('id', user.id);
          user.openid = session.openid;
          console.log('Updated user with MP openid');
        }
      }
    }

    // Priority 2: Find by openid (if not found by unionid)
    if (!user) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('openid', session.openid)
        .single();
      
      user = data;
      userError = error;
      
      if (user) {
        foundBy = 'openid';
        console.log('Found user by openid:', user.id);
        
        // Update unionid if not set
        if (session.unionid && !user.unionid) {
          await supabase
            .from('users')
            .update({ unionid: session.unionid })
            .eq('id', user.id);
          user.unionid = session.unionid;
          console.log('Updated user with unionid');
        }
      }
    }

    console.log('User lookup result:', { 
      found: !!user, 
      foundBy,
      error: userError ? { code: userError.code, message: userError.message } : null 
    });

    // Create new user if not found
    if (!user && (!userError || userError.code === 'PGRST116')) {
      // Generate unique phone number to avoid unique constraint violation (max 20 chars)
      const uniquePhone = `mp_${session.openid.slice(-12)}`; // mp_ + last 12 chars of openid = 15 chars
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          openid: session.openid,
          unionid: session.unionid || null,
          name: '微信用户',
          phone: uniquePhone,
          wechat_id: 'N/A',
          company: 'N/A',
          role: 'Other',
          main_products: 'N/A',
        })
        .select('*')
        .single();

      if (createError) {
        console.error('Create user error:', createError);
        throw createError;
      }

      console.log('User created successfully:', newUser.id);
      user = newUser;
      foundBy = 'created';
    } else if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // Generate JWT token
    console.log('Generating JWT token for user:', user.id);
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    console.log('Login successful, returning response');
    
    // Log login event
    await logEvent({
      event_type: 'login',
      user_id: user.id,
      event_data: {
        openid: user.openid,
        unionid: user.unionid,
        is_new_user: foundBy === 'created',
        found_by: foundBy,
      },
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
    });
    
    res.json({
      data: {
        token,
        user: {
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
          openid_oa: user.openid_oa || null, // WeChat Official Account unique ID
          avatar_url: user.avatar_url || null, // WeChat avatar URL
          nickname: user.nickname || null, // WeChat nickname
          wechat_nickname: user.wechat_nickname || null, // WeChat nickname from OA
          wechat_avatar_url: user.wechat_avatar_url || null, // WeChat avatar from OA
        },
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      response: error.response?.data,
    });
    res.status(500).json({ 
      error: error.message || 'Login failed',
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        details: error.details,
        hint: error.hint,
        response: error.response?.data,
      } : undefined,
    });
  }
});

/**
 * POST /api/auth/login-email
 * Email/Password login for admin users
 */
router.post('/login-email', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user has a password hash
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Password not set for this account' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Log email login event
    await logEvent({
      event_type: 'login_email',
      user_id: user.id,
      event_data: {
        email: user.email,
      },
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          wechat_id: user.wechat_id,
          company: user.company,
          role: user.role,
          main_products: user.main_products,
          is_admin: user.is_admin || false,
          unionid: user.unionid || null,
          openid: user.openid || null,
          avatar_url: user.avatar_url || null,
          nickname: user.nickname || null,
        },
      },
    });
  } catch (error: any) {
    console.error('Email login error:', error);
    res.status(500).json({ 
      error: error.message || 'Login failed',
    });
  }
});

export default router;
