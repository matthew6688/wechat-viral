// app.js
// 注意：API_BASE_URL 现在是动态的，需要每次使用时获取
const config = require('./utils/config');
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

App({
  globalData: {
    user: null,
    token: null,
    sceneContext: null,
  },

  onLaunch(options) {
    console.log('App launched', options);
    
    // 在真机上，立即尝试获取 tunnel URL
    var platform = 'devtools';
    try {
      // Try new API first
      if (wx.getDeviceInfo) {
        var deviceInfo = wx.getDeviceInfo();
        platform = deviceInfo.platform;
      } else {
        // Fallback to deprecated API
        var systemInfo = wx.getSystemInfoSync();
        platform = systemInfo.platform;
      }
    } catch (e) {
      console.warn('[App] Failed to get platform');
    }
    
    if (platform !== 'devtools') {
      // 检查是否已配置生产环境 URL
      const { getApiBaseUrlDynamic } = require('./utils/config');
      const apiUrl = getApiBaseUrlDynamic();
      
      // 如果已经有生产 URL（Vercel），就不需要从 Supabase 获取 tunnel URL
      if (apiUrl && apiUrl.includes('vercel.app')) {
        console.log('[App] ✅ Production URL already configured:', apiUrl);
        console.log('[App] Skipping tunnel URL fetch to avoid ERR_NAME_NOT_RESOLVED');
      } else {
        // 只有在没有生产 URL 时才尝试从 Supabase 获取 tunnel URL
        console.log('[App] No production URL found, attempting to fetch tunnel URL...');
        const { forceRefreshTunnelUrl } = require('./utils/config');
        
        // 强制刷新并等待完成（但捕获错误，避免阻塞）
        forceRefreshTunnelUrl()
          .then(function(url) {
            if (url) {
              // Remove trailing slash if present
              if (url && url.endsWith('/')) {
                url = url.slice(0, -1);
              }
              console.log('[App] ✅ Tunnel URL pre-fetched:', url);
              console.log('[App] Full API URL will be:', url + '/api');
              
              // 保存到全局，确保后续 API 调用使用正确的 URL
              try {
                wx.setStorageSync('tunnel_url', url);
                console.log('[App] ✅ Tunnel URL saved to storage');
              } catch (e) {
                console.error('[App] Failed to save tunnel URL:', e);
              }
            } else {
              console.warn('[App] ⚠️ No tunnel URL returned from Supabase');
            }
          })
          .catch(function(err) {
            // 如果 Supabase 域名未添加到微信白名单，这是预期的错误
            // 不阻塞应用启动，因为我们已经有了生产 URL
            console.warn('[App] ⚠️ Failed to pre-fetch tunnel URL (non-critical):', err.errMsg || err.message);
            console.log('[App] This is OK if Supabase domain is not whitelisted or production URL is configured');
          });
      }
    }
    
    // Restore session from storage
    const token = storage.getToken();
    const savedUser = storage.getUser();
    
    if (token) {
      this.globalData.token = token;
      
      // Restore user from storage first (faster)
      if (savedUser) {
        this.globalData.user = savedUser;
        console.log('User restored from storage:', savedUser.name || savedUser.wechat_nickname || 'Unknown');
      }
      
      // Then refresh from server in background
      this.loadUserData();
    }

    // Handle scene parameters
    if (options.scene) {
      this.handleScene(options);
    }
  },

  onShow(options) {
    console.log('App shown', options);
    
    // Handle scene parameters when app is shown
    if (options.scene) {
      this.handleScene(options);
    }
  },

  async handleScene(options) {
    try {
      // Extract scene parameter
      const scene = options.scene;
      const query = options.query || {};
      
      // If there's a ref parameter in query, it's from sharing
      if (query.ref) {
        // Resolve scene context
        const API_BASE_URL = getApiBaseUrl();
        if (!API_BASE_URL) {
          console.error('[App] API_BASE_URL not available for scene resolve');
          return;
        }
        const response = await wx.request({
          url: `${API_BASE_URL}/scene/resolve`,
          method: 'POST',
          data: { shortCode: query.ref },
        });

        if (response.statusCode === 200 && response.data && response.data.data) {
          this.globalData.sceneContext = response.data.data;
        }
      }
    } catch (error) {
      console.error('Handle scene error:', error);
    }
  },

  async loadUserData() {
    try {
      const token = storage.getToken();
      if (!token) return;

      const API_BASE_URL = getApiBaseUrl();
      if (!API_BASE_URL) {
        console.error('[App] API_BASE_URL not available for loadUserData');
        return;
      }

      const response = await wx.request({
        url: `${API_BASE_URL}/users/me`,
        method: 'GET',
        header: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.statusCode === 200 && response.data && response.data.data) {
        const user = response.data.data;
        this.globalData.user = user;
        // Save to storage for persistence
        storage.setUser(user);
        console.log('User data loaded and saved:', user.name || user.wechat_nickname || 'Unknown');
      } else if (response.statusCode === 401) {
        // Token expired, clear session
        console.log('Token expired, clearing session');
        storage.removeToken();
        storage.removeUser();
        this.globalData.token = null;
        this.globalData.user = null;
      }
    } catch (error) {
      console.error('Load user data error:', error);
    }
  },

  async login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: async (res) => {
          if (res.code) {
            console.log('wx.login success, code received');
            // 动态获取 API_BASE_URL
            const API_BASE_URL = getApiBaseUrl();
            if (!API_BASE_URL) {
              console.error('[App] ❌ API_BASE_URL is not available');
              reject(new Error('API URL not configured. Please check network connection.'));
              return;
            }
            
            console.log('[App] Login request URL:', `${API_BASE_URL}/auth/login`);
            console.log('[App] API_BASE_URL value:', API_BASE_URL);
            console.log('[App] Platform:', platform);
            
            wx.request({
              url: `${API_BASE_URL}/auth/login`,
              method: 'POST',
              data: { code: res.code },
              header: {
                'Content-Type': 'application/json',
              },
              success: (response) => {
                console.log('Login response:', {
                  statusCode: response.statusCode,
                  data: response.data,
                });
                
                if (response.statusCode === 200 && response.data) {
                  const data = response.data.data || response.data;
                  const { token, user } = data;
                  if (token && user) {
                    storage.setToken(token);
                    this.globalData.token = token;
                    this.globalData.user = user;
                    // Save user to storage for persistence
                    storage.setUser(user);
                    console.log('User logged in and saved:', user.name || user.wechat_nickname || 'Unknown');
                    resolve({ token, user });
                  } else {
                    console.error('Invalid response structure:', data);
                    reject(new Error('Login failed: invalid response structure'));
                  }
                } else {
                  const errorMsg = (response.data && response.data.error) ? response.data.error : 
                                  `Login failed with status ${response.statusCode || 'unknown'}`;
                  console.error('Login failed:', errorMsg, response.data);
                  reject(new Error(errorMsg));
                }
              },
              fail: (error) => {
                console.error('[App] ❌ Login request failed:', error);
                console.error('[App] Error details:', {
                  errMsg: error?.errMsg,
                  errno: error?.errno,
                  errorCode: error?.errorCode,
                  cronetErrorCode: error?.cronet_error_code,
                  API_BASE_URL: API_BASE_URL,
                  requestURL: `${API_BASE_URL}/auth/login`,
                });
                
                // Provide specific error messages based on error type
                let errorMsg = 'Network request failed';
                if (error?.errMsg) {
                  if (error.errMsg.includes('ERR_NAME_NOT_RESOLVED')) {
                    errorMsg = '域名解析失败，请检查域名白名单配置';
                  } else if (error.errMsg.includes('ERR_CONNECTION_REFUSED')) {
                    errorMsg = '连接被拒绝，服务器可能未运行';
                  } else if (error.errMsg.includes('fetch failed')) {
                    errorMsg = '网络请求失败，请检查：1) 域名白名单 2) 网络连接 3) 服务器状态';
                  } else {
                    errorMsg = error.errMsg;
                  }
                } else if (error?.message) {
                  errorMsg = error.message;
                }
                
                console.error('[App] Final error message:', errorMsg);
                reject(new Error(errorMsg));
              },
            });
          } else {
            reject(new Error('wx.login failed: no code received'));
          }
        },
        fail: (error) => {
          console.error('wx.login failed:', error);
          reject(new Error('wx.login failed'));
        },
      });
    });
  },

  /**
   * Check if user has authorized their profile (nickname/avatar)
   * @returns {boolean}
   */
  hasUserProfile() {
    const user = this.globalData.user;
    // User has profile if they have a real nickname (not default "新用户" or "微信用户")
    const hasNickname = user && user.wechat_nickname && 
      user.wechat_nickname !== '新用户' && 
      user.wechat_nickname !== '微信用户';
    const hasAvatar = !!(user && user.wechat_avatar_url);
    return hasNickname || hasAvatar;
  },

  /**
   * Request user profile authorization using wx.getUserProfile
   * This must be called from a user tap event (button click)
   * @returns {Promise<{nickName: string, avatarUrl: string} | null>}
   */
  getUserProfile() {
    const self = this;
    return new Promise((resolve) => {
      wx.getUserProfile({
        desc: '用于展示您的昵称和头像',
        success: (res) => {
          console.log('getUserProfile success:', res.userInfo);
          const { nickName, avatarUrl } = res.userInfo;
          
          // Immediately update local user data (optimistic update)
          if (self.globalData.user) {
            self.globalData.user.wechat_nickname = nickName;
            self.globalData.user.wechat_avatar_url = avatarUrl;
            storage.setUser(self.globalData.user);
            console.log('Local user profile updated immediately:', nickName);
          }
          
          // Update user profile on server
          const token = storage.getToken();
          if (token) {
            const API_BASE_URL = getApiBaseUrl();
            if (!API_BASE_URL) {
              console.error('[App] API_BASE_URL not available for profile update');
              return;
            }
            wx.request({
              url: `${API_BASE_URL}/users/profile`,
              method: 'PUT',
              header: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              data: {
                wechat_nickname: nickName,
                wechat_avatar_url: avatarUrl,
              },
              success: (response) => {
                console.log('Profile update response:', response.statusCode, response.data);
                if (response.statusCode === 200 && response.data && response.data.data) {
                  // Update local user data from server response
                  const updatedUser = response.data.data;
                  self.globalData.user = updatedUser;
                  storage.setUser(updatedUser);
                  console.log('User profile synced from server:', nickName);
                }
              },
              fail: (error) => {
                console.error('Update profile request failed:', error);
                // Still keep local update even if server fails
              },
            });
          }

          resolve({ nickName, avatarUrl });
        },
        fail: (err) => {
          console.log('getUserProfile failed or cancelled:', err);
          resolve(null);
        },
      });
    });
  },

  // Logout method
  logout() {
    storage.removeToken();
    storage.removeUser();
    this.globalData.token = null;
    this.globalData.user = null;
    wx.removeStorageSync('profile_auth_skipped');
    console.log('User logged out');
  },
});
