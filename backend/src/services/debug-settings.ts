import { supabase } from '../config/supabase';

export interface DebugSetting {
  id: string;
  key: string;
  value: any;
  description?: string;
  updated_by?: string;
  updated_at: string;
  created_at: string;
}

/**
 * Get all debug settings
 */
export async function getDebugSettings(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from('debug_settings')
      .select('*')
      .order('key');

    if (error) {
      // If table doesn't exist, return default settings
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('debug_settings table does not exist, returning default settings');
        return getDefaultSettings();
      }
      console.error('Failed to get debug settings:', error);
      throw error;
    }

    // If no settings found, return defaults
    if (!data || data.length === 0) {
      return getDefaultSettings();
    }

    // Convert array to object with key as property name
    const settings: Record<string, any> = {};
    (data || []).forEach((setting: DebugSetting) => {
      // Parse JSON value if it's a string
      let value = setting.value;
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      settings[setting.key] = value;
    });

    return settings;
  } catch (error: any) {
    console.error('Error in getDebugSettings:', error);
    // Return default settings on any error
    return getDefaultSettings();
  }
}

/**
 * Get default debug settings
 */
function getDefaultSettings(): Record<string, any> {
  return {
    log_level: 'info',
    debug_mode: false,
    event_log_enabled: true,
    api_logging: true,
    error_tracking: true,
    performance_monitoring: false,
    max_log_retention_days: 30,
    show_sensitive_data: false,
  };
}

/**
 * Get a specific debug setting
 */
export async function getDebugSetting(key: string): Promise<any> {
  const { data, error } = await supabase
    .from('debug_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Setting not found
    }
    throw error;
  }

  return data?.value;
}

/**
 * Update a debug setting
 */
export async function updateDebugSetting(
  key: string,
  value: any,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('debug_settings')
    .upsert({
      key,
      value,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key',
    });

  if (error) {
    console.error('Failed to update debug setting:', error);
    throw error;
  }
}

/**
 * Update multiple debug settings
 */
export async function updateDebugSettings(
  settings: Record<string, any>,
  userId?: string
): Promise<void> {
  const updates = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('debug_settings')
    .upsert(updates, {
      onConflict: 'key',
    });

  if (error) {
    console.error('Failed to update debug settings:', error);
    throw error;
  }
}

/**
 * Check if debug mode is enabled
 */
export async function isDebugModeEnabled(): Promise<boolean> {
  const debugMode = await getDebugSetting('debug_mode');
  return debugMode === true || debugMode === 'true';
}

/**
 * Get log level
 */
export async function getLogLevel(): Promise<string> {
  const logLevel = await getDebugSetting('log_level');
  return logLevel || 'info';
}

/**
 * Check if event logging is enabled
 */
export async function isEventLoggingEnabled(): Promise<boolean> {
  const enabled = await getDebugSetting('event_log_enabled');
  return enabled !== false && enabled !== 'false';
}
