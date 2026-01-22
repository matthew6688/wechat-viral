import { supabase } from '../config/supabase';

export interface EventLogData {
  event_type: string;
  user_id?: string;
  related_user_id?: string;
  event_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  source?: string;
  is_test?: boolean;
}

/**
 * Log an event to the event_logs table and broadcast to SSE clients
 */
export async function logEvent(data: EventLogData): Promise<void> {
  try {
    // Get user name if user_id is provided
    let userName: string | undefined;
    if (data.user_id) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('name, phone')
          .eq('id', data.user_id)
          .single();
        if (user) {
          userName = user.name || user.phone || 'Unknown';
        }
      } catch (error) {
        // Ignore user lookup errors
      }
    }

    // Insert into database
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

    // Broadcast to SSE clients
    try {
      const { broadcastEvent } = require('./event-stream');
      broadcastEvent({
        event_type: data.event_type,
        timestamp: new Date().toISOString(),
        user_id: data.user_id,
        user_name: userName,
        event_data: data.event_data,
        source: data.source || 'system',
        is_test: data.is_test || false,
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
