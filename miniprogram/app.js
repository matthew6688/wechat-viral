// app.js
const API_BASE_URL = 'http://localhost:3000/api';

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

  // Logout method
  logout() {
    storage.removeToken();
    storage.removeUser();
    this.globalData.token = null;
    this.globalData.user = null;
    console.log('User logged out');
  },
});
