import { supabase } from '../config/supabase';

export interface ValidationResult {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'not_configured';
  latency?: number;
  message: string;
  details?: any;
  timestamp: string;
}

export interface EnvironmentValidationReport {
  timestamp: string;
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: ValidationResult;
    wechat_mp: ValidationResult;
    wechat_oa: ValidationResult;
    cloudflare: ValidationResult;
  };
  environment: {
    node_env: string;
    missing_vars: string[];
    optional_vars: string[];
    configured_vars: string[];
  };
  health_score: number; // 0-100
}

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'WECHAT_APPID',
  'WECHAT_SECRET',
  'OA_APPID',
  'OA_SECRET',
];

const OPTIONAL_ENV_VARS = [
  'OA_TOKEN',
  'OA_ENCODING_AES_KEY',
  'PORT',
  'NODE_ENV',
];

/**
 * Validate database connection
 */
export async function validateDatabase(): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // Test basic connection with a simple query
    const { data, error, count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      return {
        status: 'unhealthy',
        latency,
        message: `Database connection failed: ${error.message}`,
        details: { error: error.message, code: error.code },
        timestamp: new Date().toISOString(),
      };
    }

    // Check if required tables exist
    const requiredTables = ['users', 'event_logs', 'debug_settings'];
    const tableChecks = await Promise.all(
      requiredTables.map(async (table) => {
        const { error: tableError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        return { table, exists: !tableError };
      })
    );

    const missingTables = tableChecks.filter((check) => !check.exists).map((check) => check.table);

    if (missingTables.length > 0) {
      return {
        status: 'degraded',
        latency,
        message: `Database connected but missing tables: ${missingTables.join(', ')}`,
        details: { missingTables, tableChecks },
        timestamp: new Date().toISOString(),
      };
    }

    // Get Supabase URL from environment (mask sensitive parts)
    const supabaseUrl = process.env.SUPABASE_URL || '';
    let maskedUrl = 'Not set';
    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        maskedUrl = `${url.protocol}//${url.hostname}${url.pathname}`;
      } catch {
        maskedUrl = supabaseUrl.substring(0, 20) + '...';
      }
    }

    return {
      status: 'healthy',
      latency,
      message: 'Database connection successful',
      details: {
        url: maskedUrl,
        userCount: count || 0,
        tablesChecked: requiredTables,
        responseTime: `${latency}ms`,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return {
      status: 'unhealthy',
      latency,
      message: `Database validation error: ${error.message}`,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validate WeChat Mini Program connection
 */
export async function validateWeChatMiniProgramConnection(): Promise<ValidationResult> {
  try {
    const { validateWeChatMiniProgram } = require('./wechat-validator');
    const result = await validateWeChatMiniProgram();
    return result;
  } catch (error: any) {
    return {
      status: 'unhealthy',
      message: `WeChat Mini Program validation error: ${error.message}`,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validate WeChat Official Account connection
 */
export async function validateWeChatOfficialAccountConnection(): Promise<ValidationResult> {
  try {
    const { validateWeChatOfficialAccount } = require('./wechat-validator');
    const result = await validateWeChatOfficialAccount();
    return result;
  } catch (error: any) {
    return {
      status: 'unhealthy',
      message: `WeChat Official Account validation error: ${error.message}`,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validate Cloudflare tunnel
 */
export async function validateCloudflareTunnel(): Promise<ValidationResult> {
  try {
    const { getCloudflareTunnelInfo } = require('./cloudflare-validator');
    const result = await getCloudflareTunnelInfo();
    return result;
  } catch (error: any) {
    return {
      status: 'not_configured',
      message: `Cloudflare tunnel not detected: ${error.message}`,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check environment variables
 */
export function checkEnvironmentVariables(): {
  missing_vars: string[];
  optional_vars: string[];
  configured_vars: string[];
} {
  const missing: string[] = [];
  const optional: string[] = [];
  const configured: string[] = [];

  // Check required vars
  REQUIRED_ENV_VARS.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      configured.push(varName);
    }
  });

  // Check optional vars
  OPTIONAL_ENV_VARS.forEach((varName) => {
    if (process.env[varName]) {
      optional.push(varName);
      configured.push(varName);
    } else {
      optional.push(varName);
    }
  });

  return {
    missing_vars: missing,
    optional_vars: optional,
    configured_vars: configured,
  };
}

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(services: EnvironmentValidationReport['services']): number {
  let score = 0;
  const serviceCount = Object.keys(services).length;

  Object.values(services).forEach((service) => {
    switch (service.status) {
      case 'healthy':
        score += 25;
        break;
      case 'degraded':
        score += 15;
        break;
      case 'unhealthy':
        score += 5;
        break;
      case 'not_configured':
        score += 0;
        break;
    }
  });

  return Math.round(score);
}

/**
 * Determine overall status
 */
function determineOverallStatus(services: EnvironmentValidationReport['services']): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(services).map((s) => s.status);
  
  if (statuses.every((s) => s === 'healthy')) {
    return 'healthy';
  }
  
  if (statuses.some((s) => s === 'unhealthy')) {
    return 'unhealthy';
  }
  
  return 'degraded';
}

/**
 * Comprehensive environment validation
 */
export async function validateEnvironment(): Promise<EnvironmentValidationReport> {
  const timestamp = new Date().toISOString();

  // Run all validations in parallel
  const { getCloudflareTunnelInfo } = require('./cloudflare-validator');
  const [database, wechatMp, wechatOa, cloudflare] = await Promise.all([
    validateDatabase(),
    validateWeChatMiniProgramConnection(),
    validateWeChatOfficialAccountConnection(),
    getCloudflareTunnelInfo(),
  ]);

  const envCheck = checkEnvironmentVariables();

  const services = {
    database,
    wechat_mp: wechatMp,
    wechat_oa: wechatOa,
    cloudflare,
  };

  const overall_status = determineOverallStatus(services);
  const health_score = calculateHealthScore(services);

  return {
    timestamp,
    overall_status,
    services,
    environment: {
      node_env: process.env.NODE_ENV || 'development',
      missing_vars: envCheck.missing_vars,
      optional_vars: envCheck.optional_vars,
      configured_vars: envCheck.configured_vars,
    },
    health_score,
  };
}
