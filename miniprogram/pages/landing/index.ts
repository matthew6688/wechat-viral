const app = getApp();
const { API_BASE_URL } = require('../../utils/config');
const storage = require('../../services/storage').storage;

Page({
  data: {
    headline: '欢迎加入AI出口增长实验室',
    subheadline: '开启您的增长之旅',
    body: '加入我们，获得专业的出口增长指导，与行业专家交流，共同成长。',
    loading: false,
  },

  onLoad(options: any) {
    console.log('Landing page loaded', options);
  },

  async handleCTA() {
    console.log('CTA button clicked');
    const user = app.globalData.user;
    console.log('Current user:', user);
    
    if (user) {
      console.log('User exists, switching to home');
      wx.switchTab({ 
        url: '/pages/home/index',
        success: () => console.log('Switch to home success'),
        fail: (err) => console.error('Switch to home failed:', err)
      });
      return;
    }
    
    // Check if registration is required
    this.setData({ loading: true });
    
    try {
      const settingsRes: any = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/auth/settings`,
          method: 'GET',
          success: resolve,
          fail: reject,
        });
      });
      
      console.log('Auth settings:', settingsRes.data);
      
      const registrationRequired = settingsRes.data?.data?.registration_required !== false;
      
      if (registrationRequired) {
        // Registration is required, go to register page
        console.log('Registration required, navigating to register');
        this.setData({ loading: false });
        wx.navigateTo({ url: '/pages/register/index' });
      } else {
        // Registration not required, do quick login
        console.log('Registration not required, doing quick login');
        await this.quickLogin();
      }
    } catch (error) {
      console.error('Check settings error:', error);
      this.setData({ loading: false });
      // Fallback to register page on error
      wx.navigateTo({ url: '/pages/register/index' });
    }
  },
  
  /**
   * Quick login without registration form
   */
  async quickLogin() {
    try {
      // Get wx.login code
      const loginRes: any = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });
      
      console.log('wx.login success, code received');
      
      // Call backend login API
      const response: any = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE_URL}/auth/login`,
          method: 'POST',
          data: { code: loginRes.code },
          success: resolve,
          fail: reject,
        });
      });
      
      console.log('Login response:', response.data);
      
      if (response.statusCode === 200 && response.data?.data) {
        const { token, user } = response.data.data;
        
        // Save token and user
        storage.setToken(token);
        storage.setUser(user);
        app.globalData.token = token;
        app.globalData.user = user;
        
        console.log('Quick login success:', user.name);
        
        this.setData({ loading: false });
        wx.switchTab({ url: '/pages/home/index' });
      } else {
        throw new Error(response.data?.error || '登录失败');
      }
    } catch (error: any) {
      console.error('Quick login error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
      });
    }
  },
});
