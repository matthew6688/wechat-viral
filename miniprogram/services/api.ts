import { API_BASE_URL } from '../utils/config';
import { storage } from './storage';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  params?: any;
}

export const api = {
  async request(url: string, options: RequestOptions = {}) {
    const token = storage.getToken();
    
    const headers: any = {
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
      wx.request({
        url: requestUrl,
        method: options.method || 'GET',
        data: options.method !== 'GET' ? options.data : undefined,
        header: headers,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res);
          } else {
            reject(new Error((res.data && res.data.error) || `Request failed with status ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  },

  get(url: string, options: { params?: any } = {}) {
    return this.request(url, { method: 'GET', ...options });
  },

  post(url: string, data?: any) {
    return this.request(url, { method: 'POST', data });
  },

  put(url: string, data?: any) {
    return this.request(url, { method: 'PUT', data });
  },

  delete(url: string) {
    return this.request(url, { method: 'DELETE' });
  },
};
