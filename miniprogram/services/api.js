// services/api.js
const { API_BASE_URL } = require('../utils/config');

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
};

const api = {
  async request(url, options = {}) {
    const token = storage.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let requestUrl = `${API_BASE_URL}${url}`;
    
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
          } else {
            const errorMsg = (res.data && res.data.error) || `Request failed with status ${res.statusCode}`;
            const error = new Error(errorMsg);
            error.message = errorMsg;
            reject(error);
          }
        },
        fail: (err) => {
          const error = new Error(err.errMsg || 'Network request failed');
          error.errMsg = err.errMsg;
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
