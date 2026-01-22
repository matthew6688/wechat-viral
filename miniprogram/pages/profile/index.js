// pages/profile/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    user: null,
    points: 0,
    referralCode: '',
  },

  onLoad() {
    this.loadUser();
  },

  onShow() {
    this.loadUser();
    this.loadPoints();
    this.loadReferralCode();
  },

  loadUser() {
    const user = app.globalData.user;
    if (user) {
      this.setData({ user });
    } else {
      wx.redirectTo({ url: '/pages/landing/index' });
    }
  },

  async loadPoints() {
    try {
      const response = await api.get('/points/balance');
      const balance = (response.data && response.data.data && response.data.data.balance) ? response.data.data.balance : 
                     (response.data && response.data.balance) ? response.data.balance : 0;
      this.setData({ points: balance });
    } catch (error) {
      console.error('Load points error:', error);
    }
  },

  async loadReferralCode() {
    try {
      const response = await api.get('/referrals/my-code');
      let shortCode = '';
      if (response && response.data) {
        if (typeof response.data === 'string') {
          shortCode = response.data;
        } else if (response.data.data && response.data.data.shortCode) {
          shortCode = response.data.data.shortCode;
        } else if (response.data.shortCode) {
          shortCode = response.data.shortCode;
        }
      }
      this.setData({ referralCode: shortCode });
    } catch (error) {
      console.error('Load referral code error:', error);
    }
  },

  goToAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' });
  },

  logout() {
    wx.showModal({
      title: 'Sign Out',
      content: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      success: (res) => {
        if (res.confirm) {
          app.globalData.user = null;
          app.globalData.token = null;
          wx.removeStorageSync('token');
          wx.redirectTo({ url: '/pages/landing/index' });
        }
      },
    });
  },
});
