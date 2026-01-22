// pages/campaign/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    loading: true,
    campaign: {},
    rewards: [],
    participant: {},
    helpers: [],
    sceneStr: '',
    qrCodeUrl: '',
    qrCodeLoading: false,
    progressPercent: 0,
    maxHelpers: 8,
    nextReward: null,
    showDebug: false, // Set to true for debugging
  },

  onLoad(options) {
    console.log('Campaign page loaded with options:', options);
    
    const campaignId = options.id;
    if (!campaignId) {
      wx.showToast({
        title: '活动ID缺失',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.loadCampaignData(campaignId);
  },

  onShow() {
    // Refresh data when page becomes visible
    const campaignId = this.data.campaign.id;
    if (campaignId) {
      this.loadProgress(campaignId);
    }
  },

  async loadCampaignData(campaignId) {
    this.setData({ loading: true });

    try {
      // First, ensure user is logged in
      if (!app.globalData.user) {
        await app.login();
      }

      // Load campaign details
      const campaignRes = await api.get(`/campaigns/${campaignId}`);
      const campaignData = (campaignRes.data && campaignRes.data.data) ? campaignRes.data.data : campaignRes.data;
      
      if (!campaignData || !campaignData.campaign) {
        throw new Error('活动不存在');
      }

      const campaign = campaignData.campaign;
      const rewards = campaignData.rewards || [];

      // Calculate max helpers from rewards
      const maxHelpers = rewards.length > 0 
        ? Math.max(...rewards.map(r => r.helpers_required))
        : 8;

      this.setData({
        campaign,
        rewards,
        maxHelpers,
      });

      // Join campaign and load progress
      await this.joinAndLoadProgress(campaignId);

    } catch (error) {
      console.error('Load campaign error:', error);
      wx.showToast({
        title: (error && error.message) ? error.message : '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async joinAndLoadProgress(campaignId) {
    try {
      // Join campaign (will return existing participant if already joined)
      const joinRes = await api.post(`/campaigns/${campaignId}/join`);
      const joinData = (joinRes.data && joinRes.data.data) ? joinRes.data.data : joinRes.data;
      
      if (joinData && joinData.participant) {
        const participant = joinData.participant;
        const sceneStr = joinData.sceneStr || '';
        
        // Calculate progress
        const progressPercent = this.calculateProgress(
          participant.helper_count || 0,
          this.data.maxHelpers
        );

        // Find next reward
        const nextReward = this.data.rewards.find(
          r => (participant.helper_count || 0) < r.helpers_required
        ) || null;

        this.setData({
          participant,
          sceneStr,
          progressPercent,
          nextReward,
        });

        // Load helpers
        await this.loadHelpers(campaignId);
      }
    } catch (error) {
      console.error('Join campaign error:', error);
      wx.showToast({
        title: (error && error.message) ? error.message : '加入活动失败',
        icon: 'none',
      });
    }
  },

  async loadProgress(campaignId) {
    try {
      const progressRes = await api.get(`/campaigns/${campaignId}/my-progress`);
      const progressData = (progressRes.data && progressRes.data.data) ? progressRes.data.data : progressRes.data;
      
      if (progressData && progressData.participant) {
        const participant = progressData.participant;
        const helpers = progressData.helpers || [];
        
        const progressPercent = this.calculateProgress(
          participant.helper_count || 0,
          this.data.maxHelpers
        );

        const nextReward = progressData.nextReward || null;

        this.setData({
          participant,
          helpers,
          progressPercent,
          nextReward,
        });
      }
    } catch (error) {
      console.error('Load progress error:', error);
    }
  },

  async loadHelpers(campaignId) {
    try {
      const progressRes = await api.get(`/campaigns/${campaignId}/my-progress`);
      const progressData = (progressRes.data && progressRes.data.data) ? progressRes.data.data : progressRes.data;
      
      if (progressData && progressData.helpers) {
        this.setData({
          helpers: progressData.helpers,
        });
      }
    } catch (error) {
      console.error('Load helpers error:', error);
    }
  },

  calculateProgress(helperCount, maxHelpers) {
    if (maxHelpers === 0) return 100;
    return Math.min(100, Math.round((helperCount / maxHelpers) * 100));
  },

  async generateQRCode() {
    const campaignId = this.data.campaign.id;
    if (!campaignId) return;

    this.setData({ qrCodeLoading: true });

    try {
      const qrRes = await api.get(`/campaigns/${campaignId}/qrcode`);
      const qrData = (qrRes.data && qrRes.data.data) ? qrRes.data.data : qrRes.data;
      
      if (qrData && qrData.url) {
        // Load QR code image
        const token = wx.getStorageSync('token') || '';
        const apiBase = require('../../utils/config').API_BASE_URL;
        
        const response = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiBase}/campaigns/${campaignId}/qrcode-image`,
            method: 'GET',
            responseType: 'arraybuffer',
            header: token ? { 'Authorization': `Bearer ${token}` } : {},
            success: resolve,
            fail: reject,
          });
        });

        if (response.statusCode === 200 && response.data instanceof ArrayBuffer) {
          const base64 = wx.arrayBufferToBase64(response.data);
          this.setData({
            qrCodeUrl: `data:image/png;base64,${base64}`,
            sceneStr: qrData.sceneStr || this.data.sceneStr,
          });
        }
      }
    } catch (error) {
      console.error('Generate QR code error:', error);
      wx.showToast({
        title: '生成二维码失败',
        icon: 'none',
      });
    } finally {
      this.setData({ qrCodeLoading: false });
    }
  },

  previewQRCode() {
    if (!this.data.qrCodeUrl) return;
    
    // Save to temp file and preview
    const base64Data = this.data.qrCodeUrl.split(',')[1];
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/campaign_qr_${Date.now()}.png`;
    
    fs.writeFile({
      filePath,
      data: base64Data,
      encoding: 'base64',
      success: () => {
        wx.previewImage({
          urls: [filePath],
          current: filePath,
        });
      },
      fail: (err) => {
        console.error('Save QR code error:', err);
      },
    });
  },

  async generatePoster() {
    wx.showToast({
      title: '海报功能开发中...',
      icon: 'none',
    });
    // TODO: Implement poster generation
  },

  copyCode() {
    const code = this.data.participant.referral_code;
    if (!code) {
      wx.showToast({
        title: '邀请码不存在',
        icon: 'none',
      });
      return;
    }

    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success',
        });
      },
    });
  },

  formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  },

  onShareAppMessage() {
    const campaign = this.data.campaign;
    const participant = this.data.participant;
    
    return {
      title: campaign.name || '邀请你参加活动',
      path: `/pages/campaign/index?id=${campaign.id}&ref=${participant.referral_code || ''}`,
      imageUrl: campaign.cover_image_url || '',
    };
  },

  onShareTimeline() {
    const campaign = this.data.campaign;
    const participant = this.data.participant;
    
    return {
      title: campaign.name || '邀请你参加活动',
      query: `id=${campaign.id}&ref=${participant.referral_code || ''}`,
      imageUrl: campaign.cover_image_url || '',
    };
  },
});
