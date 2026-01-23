// pages/campaign/index.ts
const app = getApp<IAppOption>();
const api = require('../../services/api').api;

interface Campaign {
  id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  status: string;
}

interface CampaignReward {
  id: string;
  tier_level: number;
  helpers_required: number;
  reward_name: string;
  reward_description: string;
}

interface CampaignParticipant {
  id: string;
  referral_code: string;
  helper_count: number;
  total_helper_count: number;
}

interface CampaignHelper {
  id: string;
  helper_openid: string;
  is_valid: boolean;
  created_at: string;
}

Page({
  data: {
    loading: true,
    campaign: {} as Campaign,
    rewards: [] as CampaignReward[],
    participant: {} as CampaignParticipant,
    helpers: [] as CampaignHelper[],
    sceneStr: '',
    qrCodeUrl: '',
    qrCodeLoading: false,
    progressPercent: 0,
    maxHelpers: 8,
    nextReward: null as CampaignReward | null,
    showDebug: false, // Set to true for debugging
    showProfileModal: false, // Profile authorization modal
  },

  onLoad(options: { id?: string; from?: string }) {
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
    
    // Check if user needs to authorize profile
    this.checkProfileAuthorization();
  },
  
  /**
   * Check if user has authorized their profile, prompt if not
   */
  checkProfileAuthorization() {
    // Delay check to allow login to complete
    setTimeout(() => {
      const hasProfile = app.hasUserProfile();
      const hasSkipped = wx.getStorageSync('profile_auth_skipped');
      
      // Show modal if user hasn't authorized and hasn't skipped
      if (!hasProfile && !hasSkipped) {
        this.setData({ showProfileModal: true });
      }
    }, 1500);
  },
  
  /**
   * User taps "Authorize" button - must be from user tap event
   */
  async authorizeProfile() {
    this.setData({ showProfileModal: false });
    
    try {
      const result = await app.getUserProfile();
      if (result) {
        wx.showToast({
          title: '授权成功',
          icon: 'success',
        });
        // Refresh helpers list to show updated names
        const campaignId = this.data.campaign.id;
        if (campaignId) {
          await this.loadHelpers(campaignId);
        }
      }
    } catch (error) {
      console.error('Authorize profile error:', error);
    }
  },
  
  /**
   * User taps "Skip" button
   */
  skipProfile() {
    this.setData({ showProfileModal: false });
    // Remember that user skipped (for this session)
    wx.setStorageSync('profile_auth_skipped', true);
  },
  
  /**
   * Prevent touch events from propagating through modal
   */
  preventTouchMove() {
    return false;
  },

  onShow() {
    // Refresh data when page becomes visible
    const campaignId = (this.data.campaign as Campaign).id;
    if (campaignId) {
      this.loadProgress(campaignId);
    }
  },

  async loadCampaignData(campaignId: string) {
    this.setData({ loading: true });

    try {
      // First, ensure user is logged in
      if (!app.globalData.user) {
        await app.login();
      }

      // Load campaign details
      const campaignRes: any = await api.get(`/campaigns/${campaignId}`);
      const campaignData = campaignRes.data?.data || campaignRes.data;
      
      if (!campaignData?.campaign) {
        throw new Error('活动不存在');
      }

      const campaign = campaignData.campaign;
      const rewards = campaignData.rewards || [];

      // Calculate max helpers from rewards
      const maxHelpers = rewards.length > 0 
        ? Math.max(...rewards.map((r: CampaignReward) => r.helpers_required))
        : 8;

      this.setData({
        campaign,
        rewards,
        maxHelpers,
      });

      // Join campaign and load progress
      await this.joinAndLoadProgress(campaignId);

    } catch (error: any) {
      console.error('Load campaign error:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async joinAndLoadProgress(campaignId: string) {
    try {
      // Join campaign (will return existing participant if already joined)
      const joinRes: any = await api.post(`/campaigns/${campaignId}/join`);
      const joinData = joinRes.data?.data || joinRes.data;
      
      if (joinData?.participant) {
        const participant = joinData.participant;
        const sceneStr = joinData.sceneStr || '';
        
        // Calculate progress
        const progressPercent = this.calculateProgress(
          participant.helper_count || 0,
          this.data.maxHelpers
        );

        // Find next reward
        const nextReward = this.data.rewards.find(
          (r: CampaignReward) => (participant.helper_count || 0) < r.helpers_required
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
    } catch (error: any) {
      console.error('Join campaign error:', error);
      wx.showToast({
        title: error.message || '加入活动失败',
        icon: 'none',
      });
    }
  },

  async loadProgress(campaignId: string) {
    try {
      const progressRes: any = await api.get(`/campaigns/${campaignId}/my-progress`);
      const progressData = progressRes.data?.data || progressRes.data;
      
      if (progressData?.participant) {
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
    } catch (error: any) {
      console.error('Load progress error:', error);
    }
  },

  async loadHelpers(campaignId: string) {
    try {
      const progressRes: any = await api.get(`/campaigns/${campaignId}/my-progress`);
      const progressData = progressRes.data?.data || progressRes.data;
      
      if (progressData?.helpers) {
        this.setData({
          helpers: progressData.helpers,
        });
      }
    } catch (error: any) {
      console.error('Load helpers error:', error);
    }
  },

  calculateProgress(helperCount: number, maxHelpers: number): number {
    if (maxHelpers === 0) return 100;
    return Math.min(100, Math.round((helperCount / maxHelpers) * 100));
  },

  async generateQRCode() {
    const campaignId = this.data.campaign.id;
    if (!campaignId) return;

    this.setData({ qrCodeLoading: true });

    try {
      const qrRes: any = await api.get(`/campaigns/${campaignId}/qrcode`);
      const qrData = qrRes.data?.data || qrRes.data;
      
      if (qrData?.url) {
        // Load QR code image
        const token = wx.getStorageSync('token') || '';
        const apiBase = require('../../utils/config').API_BASE_URL;
        
        const response: any = await new Promise((resolve, reject) => {
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
    } catch (error: any) {
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

  formatTime(dateString: string): string {
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
