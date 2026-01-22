import { api } from '../../services/api';

Page({
  data: {
    redemption: null as any,
  },

  onLoad(options: any) {
    if (options.id) {
      this.loadRedemption(options.id);
    }
  },

  async loadRedemption(id: string) {
    try {
      const response: any = await api.get(`/rewards/redemptions/${id}`);
      this.setData({ redemption: response.data.redemption });
    } catch (error) {
      console.error('Load redemption error:', error);
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
