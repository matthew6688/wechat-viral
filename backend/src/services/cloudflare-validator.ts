import { Request } from 'express';
import axios from 'axios';
import { supabase } from '../config/supabase';
import { ValidationResult } from './environment-validator';

/**
 * Get Cloudflare tunnel information from request headers
 */
export function getCloudflareTunnelInfoFromRequest(req?: Request): {
  url: string | null;
  hostname: string | null;
  protocol: string;
  detected: boolean;
} {
  if (!req) {
    return {
      url: null,
      hostname: null,
      protocol: 'http',
      detected: false,
    };
  }

  // Check various headers that Cloudflare tunnel might set
  const forwardedHost = req.headers['x-forwarded-host'] as string;
  const originalHost = req.headers['x-original-host'] as string;
  const host = req.headers['host'] as string;
  const forwardedProto = req.headers['x-forwarded-proto'] as string || 'https';
  const cfHost = req.headers['cf-host'] as string;

  // Priority: x-forwarded-host > x-original-host > host
  const detectedHostname = forwardedHost || originalHost || cfHost || host;

  if (!detectedHostname) {
    return {
      url: null,
      hostname: null,
      protocol: forwardedProto,
      detected: false,
    };
  }

  // Check if it's a Cloudflare tunnel URL (trycloudflare.com or custom domain)
  const isCloudflareTunnel = 
    detectedHostname.includes('trycloudflare.com') ||
    detectedHostname.includes('cloudflare') ||
    forwardedHost !== undefined; // If x-forwarded-host is set, likely a tunnel

  const protocol = forwardedProto || (isCloudflareTunnel ? 'https' : 'http');
  const url = `${protocol}://${detectedHostname}`;

  return {
    url,
    hostname: detectedHostname,
    protocol,
    detected: isCloudflareTunnel,
  };
}

/**
 * Validate Cloudflare tunnel connectivity
 */
export async function validateCloudflareTunnel(url: string): Promise<{
  accessible: boolean;
  latency?: number;
  httpsValid: boolean;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Test if the URL is accessible
    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: (status) => status < 500, // Accept any status < 500
    });

    const latency = Date.now() - startTime;
    const httpsValid = url.startsWith('https://');

    return {
      accessible: true,
      latency,
      httpsValid,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;

    return {
      accessible: false,
      latency,
      httpsValid: url.startsWith('https://'),
      error: error.message,
    };
  }
}

/**
 * Get Cloudflare tunnel validation result
 */
export async function getCloudflareTunnelInfo(): Promise<ValidationResult> {
  try {
    // Try to get from environment variable first
    const envUrl = process.env.CLOUDFLARE_TUNNEL_URL;
    
    // Also try to get from database
    const storedUrl = await getStoredTunnelUrl();
    
    // Prefer env var, fallback to stored URL
    const url = envUrl || storedUrl;

    if (url) {
      const validation = await validateCloudflareTunnel(url);
      
      if (validation.accessible) {
        return {
          status: 'healthy',
          latency: validation.latency,
          message: 'Cloudflare tunnel is active and accessible',
          details: {
            url: url,
            httpsValid: validation.httpsValid,
            responseTime: `${validation.latency}ms`,
            source: envUrl ? 'environment_variable' : 'database',
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: 'degraded',
        latency: validation.latency,
        message: 'Cloudflare tunnel URL configured but not accessible',
        details: {
          url: url,
          error: validation.error,
          responseTime: `${validation.latency}ms`,
          source: envUrl ? 'environment_variable' : 'database',
        },
        timestamp: new Date().toISOString(),
      };
    }

    // If no URL found, return not configured
    return {
      status: 'not_configured',
      message: 'Cloudflare tunnel URL not detected. Set CLOUDFLARE_TUNNEL_URL environment variable, save URL via dashboard, or ensure tunnel is running.',
      details: {
        suggestion: 'Run: cloudflared tunnel --url http://localhost:3000',
        note: 'Tunnel URL will be detected from request headers when accessed via tunnel',
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: 'not_configured',
      message: `Cloudflare tunnel validation error: ${error.message}`,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get Cloudflare tunnel URL from request (for runtime detection)
 */
export function getCloudflareTunnelUrlFromRequest(req: Request): string | null {
  const info = getCloudflareTunnelInfoFromRequest(req);
  return info.url;
}

/**
 * Get stored tunnel URL from database
 */
export async function getStoredTunnelUrl(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('tunnel_config')
      .select('url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found
        return null;
      }
      // Table might not exist yet
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return null;
      }
      throw error;
    }

    return data?.url || null;
  } catch (error: any) {
    // Table might not exist - return null gracefully
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return null;
    }
    console.error('Failed to get stored tunnel URL:', error);
    return null;
  }
}

/**
 * Update tunnel URL in database
 */
export async function updateTunnelUrl(url: string, userId?: string): Promise<void> {
  try {
    // Validate URL format
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      throw new Error('Invalid URL format. Must start with http:// or https://');
    }

    // Check if table exists, if not, we can't store the URL
    try {
      // Check if record exists
      const { data: existing, error: selectError } = await supabase
        .from('tunnel_config')
        .select('id')
        .limit(1)
        .single();

      const tunnelData: any = {
        url,
        verified: false,
        updated_at: new Date().toISOString(),
      };

      if (userId) {
        tunnelData.updated_by = userId;
      }

      if (selectError && selectError.code === 'PGRST116') {
        // No record found, insert new
        const { error: insertError } = await supabase.from('tunnel_config').insert(tunnelData);
        if (insertError) throw insertError;
      } else if (existing) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('tunnel_config')
          .update(tunnelData)
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase.from('tunnel_config').insert(tunnelData);
        if (insertError) throw insertError;
      }
    } catch (dbError: any) {
      // Table might not exist
      if (dbError.code === '42P01' || dbError.message?.includes('does not exist')) {
        throw new Error('tunnel_config table does not exist. Please run migration 009_add_tunnel_config.sql');
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Failed to update tunnel URL:', error);
    throw error;
  }
}

/**
 * Test tunnel connection and update verification status
 */
export async function testTunnelConnection(url: string): Promise<{
  accessible: boolean;
  latency?: number;
  httpsValid: boolean;
  error?: string;
}> {
  const result = await validateCloudflareTunnel(url);

  // Update verification status in database
  try {
    const { data: existing } = await supabase
      .from('tunnel_config')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from('tunnel_config')
        .update({
          verified: result.accessible,
          last_checked: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }
  } catch (error) {
    console.error('Failed to update tunnel verification status:', error);
  }

  return result;
}

/**
 * Get tunnel status with stored URL and verification
 */
export async function getTunnelStatus(): Promise<{
  url: string | null;
  verified: boolean;
  last_checked: string | null;
  status: 'connected' | 'disconnected' | 'not_configured';
}> {
  try {
    const storedUrl = await getStoredTunnelUrl();

    if (!storedUrl) {
      return {
        url: null,
        verified: false,
        last_checked: null,
        status: 'not_configured',
      };
    }

    // Get verification status from database
    // Handle case where table might not exist yet
    try {
      const { data, error } = await supabase
        .from('tunnel_config')
        .select('verified, last_checked')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned", which is fine
        throw error;
      }

      return {
        url: storedUrl,
        verified: data?.verified || false,
        last_checked: data?.last_checked || null,
        status: data?.verified ? 'connected' : 'disconnected',
      };
    } catch (dbError: any) {
      // Table might not exist - return with stored URL but unverified
      if (dbError.code === '42P01' || dbError.message?.includes('does not exist')) {
        return {
          url: storedUrl,
          verified: false,
          last_checked: null,
          status: 'disconnected',
        };
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Failed to get tunnel status:', error);
    return {
      url: null,
      verified: false,
      last_checked: null,
      status: 'not_configured',
    };
  }
}

/**
 * Validate local tunnel setup
 * Checks if local server is running, cloudflared process, and tunnel connectivity
 */
export async function validateLocalTunnel(): Promise<{
  local_server: {
    running: boolean;
    port: number;
    accessible: boolean;
    error?: string;
  };
  cloudflared: {
    running: boolean;
    process_id?: number;
    error?: string;
  };
  tunnel_url: {
    configured: boolean;
    url: string | null;
    accessible: boolean;
    latency?: number;
    error?: string;
  };
  command: {
    to_run: string;
    expected_output: string[];
    instructions: string[];
  };
  overall_status: 'ready' | 'needs_tunnel' | 'needs_server' | 'needs_both';
}> {
  const result = {
    local_server: {
      running: false,
      port: 3000,
      accessible: false,
    },
    cloudflared: {
      running: false,
    },
    tunnel_url: {
      configured: false,
      url: null as string | null,
      accessible: false,
    },
    command: {
      to_run: 'cloudflared tunnel --url http://localhost:3000',
      expected_output: [
        '+--------------------------------------------------------------------------------------------+',
        '| Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |',
        '|  https://xxx-xxx-xxx-xxx.trycloudflare.com                                              |',
        '+--------------------------------------------------------------------------------------------+',
      ],
      instructions: [
        '1. Open a new terminal window',
        '2. Run the command shown above',
        '3. Copy the HTTPS URL from the output',
        '4. Paste it in the "Quick Update" field below',
        '5. Click "Save & Verify"',
        '6. Click "Validate Connection" again to confirm',
      ],
    },
    overall_status: 'needs_both' as const,
  };

  // Check if local server is running
  try {
    const response = await axios.get('http://localhost:3000', {
      timeout: 2000,
      validateStatus: () => true, // Accept any status
    });
    result.local_server.running = true;
    result.local_server.accessible = response.status < 500;
  } catch (error: any) {
    result.local_server.error = error.message || 'Connection refused';
  }

  // Check if cloudflared process is running
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Check for cloudflared process (works on macOS/Linux)
    const { stdout } = await execAsync('ps aux | grep cloudflared | grep -v grep || true');
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n');
      const firstLine = lines[0];
      const pidMatch = firstLine.match(/^\S+\s+(\d+)/);
      if (pidMatch) {
        result.cloudflared.running = true;
        result.cloudflared.process_id = parseInt(pidMatch[1]);
      }
    }
  } catch (error: any) {
    result.cloudflared.error = error.message || 'Could not check process';
  }

  // Check tunnel URL
  const storedUrl = await getStoredTunnelUrl();
  if (storedUrl) {
    result.tunnel_url.configured = true;
    result.tunnel_url.url = storedUrl;
    
    // Test tunnel URL accessibility
    try {
      const testResult = await validateCloudflareTunnel(storedUrl);
      result.tunnel_url.accessible = testResult.accessible;
      result.tunnel_url.latency = testResult.latency;
      if (!testResult.accessible) {
        result.tunnel_url.error = testResult.error;
      }
    } catch (error: any) {
      result.tunnel_url.error = error.message;
    }
  }

  // Determine overall status
  if (result.local_server.running && result.tunnel_url.configured && result.tunnel_url.accessible) {
    result.overall_status = 'ready';
  } else if (!result.local_server.running && !result.tunnel_url.configured) {
    result.overall_status = 'needs_both';
  } else if (!result.local_server.running) {
    result.overall_status = 'needs_server';
  } else {
    result.overall_status = 'needs_tunnel';
  }

  return result;
}
