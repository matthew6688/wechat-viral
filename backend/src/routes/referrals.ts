import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getUserReferralCode } from '../services/scene';
import { supabase } from '../config/supabase';
import axios from 'axios';
import { wechatConfig, WECHAT_API } from '../config/wechat';

const router = express.Router();

let accessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (accessToken && accessToken.expiresAt > Date.now()) {
    return accessToken.token;
  }

  const { appId, secret } = wechatConfig;
  const response = await axios.get(WECHAT_API.getAccessToken, {
    params: {
      grant_type: 'client_credential',
      appid: appId,
      secret: secret,
    },
  });

  if (response.data.errcode) {
    throw new Error(`WeChat API Error: ${response.data.errmsg}`);
  }

  accessToken = {
    token: response.data.access_token,
    expiresAt: Date.now() + (response.data.expires_in - 60) * 1000,
  };

  return accessToken.token;
}

/**
 * GET /api/referrals/my-code
 * Get user's referral code
 */
router.get('/my-code', authenticate, async (req: AuthRequest, res) => {
  try {
    // Get default activity
    const { data: activity } = await supabase
      .from('activities')
      .select('id')
      .limit(1)
      .single();

    if (!activity) {
      return res.status(404).json({ error: 'No activity found' });
    }

    const shortCode = await getUserReferralCode(req.userId!, activity.id);
    res.json({ data: { shortCode } });
  } catch (error: any) {
    console.error('Get referral code error:', error);
    res.status(500).json({ error: error.message || 'Failed to get referral code' });
  }
});

/**
 * GET /api/referrals/qrcode
 * Generate Mini Program QR code
 */
router.get('/qrcode', authenticate, async (req: AuthRequest, res) => {
  try {
    // Get default activity
    const { data: activity } = await supabase
      .from('activities')
      .select('id')
      .limit(1)
      .single();

    if (!activity) {
      return res.status(404).json({ error: 'No activity found' });
    }

    const token = await getAccessToken();
    const shortCode = await getUserReferralCode(req.userId!, activity.id);

    const response = await axios.post(
      WECHAT_API.getUnlimitedQRCode,
      {
        scene: shortCode,
        page: 'pages/landing/index',
        width: 430,
        auto_color: false,
        line_color: { r: 0, g: 0, b: 0 },
      },
      {
        params: { access_token: token },
        responseType: 'arraybuffer',
      }
    );

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': response.data.length,
    });
    res.send(Buffer.from(response.data));
  } catch (error: any) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate QR code' });
  }
});

export default router;
