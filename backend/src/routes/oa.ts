import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getOrCreateUserQRCode, getQRCodeImage } from '../services/oa-qrcode';
import {
  parseEventXML,
  verifySignature,
  handleSubscribeEvent,
  handleUnsubscribeEvent,
  handleScanEvent,
} from '../services/oa-events';
import { generatePoster } from '../services/poster-generator';
import { oaConfig } from '../config/wechat';
import { supabase } from '../config/supabase';
import { decryptMessage, decryptEchostr } from '../services/oa-crypto';

const router = express.Router();

// ============================================
// WeChat Webhook Deduplication
// WeChat may retry webhooks if response is slow
// We use a simple in-memory cache to prevent duplicate processing
// ============================================
const processedEvents = new Map<string, number>(); // eventKey -> timestamp
const EVENT_DEDUP_TTL = 60 * 1000; // 60 seconds TTL

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_DEDUP_TTL) {
      processedEvents.delete(key);
    }
  }
}, 30 * 1000); // Clean every 30 seconds

/**
 * Generate a unique key for deduplication
 * Uses: FromUserName + Event + CreateTime (+ EventKey for scans)
 */
function getEventDeduplicationKey(event: any): string {
  const parts = [
    event.FromUserName,
    event.Event,
    event.CreateTime,
    event.EventKey || '',
  ];
  return parts.join('_');
}

/**
 * Check if event was already processed (and mark it if not)
 * Returns true if this is a duplicate, false if it's new
 */
function isDuplicateEvent(event: any): boolean {
  const key = getEventDeduplicationKey(event);
  if (processedEvents.has(key)) {
    console.log(`[Dedup] Skipping duplicate event: ${event.Event} from ${event.FromUserName}`);
    return true;
  }
  processedEvents.set(key, Date.now());
  return false;
}

/**
 * GET /api/oa/wh - Short alias for webhook (to avoid URL truncation)
 * URL verification - supports plaintext, compatible, and security mode
 */
router.get('/wh', async (req, res) => {
  try {
    const { signature, timestamp, nonce, echostr, msg_signature, encrypt_type } = req.query;

    console.log('Webhook verification request (short URL):', { 
      signature, timestamp, nonce, echostr: echostr ? 'present' : 'missing',
      msg_signature, encrypt_type,
      userAgent: req.headers['user-agent']
    });

    if (!signature || !timestamp || !nonce) {
      console.error('Missing required parameters:', { signature: !!signature, timestamp: !!timestamp, nonce: !!nonce });
      return res.status(400).send('Missing required parameters');
    }

    // Verify signature first
    if (!verifySignature(signature as string, timestamp as string, nonce as string, oaConfig.token)) {
      console.error('Invalid signature');
      return res.status(403).send('Invalid signature');
    }

    // If no echostr, return success (some verification methods don't use echostr)
    if (!echostr) {
      console.log('No echostr provided, returning success');
      return res.send('success');
    }

    // Handle security mode (encrypted echostr)
    if (encrypt_type === 'aes' && msg_signature && oaConfig.encodingAESKey) {
      try {
        const decryptedEchostr = decryptEchostr(
          echostr as string,
          msg_signature as string,
          timestamp as string,
          nonce as string
        );
        console.log('Echostr decrypted successfully (security mode)');
        return res.send(decryptedEchostr);
      } catch (error: any) {
        console.error('Failed to decrypt echostr:', error);
        // In compatible mode, try plaintext echostr as fallback
        if (encrypt_type === 'compatible') {
          console.log('Compatible mode: trying plaintext echostr');
          return res.send(echostr);
        }
        return res.status(500).send('Failed to decrypt echostr');
      }
    }

    // Plaintext mode or compatible mode - return echostr directly
    console.log('Signature verified successfully, returning echostr (plaintext/compatible mode)');
    return res.send(echostr);
  } catch (error: any) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * POST /api/oa/wh - Short alias for webhook (to avoid URL truncation)
 * Event push - supports plaintext, compatible, and security mode
 */
router.post('/wh', express.text({ type: 'text/xml' }), async (req, res) => {
  try {
    const { signature, timestamp, nonce, msg_signature, encrypt_type } = req.query;

    console.log('Webhook event push (short URL):', { 
      signature, timestamp, nonce, 
      msg_signature, encrypt_type,
      bodyLength: req.body?.length,
      userAgent: req.headers['user-agent']
    });

    // Verify signature for POST requests
    if (!verifySignature(signature as string, timestamp as string, nonce as string, oaConfig.token)) {
      console.error('Invalid signature:', { signature, timestamp, nonce });
      return res.status(403).send('Invalid signature');
    }

    let xmlBody = req.body;

    // Handle security/compatible mode (encrypted message)
    if ((encrypt_type === 'aes' || encrypt_type === 'compatible') && msg_signature && oaConfig.encodingAESKey) {
      try {
        // Parse encrypted XML to get encrypted content
        const { parseString } = require('xml2js');
        const parseXML = require('util').promisify(parseString);
        const parsed = await parseXML(xmlBody);
        
        if (parsed.xml && parsed.xml.Encrypt && parsed.xml.Encrypt[0]) {
          const encryptedMsg = parsed.xml.Encrypt[0];
          const decryptedMsg = decryptMessage(
            encryptedMsg,
            msg_signature as string,
            timestamp as string,
            nonce as string
          );
          xmlBody = decryptedMsg;
          console.log('Message decrypted successfully (security/compatible mode)');
        }
      } catch (error: any) {
        console.error('Failed to decrypt message:', error);
        // In compatible mode, try plaintext as fallback
        if (encrypt_type === 'compatible') {
          console.log('Compatible mode: trying plaintext message');
          // xmlBody remains as req.body
        } else {
          return res.status(500).send('Failed to decrypt message');
        }
      }
    }

    // Parse XML
    const event = await parseEventXML(xmlBody);

    // Check for duplicate events (WeChat may retry webhooks)
    if (isDuplicateEvent(event)) {
      res.set('Content-Type', 'text/xml');
      return res.send('success');
    }

    let reply = '';

    // Handle different event types
    switch (event.Event) {
      case 'subscribe':
        reply = await handleSubscribeEvent(event);
        break;
      case 'unsubscribe':
        await handleUnsubscribeEvent(event);
        reply = 'success';
        break;
      case 'SCAN':
        reply = await handleScanEvent(event);
        break;
      default:
        reply = 'success';
    }

    // If security mode, encrypt reply
    if (encrypt_type === 'aes' && oaConfig.encodingAESKey && timestamp && nonce) {
      try {
        const { encryptMessage } = require('../services/oa-crypto');
        const { encrypted, signature: replySignature } = encryptMessage(reply, timestamp as string, nonce as string);
        reply = `<xml>
          <Encrypt><![CDATA[${encrypted}]]></Encrypt>
          <MsgSignature><![CDATA[${replySignature}]]></MsgSignature>
          <TimeStamp>${timestamp}</TimeStamp>
          <Nonce><![CDATA[${nonce}]]></Nonce>
        </xml>`;
      } catch (error: any) {
        console.error('Failed to encrypt reply:', error);
        // Fall back to plaintext
      }
    }

    res.set('Content-Type', 'text/xml');
    return res.send(reply);
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/oa/webhook
 * URL verification (WeChat server validation) - supports plaintext, compatible, and security mode
 */
router.get('/webhook', async (req, res) => {
  try {
    const { signature, timestamp, nonce, echostr, msg_signature, encrypt_type } = req.query;

    console.log('Webhook verification request:', { 
      signature, timestamp, nonce, echostr: echostr ? 'present' : 'missing',
      msg_signature, encrypt_type,
      userAgent: req.headers['user-agent']
    });

    if (!signature || !timestamp || !nonce) {
      console.error('Missing required parameters');
      return res.status(400).send('Missing required parameters');
    }

    // Verify signature
    if (!verifySignature(signature as string, timestamp as string, nonce as string, oaConfig.token)) {
      console.error('Invalid signature');
      return res.status(403).send('Invalid signature');
    }

    // If no echostr, return success
    if (!echostr) {
      console.log('No echostr provided, returning success');
      return res.send('success');
    }

    // Handle security mode (encrypted echostr)
    if (encrypt_type === 'aes' && msg_signature && oaConfig.encodingAESKey) {
      try {
        const decryptedEchostr = decryptEchostr(
          echostr as string,
          msg_signature as string,
          timestamp as string,
          nonce as string
        );
        console.log('Echostr decrypted successfully (security mode)');
        return res.send(decryptedEchostr);
      } catch (error: any) {
        console.error('Failed to decrypt echostr:', error);
        // In compatible mode, try plaintext echostr as fallback
        if (encrypt_type === 'compatible') {
          console.log('Compatible mode: trying plaintext echostr');
          return res.send(echostr);
        }
        return res.status(500).send('Failed to decrypt echostr');
      }
    }

    // Plaintext mode or compatible mode - return echostr directly
    console.log('Signature verified successfully, returning echostr (plaintext/compatible mode)');
    return res.send(echostr);
  } catch (error: any) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * POST /api/oa/webhook
 * Receive WeChat event push - supports plaintext, compatible, and security mode
 */
router.post('/webhook', express.text({ type: 'text/xml' }), async (req, res) => {
  try {
    const { signature, timestamp, nonce, msg_signature, encrypt_type } = req.query;

    console.log('Webhook event push:', { 
      signature, timestamp, nonce, 
      msg_signature, encrypt_type,
      bodyLength: req.body?.length,
      userAgent: req.headers['user-agent']
    });

    // Verify signature for POST requests
    if (!verifySignature(signature as string, timestamp as string, nonce as string, oaConfig.token)) {
      console.error('Invalid signature:', { signature, timestamp, nonce });
      return res.status(403).send('Invalid signature');
    }

    let xmlBody = req.body;

    // Handle security/compatible mode (encrypted message)
    if ((encrypt_type === 'aes' || encrypt_type === 'compatible') && msg_signature && oaConfig.encodingAESKey) {
      try {
        // Parse encrypted XML to get encrypted content
        const { parseString } = require('xml2js');
        const parseXML = require('util').promisify(parseString);
        const parsed = await parseXML(xmlBody);
        
        if (parsed.xml && parsed.xml.Encrypt && parsed.xml.Encrypt[0]) {
          const encryptedMsg = parsed.xml.Encrypt[0];
          const decryptedMsg = decryptMessage(
            encryptedMsg,
            msg_signature as string,
            timestamp as string,
            nonce as string
          );
          xmlBody = decryptedMsg;
          console.log('Message decrypted successfully (security/compatible mode)');
        }
      } catch (error: any) {
        console.error('Failed to decrypt message:', error);
        // In compatible mode, try plaintext as fallback
        if (encrypt_type === 'compatible') {
          console.log('Compatible mode: trying plaintext message');
          // xmlBody remains as req.body
        } else {
          return res.status(500).send('Failed to decrypt message');
        }
      }
    }

    // Parse XML
    const event = await parseEventXML(xmlBody);

    // Check for duplicate events (WeChat may retry webhooks)
    if (isDuplicateEvent(event)) {
      res.set('Content-Type', 'text/xml');
      return res.send('success');
    }

    let reply = '';

    // Handle different event types
    switch (event.Event) {
      case 'subscribe':
        reply = await handleSubscribeEvent(event);
        break;
      case 'unsubscribe':
        await handleUnsubscribeEvent(event);
        reply = 'success';
        break;
      case 'SCAN':
        reply = await handleScanEvent(event);
        break;
      default:
        reply = 'success';
    }

    // If security mode, encrypt reply
    if (encrypt_type === 'aes' && oaConfig.encodingAESKey && timestamp && nonce) {
      try {
        const { encryptMessage } = require('../services/oa-crypto');
        const { encrypted, signature: replySignature } = encryptMessage(reply, timestamp as string, nonce as string);
        reply = `<xml>
          <Encrypt><![CDATA[${encrypted}]]></Encrypt>
          <MsgSignature><![CDATA[${replySignature}]]></MsgSignature>
          <TimeStamp>${timestamp}</TimeStamp>
          <Nonce><![CDATA[${nonce}]]></Nonce>
        </xml>`;
      } catch (error: any) {
        console.error('Failed to encrypt reply:', error);
        // Fall back to plaintext
      }
    }

    res.set('Content-Type', 'text/xml');
    return res.send(reply);
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/oa/poster-templates
 * Get poster templates (accessible to all authenticated users)
 * NOTE: This route must be before /qrcode/:userId to avoid route conflicts
 */
router.get('/poster-templates', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: templates, error } = await supabase
      .from('poster_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data: { templates: templates || [] } });
  } catch (error: any) {
    console.error('Get poster templates error:', error);
    res.status(500).json({ error: error.message || 'Failed to get poster templates' });
  }
});

/**
 * GET /api/oa/poster-templates
 * Get poster templates (accessible to all authenticated users)
 * NOTE: Must be before /qrcode/:userId to avoid route conflicts
 */
router.get('/poster-templates', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data: templates, error } = await supabase
      .from('poster_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data: { templates: templates || [] } });
  } catch (error: any) {
    console.error('Get poster templates error:', error);
    res.status(500).json({ error: error.message || 'Failed to get poster templates' });
  }
});

/**
 * GET /api/oa/qrcode/:userId
 * Get user's Official Account QR code
 */
router.get('/qrcode/:userId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.userId;

    // Check if user is requesting their own QR code or is admin
    if (userId !== req.userId) {
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', req.userId)
        .single();

      if (!user?.is_admin) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const qrCode = await getOrCreateUserQRCode(userId);

    res.json({
      ticket: qrCode.ticket,
      url: qrCode.url,
      sceneStr: qrCode.sceneStr,
    });
  } catch (error: any) {
    console.error('Get QR code error:', error);
    res.status(500).json({ error: error.message || 'Failed to get QR code' });
  }
});

/**
 * GET /api/oa/qrcode-image/:ticket
 * Get QR code image
 */
router.get('/qrcode-image/:ticket', async (req, res) => {
  try {
    const { ticket } = req.params;
    const imageBuffer = await getQRCodeImage(ticket);

    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (error: any) {
    console.error('Get QR code image error:', error);
    res.status(500).json({ error: error.message || 'Failed to get QR code image' });
  }
});

/**
 * POST /api/oa/poster/:userId
 * Generate poster for user
 */
router.post('/poster/:userId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.userId;
    const { templateId } = req.body;

    // Check if user is requesting their own poster or is admin
    if (userId !== req.userId) {
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', req.userId!)
        .single();

      if (!user || !user.is_admin) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const templateIdParam = req.body?.templateId || req.query?.templateId as string | undefined;
    const posterBuffer = await generatePoster(userId, templateIdParam);

    res.set('Content-Type', 'image/png');
    res.send(posterBuffer);
  } catch (error: any) {
    console.error('Generate poster error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate poster' });
  }
});

/**
 * GET /api/oa/poster/:userId
 * Get poster for user
 */
router.get('/poster/:userId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.userId;
    const { templateId } = req.query;

    // Check if user is requesting their own poster or is admin
    if (userId !== req.userId) {
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', req.userId!)
        .single();

      if (!user || !user.is_admin) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const templateIdParam = templateId as string | undefined;
    const posterBuffer = await generatePoster(userId, templateIdParam);

    res.set('Content-Type', 'image/png');
    res.send(posterBuffer);
  } catch (error: any) {
    console.error('Get poster error:', error);
    res.status(500).json({ error: error.message || 'Failed to get poster' });
  }
});

export default router;
