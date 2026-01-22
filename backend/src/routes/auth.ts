import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { code2Session } from '../services/wechat';
import { supabase } from '../config/supabase';
import { logEvent, getClientIp, getUserAgent } from '../services/event-logger';

const router = express.Router();

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

    // Find or create user
    console.log('Looking up user with openid:', session.openid);
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('openid', session.openid)
      .single();
    
    console.log('User lookup result:', { 
      found: !!user, 
      error: userError ? { code: userError.code, message: userError.message } : null 
    });

    if (userError && userError.code === 'PGRST116') {
      // User not found, create new user
      // Generate unique phone number to avoid unique constraint violation
      const uniquePhone = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
    } else if (userError) {
      throw userError;
    } else if (user && session.unionid && !user.unionid) {
      // Update unionid if available
      await supabase
        .from('users')
        .update({ unionid: session.unionid })
        .eq('id', user.id);
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
        is_new_user: userError && userError.code === 'PGRST116',
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
          avatar_url: user.avatar_url || null, // WeChat avatar URL
          nickname: user.nickname || null, // WeChat nickname
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
