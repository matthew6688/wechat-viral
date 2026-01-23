import { supabase } from '../config/supabase';

export interface DeviceInfo {
  device_type?: string;    // mobile, tablet, desktop
  device_brand?: string;   // iPhone, Samsung, Huawei, etc.
  os_name?: string;        // iOS, Android, Windows, macOS
  os_version?: string;     // OS version number
  app_version?: string;    // WeChat app version
}

export interface LocationInfo {
  city?: string;
  province?: string;
  country?: string;
}

export interface EventLogData {
  event_type: string;
  user_id?: string;
  related_user_id?: string;
  event_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  source?: string;
  is_test?: boolean;
  // New enhanced fields
  device_info?: DeviceInfo;
  location_info?: LocationInfo;
  session_id?: string;
}

/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return {};
  }

  const info: DeviceInfo = {};

  // Detect device type
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
    if (/iPad|Tablet/i.test(userAgent)) {
      info.device_type = 'tablet';
    } else {
      info.device_type = 'mobile';
    }
  } else {
    info.device_type = 'desktop';
  }

  // Detect device brand
  if (/iPhone/i.test(userAgent)) {
    info.device_brand = 'iPhone';
  } else if (/iPad/i.test(userAgent)) {
    info.device_brand = 'iPad';
  } else if (/HUAWEI|HONOR/i.test(userAgent)) {
    info.device_brand = 'Huawei';
  } else if (/SAMSUNG|SM-/i.test(userAgent)) {
    info.device_brand = 'Samsung';
  } else if (/Xiaomi|MI |Redmi/i.test(userAgent)) {
    info.device_brand = 'Xiaomi';
  } else if (/OPPO/i.test(userAgent)) {
    info.device_brand = 'OPPO';
  } else if (/vivo/i.test(userAgent)) {
    info.device_brand = 'Vivo';
  } else if (/OnePlus/i.test(userAgent)) {
    info.device_brand = 'OnePlus';
  } else if (/Pixel/i.test(userAgent)) {
    info.device_brand = 'Google Pixel';
  }

  // Detect OS
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    info.os_name = 'iOS';
    const iosMatch = userAgent.match(/OS (\d+[._]\d+)/);
    if (iosMatch) {
      info.os_version = iosMatch[1].replace('_', '.');
    }
  } else if (/Android/i.test(userAgent)) {
    info.os_name = 'Android';
    const androidMatch = userAgent.match(/Android (\d+\.?\d*)/);
    if (androidMatch) {
      info.os_version = androidMatch[1];
    }
  } else if (/Windows/i.test(userAgent)) {
    info.os_name = 'Windows';
    const winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    if (winMatch) {
      const versions: Record<string, string> = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
      };
      info.os_version = versions[winMatch[1]] || winMatch[1];
    }
  } else if (/Mac OS X/i.test(userAgent)) {
    info.os_name = 'macOS';
    const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (macMatch) {
      info.os_version = macMatch[1].replace('_', '.');
    }
  }

  // Detect WeChat version
  const wechatMatch = userAgent.match(/MicroMessenger\/(\d+\.\d+\.?\d*)/);
  if (wechatMatch) {
    info.app_version = wechatMatch[1];
  }

  return info;
}

/**
 * Simple IP geolocation (placeholder - in production use a real service)
 * For now, we'll just store the IP and can add geolocation later
 */
export async function getLocationFromIp(ip: string | undefined): Promise<LocationInfo> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { city: 'Local', province: 'Development', country: 'CN' };
  }

  // In production, you could integrate with:
  // - MaxMind GeoIP2
  // - ip-api.com (free tier available)
  // - ipinfo.io
  // For now, return empty and let the frontend handle it
  return {};
}

/**
 * Log an event to the event_logs table and broadcast to SSE clients
 */
export async function logEvent(data: EventLogData): Promise<void> {
  try {
    // Get user info if user_id is provided
    let userName: string | undefined;
    let wechatNickname: string | undefined;
    let wechatAvatar: string | undefined;
    
    if (data.user_id) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('name, phone, wechat_nickname, wechat_avatar_url')
          .eq('id', data.user_id)
          .single();
        if (user) {
          userName = (user as any).name || (user as any).phone || 'Unknown';
          wechatNickname = (user as any).wechat_nickname;
          wechatAvatar = (user as any).wechat_avatar_url;
        }
      } catch (error) {
        // Ignore user lookup errors
      }
    }

    // Parse device info from user agent
    const deviceInfo = data.device_info || parseUserAgent(data.user_agent);

    // Get location from IP (if not provided)
    const locationInfo = data.location_info || await getLocationFromIp(data.ip_address);

    // Insert into database with enhanced fields
    const { error } = await supabase
      .from('event_logs')
      .insert({
        event_type: data.event_type,
        user_id: data.user_id || null,
        related_user_id: data.related_user_id || null,
        event_data: data.event_data || {},
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || null,
        // New enhanced fields
        device_type: deviceInfo.device_type || null,
        device_brand: deviceInfo.device_brand || null,
        os_name: deviceInfo.os_name || null,
        os_version: deviceInfo.os_version || null,
        app_version: deviceInfo.app_version || null,
        location_city: locationInfo.city || null,
        location_province: locationInfo.province || null,
        location_country: locationInfo.country || 'CN',
        session_id: data.session_id || null,
      });

    if (error) {
      console.error('Failed to log event:', error);
      // Don't throw - event logging should not break the main flow
    }

    // Broadcast to SSE clients with enhanced data
    try {
      const { broadcastEvent } = require('./event-stream');
      broadcastEvent({
        event_type: data.event_type,
        timestamp: new Date().toISOString(),
        user_id: data.user_id,
        user_name: userName,
        wechat_nickname: wechatNickname,
        wechat_avatar: wechatAvatar,
        event_data: data.event_data,
        source: data.source || 'system',
        is_test: data.is_test || false,
        // Enhanced fields for real-time display
        device_type: deviceInfo.device_type,
        device_brand: deviceInfo.device_brand,
        os_name: deviceInfo.os_name,
        app_version: deviceInfo.app_version,
        location_city: locationInfo.city,
        location_province: locationInfo.province,
        ip_address: data.ip_address,
      });
    } catch (broadcastError) {
      // Don't throw - SSE broadcasting should not break the main flow
      console.error('Failed to broadcast event:', broadcastError);
    }
  } catch (error) {
    console.error('Error logging event:', error);
    // Don't throw - event logging should not break the main flow
  }
}

/**
 * Get client IP address from request
 */
export function getClientIp(req: any): string | undefined {
  return (
    req.headers['cf-connecting-ip'] ||  // Cloudflare
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    undefined
  );
}

/**
 * Get user agent from request
 */
export function getUserAgent(req: any): string | undefined {
  return req.headers['user-agent'] || undefined;
}

/**
 * Extract all request info for logging
 */
export function extractRequestInfo(req: any): {
  ip_address?: string;
  user_agent?: string;
  device_info: DeviceInfo;
  session_id?: string;
} {
  const ip_address = getClientIp(req);
  const user_agent = getUserAgent(req);
  const device_info = parseUserAgent(user_agent);
  
  // Session ID from cookie or header
  const session_id = req.cookies?.session_id || 
                     req.headers['x-session-id'] ||
                     undefined;

  return {
    ip_address,
    user_agent,
    device_info,
    session_id,
  };
}
