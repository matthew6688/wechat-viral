const app = getApp();
import { api } from '../../services/api';

Page({
  data: {
    points: 0,
    rewards: [] as any[],
    redemptions: [] as any[],
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const [pointsRes, rewardsRes, redemptionsRes] = await Promise.all([
        api.get('/points/balance'),
        api.get('/rewards'),
        api.get('/rewards/redemptions'),
      ]);

      this.setData({
        points: (pointsRes as any).data.balance || 0,
        rewards: (rewardsRes as any).data.rewards || [],
        redemptions: (redemptionsRes as any).data.redemptions || [],
      });
    } catch (error) {
      console.error('Load data error:', error);
    }
  },

  async redeemReward(e: any) {
    const rewardId = e.currentTarget.dataset.id;
    const reward = this.data.rewards.find((r: any) => r.id === rewardId);
    
    if (!reward) return;
    
    if (this.data.points < reward.points_required) {
      wx.showToast({
        title: '积分不足',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '兑换中...' });

    try {
      const response: any = await api.post(`/rewards/${rewardId}/redeem`);
      wx.hideLoading();
      wx.showToast({ title: '兑换成功', icon: 'success' });
      
      wx.navigateTo({
        url: `/pages/redemption/index?id=${response.data.redemption.id}`,
      });
      
      this.loadData();
    } catch (error: any) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '兑换失败',
        icon: 'none',
      });
    }
  },
});
