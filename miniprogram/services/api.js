// services/api.js
const config = require('../utils/config');
// 使用 getter 确保每次获取都是最新的 URL
const getApiBaseUrl = () => config.API_BASE_URL;

// Storage utility
const storage = {
  getToken() {
    return wx.getStorageSync('token') || '';
  },
  setToken(token) {
    wx.setStorageSync('token', token);
  },
  removeToken() {
    wx.removeStorageSync('token');
  },
  getUser() {
    return wx.getStorageSync('user') || null;
  },
  setUser(user) {
    wx.setStorageSync('user', user);
  },
  removeUser() {
    wx.removeStorageSync('user');
  },
};

const api = {
  async request(url, options = {}) {
    // 动态获取 API_BASE_URL（确保每次都是最新的）
    const API_BASE_URL = getApiBaseUrl();
    
    // Check if API_BASE_URL is valid
    if (!API_BASE_URL || API_BASE_URL.includes('invalid-tunnel-url')) {
      const error = new Error('Tunnel URL not configured. Please check Supabase tunnel_config table.');
      error.errMsg = 'Tunnel URL not configured';
      console.error('[API] ❌ Cannot make request - API_BASE_URL is invalid:', API_BASE_URL);
      console.error('[API] Please ensure tunnel_config table in Supabase has a valid URL');
      
      // Try to refresh tunnel URL one more time
      try {
        const { forceRefreshTunnelUrl } = require('../utils/config');
        const newUrl = await forceRefreshTunnelUrl();
        if (newUrl) {
          console.log('[API] ✅ Successfully refreshed tunnel URL, retrying request...');
          // Update API_BASE_URL for this request
          const updatedBaseUrl = newUrl.endsWith('/') ? newUrl.slice(0, -1) + '/api' : newUrl + '/api';
          // Continue with the request using the new URL
          return this.request(url, { ...options, _baseUrl: updatedBaseUrl });
        }
      } catch (refreshError) {
        console.error('[API] Failed to refresh tunnel URL:', refreshError);
      }
      
      return Promise.reject(error);
    }
    
    const token = storage.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Check if we have a valid base URL
    if (!API_BASE_URL || API_BASE_URL.includes('invalid')) {
      // Try to refresh tunnel URL
      console.log('[API] ⚠️ Invalid API_BASE_URL, attempting to refresh...');
      try {
        const { forceRefreshTunnelUrl } = require('../utils/config');
        const newUrl = await forceRefreshTunnelUrl();
        if (newUrl && !newUrl.includes('invalid')) {
          const updatedBaseUrl = (newUrl.endsWith('/') ? newUrl.slice(0, -1) : newUrl) + '/api';
          console.log('[API] ✅ Successfully refreshed tunnel URL, using:', updatedBaseUrl);
          // Update the global API_BASE_URL for future requests
          // Note: This is a workaround since we can't directly modify the exported constant
          return this.request(url, { ...options, _baseUrl: updatedBaseUrl });
        }
      } catch (refreshError) {
        console.error('[API] Failed to refresh tunnel URL:', refreshError);
      }
      
      const error = new Error('Tunnel URL not configured. Please check Supabase tunnel_config table.');
      error.errMsg = 'Tunnel URL not configured';
      return Promise.reject(error);
    }
    
    // Allow override base URL for retry scenarios
    const baseUrl = options._baseUrl || API_BASE_URL;
    let requestUrl = `${baseUrl}${url}`;
    
    // Add query params for GET requests
    if (options.method === 'GET' && options.params) {
      const params = new URLSearchParams();
      Object.keys(options.params).forEach(key => {
        if (options.params[key] !== undefined && options.params[key] !== null) {
          params.append(key, String(options.params[key]));
        }
      });
      if (params.toString()) {
        requestUrl += `?${params.toString()}`;
      }
    }

    // Log the request URL for debugging (but not sensitive data)
    console.log('[API] Making request:', {
      method: options.method || 'GET',
      url: requestUrl,
      baseUrl: API_BASE_URL,
    });
    
    return new Promise((resolve, reject) => {
      const requestOptions = {
        url: requestUrl,
        method: options.method || 'GET',
        data: options.method !== 'GET' ? options.data : undefined,
        header: headers,
      };
      
      // Add responseType for arraybuffer requests
      if (options.responseType === 'arraybuffer') {
        requestOptions.responseType = 'arraybuffer';
      }
      
      wx.request({
        ...requestOptions,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res);
          } else if (res.statusCode === 401) {
            // Token invalid or expired - clear token
            console.log('[API] ⚠️ 401 Unauthorized - Token invalid, clearing session...');
            storage.removeToken();
            storage.removeUser();
            
            // Clear global data if app instance is available
            try {
              // Use wx.getApp() which is available globally
              const app = wx.getApp ? wx.getApp() : null;
              if (app && app.globalData) {
                app.globalData.token = null;
                app.globalData.user = null;
                console.log('[API] ✅ Cleared app globalData');
              }
            } catch (e) {
              // Ignore error if getApp is not available
              console.log('[API] Note: Cannot access app instance from service file');
            }
            
            // Return a special error that indicates authentication is needed
            const error = new Error('Invalid token');
            error.message = 'Invalid token';
            error.statusCode = 401;
            error.needsReauth = true;
            reject(error);
          } else {
            const errorMsg = (res.data && res.data.error) || `Request failed with status ${res.statusCode}`;
            const error = new Error(errorMsg);
            error.message = errorMsg;
            reject(error);
          }
        },
        fail: (err) => {
          console.error('[API] ❌ Request failed:', {
            url: requestUrl,
            method: options.method || 'GET',
            error: err.errMsg || err.message,
            errorCode: err.errcode,
            cronetErrorCode: err.cronet_error_code,
            API_BASE_URL: API_BASE_URL,
          });
          
          // Provide helpful error messages
          if (err.errMsg && err.errMsg.includes('ERR_NAME_NOT_RESOLVED')) {
            console.error('[API] ❌ DNS resolution failed - possible causes:');
            console.error('[API] 1. Tunnel URL may be expired or incorrect');
            console.error('[API] 2. Network connection issue');
            console.error('[API] 3. Domain not whitelisted in WeChat Mini Program settings');
            console.error('[API] Current API_BASE_URL:', API_BASE_URL);
            
            // Try to get current tunnel URL from storage
            try {
              const storedUrl = wx.getStorageSync('tunnel_url');
              console.error('[API] Stored tunnel_url:', storedUrl);
            } catch (e) {
              console.error('[API] Could not read stored tunnel_url');
            }
          } else if (err.errMsg && (err.errMsg.includes('fetch failed') || err.errMsg.includes('TypeError'))) {
            console.error('[API] ❌ Network request failed - possible causes:');
            console.error('[API] 1. Server may be down or unreachable');
            console.error('[API] 2. Network connection issue');
            console.error('[API] 3. Domain not whitelisted in WeChat Mini Program settings');
            console.error('[API] 4. SSL/TLS certificate issue');
            console.error('[API] Current API_BASE_URL:', API_BASE_URL);
            console.error('[API] Please check:');
            console.error('[API] - Vercel deployment status');
            console.error('[API] - WeChat Mini Program domain whitelist');
            console.error('[API] - Network connectivity');
          }
          
          const error = new Error(err.errMsg || 'Network request failed');
          error.errMsg = err.errMsg;
          error.statusCode = err.statusCode;
          reject(error);
        },
      });
    });
  },

  get(url, options = {}) {
    return this.request(url, { method: 'GET', ...options });
  },

  post(url, data) {
    return this.request(url, { method: 'POST', data });
  },

  put(url, data) {
    return this.request(url, { method: 'PUT', data });
  },

  delete(url) {
    return this.request(url, { method: 'DELETE' });
  },
};

module.exports = { api };
