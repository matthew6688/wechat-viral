import sharp from 'sharp';
import axios from 'axios';
import { supabase } from '../config/supabase';
import { getOrCreateUserQRCode, getQRCodeImage } from './oa-qrcode';

export interface PosterTemplate {
  id: string;
  name: string;
  background_url: string;
  qr_position_x: number;
  qr_position_y: number;
  qr_size: number;
  name_position_x: number;
  name_position_y: number;
  name_font_size: number;
  name_color: string;
  avatar_position_x: number;
  avatar_position_y: number;
  avatar_size: number;
}

/**
 * Get default poster template
 */
async function getDefaultTemplate(): Promise<PosterTemplate> {
  const { data: template } = await supabase
    .from('poster_templates')
    .select('*')
    .eq('is_default', true)
    .single();

  if (template) {
    return template;
  }

  // Return default template if none exists
  return {
    id: 'default',
    name: 'Default Template',
    background_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=1200&fit=crop',
    qr_position_x: 250,
    qr_position_y: 800,
    qr_size: 300,
    name_position_x: 400,
    name_position_y: 700,
    name_font_size: 32,
    name_color: '#000000',
    avatar_position_x: 400,
    avatar_position_y: 500,
    avatar_size: 120,
  };
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

/**
 * Generate avatar image (circular)
 */
async function generateAvatarImage(avatarUrl: string, size: number): Promise<Buffer> {
  try {
    const avatarBuffer = await downloadImage(avatarUrl);
    
    // Create circular mask
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
      </svg>`
    );

    return await sharp(avatarBuffer)
      .resize(size, size)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  } catch (error) {
    console.error('Error generating avatar:', error);
    // Return default avatar (colored circle with initial)
    return await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 200, g: 200, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  }
}

/**
 * Generate poster with QR code, name, avatar, and background
 */
export async function generatePoster(
  userId: string,
  templateId?: string
): Promise<Buffer> {
  // Get user info
  const { data: user } = await supabase
    .from('users')
    .select('name, openid_oa')
    .eq('id', userId)
    .single();

  if (!user) {
    throw new Error('User not found');
  }

  // Get template
  let template: PosterTemplate;
  if (templateId) {
    const { data, error } = await supabase
      .from('poster_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error || !data) {
      throw new Error('Template not found');
    }
    template = data;
  } else {
    template = await getDefaultTemplate();
  }

  // Get QR code
  const qrCode = await getOrCreateUserQRCode(userId);
  const qrImageBuffer = await getQRCodeImage(qrCode.ticket);

  // Download background
  const backgroundBuffer = await downloadImage(template.background_url);

  // Generate avatar (using default for now, can be enhanced with user avatar URL)
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=${template.avatar_size}&background=random`;
  const avatarBuffer = await generateAvatarImage(avatarUrl, template.avatar_size);

  // Create SVG for text overlay
  const textSvg = Buffer.from(
    `<svg width="800" height="1200">
      <text x="${template.name_position_x}" y="${template.name_position_y}" 
            font-size="${template.name_font_size}" 
            fill="${template.name_color}" 
            font-weight="bold"
            text-anchor="middle">${user.name}</text>
    </svg>`
  );

  // Composite all images
  const poster = await sharp(backgroundBuffer)
    .resize(800, 1200, { fit: 'cover' })
    .composite([
      // Avatar
      {
        input: avatarBuffer,
        left: template.avatar_position_x - template.avatar_size / 2,
        top: template.avatar_position_y - template.avatar_size / 2,
      },
      // QR code
      {
        input: qrImageBuffer,
        left: template.qr_position_x - template.qr_size / 2,
        top: template.qr_position_y - template.qr_size / 2,
      },
      // Name text
      {
        input: textSvg,
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  return poster;
}

/**
 * Generate poster and return as base64
 */
export async function generatePosterBase64(
  userId: string,
  templateId?: string
): Promise<string> {
  const buffer = await generatePoster(userId, templateId);
  return buffer.toString('base64');
}
