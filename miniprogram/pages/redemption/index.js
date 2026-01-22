// pages/redemption/index.js
const api = require('../../services/api').api;

Page({
  data: {
    redemption: null,
  },

  onLoad(options) {
    if (options.id) {
      this.loadRedemption(options.id);
    }
  },

  async loadRedemption(id) {
    try {
      const response = await api.get(`/rewards/redemptions/${id}`);
      this.setData({ redemption: response.data && response.data.redemption ? response.data.redemption : null });
    } catch (error) {
      console.error('Load redemption error:', error);
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
