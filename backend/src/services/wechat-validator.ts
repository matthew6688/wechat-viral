import axios from 'axios';
import { wechatConfig, oaConfig, WECHAT_API, OA_API } from '../config/wechat';
import { ValidationResult } from './environment-validator';

/**
 * Validate WeChat Mini Program API connection
 */
export async function validateWeChatMiniProgram(): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    // Check if credentials are configured
    if (!wechatConfig.appId || !wechatConfig.secret) {
      return {
        status: 'not_configured',
        message: 'WeChat Mini Program credentials not configured',
        details: {
          appId: wechatConfig.appId || 'missing',
          secret: wechatConfig.secret ? '***configured***' : 'missing',
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Test API endpoint with invalid code (should return error but confirm connection)
    // We use an invalid code to test connectivity without creating actual sessions
    const testCode = 'test_invalid_code_for_validation';
    
    try {
      const response = await axios.get(WECHAT_API.code2Session, {
        params: {
          appid: wechatConfig.appId,
          secret: wechatConfig.secret,
          js_code: testCode,
          grant_type: 'authorization_code',
        },
        timeout: 5000, // 5 second timeout
      });

      const latency = Date.now() - startTime;

      // If we get a response, even with an error code, the API is reachable
      if (response.data.errcode) {
        // Expected: invalid code error (40029 or similar)
        // This confirms the API is reachable and credentials work
        if (response.data.errcode === 40029 || response.data.errcode === 40163) {
          return {
            status: 'healthy',
            latency,
            message: 'WeChat Mini Program API is reachable and credentials are valid',
            details: {
              appId: wechatConfig.appId,
              errcode: response.data.errcode,
              errmsg: response.data.errmsg,
              responseTime: `${latency}ms`,
              note: 'Invalid code error is expected for validation test',
            },
            timestamp: new Date().toISOString(),
          };
        }

        // Other errors might indicate credential issues
        return {
          status: 'degraded',
          latency,
          message: `WeChat Mini Program API returned error: ${response.data.errmsg}`,
          details: {
            errcode: response.data.errcode,
            errmsg: response.data.errmsg,
            responseTime: `${latency}ms`,
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Unexpected: got valid response (shouldn't happen with test code)
      return {
        status: 'healthy',
        latency,
        message: 'WeChat Mini Program API is reachable',
        details: {
          responseTime: `${latency}ms`,
          note: 'Unexpected valid response with test code',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (axiosError: any) {
      const latency = Date.now() - startTime;

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
        return {
          status: 'unhealthy',
          latency,
          message: 'Cannot reach WeChat Mini Program API',
          details: {
            error: axiosError.message,
            code: axiosError.code,
            responseTime: `${latency}ms`,
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Network or other errors
      return {
        status: 'unhealthy',
        latency,
        message: `WeChat Mini Program API error: ${axiosError.message}`,
        details: {
          error: axiosError.message,
          responseTime: `${latency}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    }
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
 * Validate WeChat Official Account API connection
 */
export async function validateWeChatOfficialAccount(): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    // Check if credentials are configured
    if (!oaConfig.appId || !oaConfig.secret) {
      return {
        status: 'not_configured',
        message: 'WeChat Official Account credentials not configured',
        details: {
          appId: oaConfig.appId || 'missing',
          secret: oaConfig.secret ? '***configured***' : 'missing',
          token: oaConfig.token ? '***configured***' : 'missing',
          encodingAESKey: oaConfig.encodingAESKey ? '***configured***' : 'missing',
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Test access token retrieval
    try {
      const response = await axios.get(OA_API.getAccessToken, {
        params: {
          grant_type: 'client_credential',
          appid: oaConfig.appId,
          secret: oaConfig.secret,
        },
        timeout: 5000, // 5 second timeout
      });

      const latency = Date.now() - startTime;

      if (response.data.errcode) {
        return {
          status: 'unhealthy',
          latency,
          message: `WeChat Official Account API error: ${response.data.errmsg}`,
          details: {
            errcode: response.data.errcode,
            errmsg: response.data.errmsg,
            responseTime: `${latency}ms`,
            possibleCauses: {
              40013: 'Invalid AppID',
              40125: 'Invalid AppSecret',
              40164: 'IP not whitelisted',
            }[response.data.errcode] || 'Unknown error',
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (response.data.access_token) {
        return {
          status: 'healthy',
          latency,
          message: 'WeChat Official Account API is reachable and credentials are valid',
          details: {
            appId: oaConfig.appId,
            accessTokenLength: response.data.access_token.length,
            expiresIn: `${response.data.expires_in}s`,
            responseTime: `${latency}ms`,
            note: 'Access token retrieved successfully',
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: 'degraded',
        latency,
        message: 'WeChat Official Account API responded but no access token',
        details: {
          response: response.data,
          responseTime: `${latency}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (axiosError: any) {
      const latency = Date.now() - startTime;

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
        return {
          status: 'unhealthy',
          latency,
          message: 'Cannot reach WeChat Official Account API',
          details: {
            error: axiosError.message,
            code: axiosError.code,
            responseTime: `${latency}ms`,
            suggestion: 'Check network connection and IP whitelist settings',
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: 'unhealthy',
        latency,
        message: `WeChat Official Account API error: ${axiosError.message}`,
        details: {
          error: axiosError.message,
          responseTime: `${latency}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    }
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
 * Validate webhook signature verification
 */
export function validateWebhookSignature(
  signature: string,
  timestamp: string,
  nonce: string,
  token: string
): boolean {
  // This is a helper function - actual verification is done in oa-crypto.ts
  // This just checks if token is configured
  return !!token && token.length > 0;
}
