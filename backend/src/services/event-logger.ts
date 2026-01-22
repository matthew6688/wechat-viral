import { supabase } from '../config/supabase';

export interface EventLogData {
  event_type: string;
  user_id?: string;
  related_user_id?: string;
  event_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Log an event to the event_logs table
 */
export async function logEvent(data: EventLogData): Promise<void> {
  try {
    const { error } = await supabase
      .from('event_logs')
      .insert({
        event_type: data.event_type,
        user_id: data.user_id || null,
        related_user_id: data.related_user_id || null,
        event_data: data.event_data || {},
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || null,
      });

    if (error) {
      console.error('Failed to log event:', error);
      // Don't throw - event logging should not break the main flow
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
