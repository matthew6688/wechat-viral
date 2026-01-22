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
      role: 'Owner',
      mainProducts: '',
      avatarUrl: '',
      nickname: '',
    },
    wechatIds: {
      unionid: null,
      openid: null,
    },
  },

  onLoad() {
    if (app.globalData.user) {
      wx.switchTab({ url: '/pages/home/index' });
      return;
    }
    this.loadWeChatProfile();
  },

  async loadWeChatProfile() {
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
      }
    } catch (err) {
      console.log('getUserInfo not available');
    }
  },

  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail.value,
    });
  },

  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({
      'formData.role': role,
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
      console.log('Starting login process...');
      await app.login();
      console.log('Login successful, proceeding with registration');
      
      if (!this.data.formData.avatarUrl || !this.data.formData.nickname) {
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
          }
        } catch (error) {
          console.log('Could not get user info automatically:', error);
        }
      }
      
      if (app.globalData.user) {
        this.setData({
          wechatIds: {
            unionid: app.globalData.user.unionid || null,
            openid: app.globalData.user.openid || null,
          },
        });
      }
      
      const referralCode = app.globalData.sceneContext?.referralCode;
      
      const registerData = {
        ...formData,
        unionid: this.data.wechatIds.unionid || app.globalData.user?.unionid || null,
        openid: this.data.wechatIds.openid || app.globalData.user?.openid || null,
        wechat_avatar: formData.avatarUrl || null,
        wechat_nickname: formData.nickname || null,
      };
      
      if (referralCode) {
        console.log('Referral code found:', referralCode);
        registerData.referralCode = referralCode;
      }
      
      const response = await api.post('/users/register', registerData);
      
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
