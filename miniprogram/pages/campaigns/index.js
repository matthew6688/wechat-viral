// pages/campaigns/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    loading: true,
    campaigns: [],
  },

  onLoad() {
    this.loadCampaigns();
  },

  onShow() {
    // Refresh when page becomes visible
    this.loadCampaigns();
  },

  onPullDownRefresh() {
    this.loadCampaigns().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadCampaigns() {
    this.setData({ loading: true });

    try {
      // Ensure user is logged in
      if (!app.globalData.user) {
        await app.login();
      }

      // Load campaigns
      const campaignsRes = await api.get('/campaigns');
      const campaignsData = (campaignsRes.data && campaignsRes.data.data) 
        ? campaignsRes.data.data 
        : campaignsRes.data;
      
      let campaigns = campaignsData.campaigns || [];

      // Format and enrich campaign data
      campaigns = campaigns.map(campaign => ({
        ...campaign,
        formatted_end_time: this.formatEndTime(campaign.end_time),
      }));

      // Load user's progress for each campaign
      const campaignsWithProgress = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const progressRes = await api.get(`/campaigns/${campaign.id}/my-progress`);
            const progressData = (progressRes.data && progressRes.data.data) 
              ? progressRes.data.data 
              : progressRes.data;
            
            if (progressData && progressData.joined && progressData.participant) {
              const participant = progressData.participant;
              const rewards = progressData.rewards || [];
              const maxHelpers = rewards.length > 0 
                ? Math.max(...rewards.map(r => r.helpers_required))
                : 8;
              
              return {
                ...campaign,
                rewards_count: rewards.length,
                my_progress: {
                  helper_count: participant.helper_count || 0,
                  percent: maxHelpers > 0 
                    ? Math.min(100, Math.round((participant.helper_count || 0) / maxHelpers * 100))
                    : 0,
                },
              };
            }
          } catch (e) {
            console.log('Load progress error for campaign:', campaign.id, e);
          }
          
          return campaign;
        })
      );

      this.setData({
        campaigns: campaignsWithProgress,
      });

    } catch (error) {
      console.error('Load campaigns error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  formatEndTime(endTime) {
    if (!endTime) return '';
    const date = new Date(endTime);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return '已结束';
    } else if (diffDays === 1) {
      return '明天结束';
    } else if (diffDays <= 7) {
      return `${diffDays}天后结束`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日结束`;
    }
  },

  goToCampaign(e) {
    const campaignId = e.currentTarget.dataset.id;
    if (campaignId) {
      wx.navigateTo({
        url: `/pages/campaign/index?id=${campaignId}`,
      });
    }
  },
});
