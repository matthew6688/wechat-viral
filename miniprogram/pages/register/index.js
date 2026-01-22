// pages/register/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    formData: {
      name: '',
      phone: '',
      wechatId: '',
      company: '',
      role: 'Other',
      mainProducts: '',
      avatarUrl: '', // WeChat avatar URL
      nickname: '', // WeChat nickname
    },
    wechatIds: {
      unionid: null,
      openid: null,
    },
  },

  onLoad() {
    // Check if user is already registered
    if (app.globalData.user) {
      wx.switchTab({ url: '/pages/home/index' });
      return;
    }
    
    // Get WeChat profile info
    this.loadWeChatProfile();
  },

  async loadWeChatProfile() {
    try {
      // Try to get user info using getUserProfile (new API, requires user click)
      // For automatic loading, we'll try getUserInfo first (may not work without auth)
      // Then fallback to getting it after login
      try {
        const userInfo = await new Promise((resolve, reject) => {
          wx.getUserInfo({
            success: resolve,
            fail: reject,
          });
        });

        if (userInfo && userInfo.userInfo) {
          this.setData({
            'formData.avatarUrl': userInfo.userInfo.avatarUrl,
            'formData.nickname': userInfo.userInfo.nickName,
          });
          return;
        }
      } catch (err) {
        console.log('getUserInfo not available, will try after login');
      }

      // If getUserInfo fails, we'll get it after login
      // The profile will be loaded in onRegister after login
    } catch (error) {
      console.log('Could not get user info automatically:', error);
    }
  },

  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail.value,
    });
  },

  async onRegister() {
    const { formData, wechatIds } = this.data;
    
    if (!formData.name || !formData.phone) {
      wx.showToast({
        title: '请填写姓名和手机号',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '注册中...' });

    try {
      // First login to get token and WeChat IDs
      console.log('Starting login process...');
      await app.login();
      console.log('Login successful, proceeding with registration');
      
      // Try to get WeChat profile if not already loaded
      // Note: In newer WeChat versions, getUserInfo may not work without user interaction
      // We'll try, but if it fails, the form will still work without avatar/nickname
      if (!this.data.formData.avatarUrl || !this.data.formData.nickname) {
        try {
          // Try getUserInfo (may require previous authorization)
          const userInfo = await new Promise((resolve, reject) => {
            wx.getUserInfo({
              success: resolve,
              fail: reject,
            });
          });

          if (userInfo && userInfo.userInfo) {
            this.setData({
              'formData.avatarUrl': userInfo.userInfo.avatarUrl,
              'formData.nickname': userInfo.userInfo.nickName,
            });
          }
        } catch (error) {
          console.log('Could not get user info automatically:', error);
          // If we can't get it automatically, that's okay - form will work without it
        }
      }
      
      // Update WeChat IDs from login response
      if (app.globalData.user) {
        this.setData({
          wechatIds: {
            unionid: app.globalData.user.unionid || null,
            openid: app.globalData.user.openid || null,
          },
        });
      }
      
      // Check if there's a referral code in sceneContext
      const referralCode = app.globalData.sceneContext?.referralCode;
      
      // Prepare registration data with WeChat IDs as hidden fields
      const registerData = {
        ...formData,
        // Include WeChat IDs as hidden fields
        unionid: this.data.wechatIds.unionid || app.globalData.user?.unionid || null,
        openid: this.data.wechatIds.openid || app.globalData.user?.openid || null,
        // Include WeChat profile info
        wechat_avatar: formData.avatarUrl || null,
        wechat_nickname: formData.nickname || null,
      };
      
      if (referralCode) {
        console.log('Referral code found:', referralCode);
        registerData.referralCode = referralCode;
      }
      
      // Then register/update user (with referral code and WeChat IDs if available)
      const response = await api.post('/users/register', registerData);
      
      // Handle response data structure
      const userData = (response.data && response.data.data) ? response.data.data : 
                      (response.data && response.data.user) ? response.data.user : 
                      response.data;
      app.globalData.user = userData;
      
      wx.hideLoading();
      wx.showToast({
        title: '注册成功',
        icon: 'success',
      });
      
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/index' });
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('Register error:', error);
      const errorMsg = (error && error.message) ? error.message : 
                      (error && error.errMsg) ? error.errMsg : 
                      '注册失败';
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 3000,
      });
    }
  },
});
