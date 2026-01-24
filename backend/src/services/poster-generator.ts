import sharp from 'sharp';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../config/supabase';
import { getOrCreateCampaignQRCode, getQRCodeImage } from './oa-qrcode';

// Poster cache directory
const POSTER_CACHE_DIR = path.join(__dirname, '../../posters');

// Ensure cache directory exists
if (!fs.existsSync(POSTER_CACHE_DIR)) {
  fs.mkdirSync(POSTER_CACHE_DIR, { recursive: true });
}

export interface CampaignPosterSettings {
  poster_background_url: string;
  poster_avatar_enabled: boolean;
  poster_avatar_shape: 'circle' | 'square';
  poster_avatar_position: { x: number; y: number; size: number };
  poster_nickname_enabled: boolean;
  poster_nickname_position: { x: number; y: number };
  poster_nickname_font_size: number;
  poster_nickname_color: string;
  poster_qrcode_position: { x: number; y: number; size: number };
}

export interface UserInfo {
  id: string;
  name: string;
  wechat_nickname?: string;
  wechat_avatar_url?: string;
}

// Poster dimensions (standard WeChat share image)
const POSTER_WIDTH = 720;
const POSTER_HEIGHT = 1280;

/**
 * Download image from URL with timeout
 */
async function downloadImage(url: string, timeout = 10000): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Failed to download image:', url, error);
    throw new Error(`Failed to download image: ${url}`);
  }
}

/**
 * Generate circular avatar image
 */
async function generateCircularAvatar(avatarUrl: string, size: number): Promise<Buffer> {
  try {
    const avatarBuffer = await downloadImage(avatarUrl);
    
    // Create circular mask using SVG
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
      </svg>`
    );

    return await sharp(avatarBuffer)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  } catch (error) {
    console.error('Error generating circular avatar:', error);
    return generateDefaultAvatar(size, 'circle');
  }
}

/**
 * Generate square avatar image with rounded corners
 */
async function generateSquareAvatar(avatarUrl: string, size: number): Promise<Buffer> {
  try {
    const avatarBuffer = await downloadImage(avatarUrl);
    const borderRadius = Math.round(size * 0.1); // 10% border radius
    
    // Create rounded rectangle mask
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}">
        <rect x="0" y="0" width="${size}" height="${size}" rx="${borderRadius}" ry="${borderRadius}" fill="white"/>
      </svg>`
    );

    return await sharp(avatarBuffer)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  } catch (error) {
    console.error('Error generating square avatar:', error);
    return generateDefaultAvatar(size, 'square');
  }
}

/**
 * Generate default avatar (gradient background)
 */
async function generateDefaultAvatar(size: number, shape: 'circle' | 'square'): Promise<Buffer> {
  // Create a gradient background
  const gradient = Buffer.from(
    `<svg width="${size}" height="${size}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      ${shape === 'circle' 
        ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad)"/>`
        : `<rect x="0" y="0" width="${size}" height="${size}" rx="${size*0.1}" ry="${size*0.1}" fill="url(#grad)"/>`
      }
      <text x="${size/2}" y="${size/2 + size*0.15}" font-size="${size*0.4}" fill="white" text-anchor="middle" font-weight="bold">👤</text>
    </svg>`
  );

  return await sharp(gradient).png().toBuffer();
}

/**
 * Create text overlay SVG for nickname
 */
function createNicknameOverlay(
  nickname: string,
  x: number,
  y: number,
  fontSize: number,
  color: string
): Buffer {
  // Escape special XML characters
  const escapedNickname = nickname
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Add text shadow for better visibility
  const svg = `<svg width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}">
    <style>
      .nickname { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
        font-weight: 600;
      }
    </style>
    <text x="${x}" y="${y}" 
          font-size="${fontSize}" 
          fill="${color}"
          text-anchor="middle"
          class="nickname"
          filter="url(#shadow)">
      <tspan>${escapedNickname}</tspan>
    </text>
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
      </filter>
    </defs>
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Get campaign poster settings
 */
async function getCampaignPosterSettings(campaignId: string): Promise<CampaignPosterSettings | null> {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select(`
      poster_background_url,
      poster_avatar_enabled,
      poster_avatar_shape,
      poster_avatar_position,
      poster_nickname_enabled,
      poster_nickname_position,
      poster_nickname_font_size,
      poster_nickname_color,
      poster_qrcode_position
    `)
    .eq('id', campaignId)
    .single();

  if (error || !campaign) {
    console.error('Failed to get campaign poster settings:', error);
    return null;
  }

  return {
    poster_background_url: campaign.poster_background_url || '',
    poster_avatar_enabled: campaign.poster_avatar_enabled !== false,
    poster_avatar_shape: campaign.poster_avatar_shape || 'circle',
    poster_avatar_position: campaign.poster_avatar_position || { x: 50, y: 12, size: 60 },
    poster_nickname_enabled: campaign.poster_nickname_enabled !== false,
    poster_nickname_position: campaign.poster_nickname_position || { x: 50, y: 22 },
    poster_nickname_font_size: campaign.poster_nickname_font_size || 20,
    poster_nickname_color: campaign.poster_nickname_color || '#FFFFFF',
    poster_qrcode_position: campaign.poster_qrcode_position || { x: 50, y: 80, size: 200 },
  };
}

/**
 * Get user info for poster
 */
async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, wechat_nickname, wechat_avatar_url')
    .eq('id', userId)
    .single();

  if (error || !user) {
    console.error('Failed to get user info:', error);
    return null;
  }

  return user;
}

/**
 * Convert percentage position to pixel position
 */
function percentToPixel(percent: number, dimension: number): number {
  return Math.round((percent / 100) * dimension);
}

/**
 * Get cached poster path
 */
function getCachePath(userId: string, campaignId: string): string {
  return path.join(POSTER_CACHE_DIR, `${campaignId}_${userId}.png`);
}

/**
 * Check if cached poster exists and is valid
 */
async function getCachedPoster(userId: string, campaignId: string): Promise<Buffer | null> {
  const cachePath = getCachePath(userId, campaignId);
  
  if (fs.existsSync(cachePath)) {
    // Check if cache is less than 24 hours old
    const stats = fs.statSync(cachePath);
    const ageMs = Date.now() - stats.mtimeMs;
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
    
    if (ageMs < maxAgeMs) {
      return fs.readFileSync(cachePath);
    }
  }
  
  return null;
}

/**
 * Save poster to cache
 */
function savePosterToCache(userId: string, campaignId: string, buffer: Buffer): void {
  const cachePath = getCachePath(userId, campaignId);
  fs.writeFileSync(cachePath, buffer);
}

/**
 * Generate campaign poster for a user
 */
export async function generateCampaignPoster(
  userId: string,
  campaignId: string,
  forceRegenerate = false
): Promise<{ buffer: Buffer; fromCache: boolean }> {
  // Check cache first
  if (!forceRegenerate) {
    const cached = await getCachedPoster(userId, campaignId);
    if (cached) {
      console.log(`Returning cached poster for user ${userId}, campaign ${campaignId}`);
      return { buffer: cached, fromCache: true };
    }
  }

  // Get campaign settings
  const settings = await getCampaignPosterSettings(campaignId);
  if (!settings) {
    throw new Error('Campaign not found or no poster settings');
  }

  if (!settings.poster_background_url) {
    throw new Error('Campaign has no poster background image');
  }

  // Get user info
  const user = await getUserInfo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Get or create campaign QR code
  const { ticket } = await getOrCreateCampaignQRCode(userId, campaignId);
  const qrBuffer = await getQRCodeImage(ticket);

  // Download background image
  const backgroundBuffer = await downloadImage(settings.poster_background_url);

  // Prepare composite layers
  const composites: sharp.OverlayOptions[] = [];

  // Add avatar if enabled
  if (settings.poster_avatar_enabled) {
    const avatarUrl = user.wechat_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.wechat_nickname || user.name || 'User')}&size=200&background=random`;
    const avatarSize = settings.poster_avatar_position.size;
    
    const avatarBuffer = settings.poster_avatar_shape === 'circle'
      ? await generateCircularAvatar(avatarUrl, avatarSize)
      : await generateSquareAvatar(avatarUrl, avatarSize);

    const avatarX = percentToPixel(settings.poster_avatar_position.x, POSTER_WIDTH) - Math.round(avatarSize / 2);
    const avatarY = percentToPixel(settings.poster_avatar_position.y, POSTER_HEIGHT);

    composites.push({
      input: avatarBuffer,
      left: avatarX,
      top: avatarY,
    });
  }

  // Add nickname if enabled
  if (settings.poster_nickname_enabled) {
    const nickname = user.wechat_nickname || user.name || '微信用户';
    const nicknameX = percentToPixel(settings.poster_nickname_position.x, POSTER_WIDTH);
    const nicknameY = percentToPixel(settings.poster_nickname_position.y, POSTER_HEIGHT);
    
    const nicknameOverlay = createNicknameOverlay(
      nickname,
      nicknameX,
      nicknameY,
      settings.poster_nickname_font_size,
      settings.poster_nickname_color
    );

    composites.push({
      input: nicknameOverlay,
      left: 0,
      top: 0,
    });
  }

  // Add QR code
  // QR code size: use the configured size, but ensure minimum 180px for scannability
  const qrSize = Math.max(settings.poster_qrcode_position.size, 180);
  const qrX = percentToPixel(settings.poster_qrcode_position.x, POSTER_WIDTH) - Math.round(qrSize / 2);
  const qrY = percentToPixel(settings.poster_qrcode_position.y, POSTER_HEIGHT);

  // Resize QR code with nearest-neighbor interpolation to keep sharp edges
  // This is critical for QR code scannability
  const resizedQr = await sharp(qrBuffer)
    .resize(qrSize, qrSize, { 
      kernel: 'nearest',  // Nearest-neighbor keeps QR code crisp
      fit: 'fill'
    })
    .png()
    .toBuffer();

  // Add white background with padding for better visibility and scanning
  const padding = 12;
  const qrWithBg = await sharp({
    create: {
      width: qrSize + padding * 2,
      height: qrSize + padding * 2,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{
      input: resizedQr,
      left: padding,
      top: padding,
    }])
    .png()
    .toBuffer();

  composites.push({
    input: qrWithBg,
    left: qrX - padding,
    top: qrY,
  });

  // Generate final poster
  const poster = await sharp(backgroundBuffer)
    .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: 'cover' })
    .composite(composites)
    .png({ quality: 90 })
    .toBuffer();

  // Save to cache
  savePosterToCache(userId, campaignId, poster);

  console.log(`Generated new poster for user ${userId}, campaign ${campaignId}`);
  return { buffer: poster, fromCache: false };
}

/**
 * Generate poster and return as base64
 */
export async function generateCampaignPosterBase64(
  userId: string,
  campaignId: string,
  forceRegenerate = false
): Promise<{ base64: string; fromCache: boolean }> {
  const { buffer, fromCache } = await generateCampaignPoster(userId, campaignId, forceRegenerate);
  return {
    base64: buffer.toString('base64'),
    fromCache,
  };
}

/**
 * Delete cached poster (e.g., when campaign settings change)
 */
export function deleteCachedPoster(userId: string, campaignId: string): boolean {
  const cachePath = getCachePath(userId, campaignId);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    return true;
  }
  return false;
}

/**
 * Clear all cached posters for a campaign
 */
export function clearCampaignPosterCache(campaignId: string): number {
  let count = 0;
  const files = fs.readdirSync(POSTER_CACHE_DIR);
  
  for (const file of files) {
    if (file.startsWith(`${campaignId}_`)) {
      fs.unlinkSync(path.join(POSTER_CACHE_DIR, file));
      count++;
    }
  }
  
  console.log(`Cleared ${count} cached posters for campaign ${campaignId}`);
  return count;
}

/**
 * Legacy function - Generate poster with default template (for backwards compatibility)
 */
export async function generatePoster(userId: string): Promise<Buffer> {
  // Get user's first campaign
  const { data: participant } = await supabase
    .from('campaign_participants')
    .select('campaign_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!participant) {
    throw new Error('User has no campaign participation');
  }

  const { buffer } = await generateCampaignPoster(userId, participant.campaign_id);
  return buffer;
}

/**
 * Legacy function - Generate poster and return as base64
 */
export async function generatePosterBase64(userId: string): Promise<string> {
  const buffer = await generatePoster(userId);
  return buffer.toString('base64');
}
