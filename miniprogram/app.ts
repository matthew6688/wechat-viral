// app.ts
import { API_BASE_URL } from './utils/config';
import { storage } from './services/storage';

interface GlobalData {
  user: any;
  token: string | null;
  sceneContext: {
    activityId?: string;
    inviterUserId?: string;
    channelId?: string;
  } | null;
}

App({
  globalData: {
    user: null,
    token: null,
    sceneContext: null,
  } as GlobalData,

  onLaunch(options: any) {
    console.log('App launched', options);
    
    // Restore session from storage
    const token = storage.getToken();
    const savedUser = storage.getUser();
    
    if (token) {
      this.globalData.token = token;
      
      // Restore user from storage first (faster)
      if (savedUser) {
        this.globalData.user = savedUser;
        console.log('User restored from storage:', savedUser.name || savedUser.wechat_nickname);
      }
      
      // Then refresh from server in background
      this.loadUserData();
    }

    // Handle scene parameters
    if (options.scene) {
      this.handleScene(options);
    }
  },

  onShow(options: any) {
    console.log('App shown', options);
    
    // Handle scene parameters when app is shown
    if (options.scene) {
      this.handleScene(options);
    }
  },

  async handleScene(options: any) {
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

        if (response.statusCode === 200 && (response.data as any).data) {
          this.globalData.sceneContext = (response.data as any).data;
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

      if (response.statusCode === 200 && (response.data as any).data) {
        const user = (response.data as any).data;
        this.globalData.user = user;
        // Save to storage for persistence
        storage.setUser(user);
        console.log('User data loaded and saved:', user.name || user.wechat_nickname);
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
            try {
              const response = await wx.request({
                url: `${API_BASE_URL}/auth/login`,
                method: 'POST',
                data: { code: res.code },
              });

              if (response.statusCode === 200 && (response.data as any).data) {
                const { token, user } = (response.data as any).data;
                storage.setToken(token);
                this.globalData.token = token;
                this.globalData.user = user;
                // Save user to storage for persistence
                if (user) {
                  storage.setUser(user);
                  console.log('User logged in and saved:', user.name || user.wechat_nickname);
                }
                resolve({ token, user });
              } else {
                reject(new Error('Login failed'));
              }
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('wx.login failed'));
          }
        },
        fail: reject,
      });
    });
  },
});
