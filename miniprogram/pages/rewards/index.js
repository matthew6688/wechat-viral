// pages/rewards/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    points: 0,
    rewards: [],
    redemptions: [],
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

      const rewards = (rewardsRes.data && rewardsRes.data.data && rewardsRes.data.data.rewards) ? rewardsRes.data.data.rewards : 
                     (rewardsRes.data && rewardsRes.data.rewards) ? rewardsRes.data.rewards : null;
      const redemptions = (redemptionsRes.data && redemptionsRes.data.data && redemptionsRes.data.data.redemptions) ? redemptionsRes.data.data.redemptions : 
                         (redemptionsRes.data && redemptionsRes.data.redemptions) ? redemptionsRes.data.redemptions : null;
      
      this.setData({
        points: (pointsRes.data && pointsRes.data.data && pointsRes.data.data.balance) ? pointsRes.data.data.balance : 
                (pointsRes.data && pointsRes.data.balance) ? pointsRes.data.balance : 0,
        rewards: Array.isArray(rewards) ? rewards : [],
        redemptions: Array.isArray(redemptions) ? redemptions : [],
      });
    } catch (error) {
      console.error('Load data error:', error);
    }
  },

  async redeemReward(e) {
    const rewardId = e.currentTarget.dataset.id;
    const reward = this.data.rewards.find((r) => r.id === rewardId);
    
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
      const response = await api.post(`/rewards/${rewardId}/redeem`);
      wx.hideLoading();
      wx.showToast({ title: '兑换成功', icon: 'success' });
      
      wx.navigateTo({
        url: `/pages/redemption/index?id=${response.data.redemption.id}`,
      });
      
      this.loadData();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '兑换失败',
        icon: 'none',
      });
    }
  },
});
