// app.js
const { API_BASE_URL } = require('./utils/config');

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
      console.log('[App] Pre-fetching tunnel URL for real device...');
      const { forceRefreshTunnelUrl } = require('./utils/config');
      
      // 强制刷新并等待完成
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
            
            // Test the URL to make sure it's accessible (test with campaigns endpoint)
            wx.request({
              url: url + '/api/campaigns',
              method: 'GET',
              success: function(res) {
                console.log('[App] ✅ Tunnel URL is accessible, status:', res.statusCode);
                if (res.data && res.data.success) {
                  const campaignCount = res.data.data?.campaigns?.length || 0;
                  console.log('[App] ✅ Found', campaignCount, 'campaigns via tunnel');
                }
              },
              fail: function(err) {
                console.error('[App] ⚠️ Tunnel URL test failed:', err);
                console.error('[App] Error details:', JSON.stringify(err));
                if (err.errMsg && err.errMsg.includes('ERR_NAME_NOT_RESOLVED')) {
                  console.error('[App] ❌ DNS resolution failed!');
                  console.error('[App] Possible causes:');
                  console.error('[App] 1. Tunnel URL expired or incorrect:', url);
                  console.error('[App] 2. Cloudflare Tunnel not running');
                  console.error('[App] 3. Domain not whitelisted in WeChat Mini Program backend');
                  console.error('[App] 4. Network connectivity issue on device');
                  console.error('[App] Action: Check Supabase tunnel_config and update if needed');
                } else if (err.errMsg && err.errMsg.includes('ERR_CONNECTION_REFUSED')) {
                  console.error('[App] ❌ Connection refused - tunnel may be down');
                }
              }
            });
          } else {
            console.error('[App] ❌ Failed to pre-fetch tunnel URL');
            console.error('[App] Please check:');
            console.error('[App] 1. Supabase tunnel_config table has a valid URL');
            console.error('[App] 2. Network connection is available');
            console.error('[App] 3. Supabase domain is whitelisted in WeChat Mini Program settings');
          }
        })
        .catch(function(err) {
          console.error('[App] Error pre-fetching tunnel URL:', err);
        });
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
                console.error('Login request failed:', error);
                const errorMsg = (error && error.errMsg) ? error.errMsg : 
                                (error && error.message) ? error.message : 
                                'Network request failed';
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
