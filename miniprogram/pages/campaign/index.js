// pages/campaign/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    loading: true,
    campaign: {},
    rewards: [],
    rewardsWithStatus: [], // Rewards with claim status
    participant: {},
    helpers: [],
    sceneStr: '',
    qrCodeUrl: '',
    qrCodeLoading: false,
    progressPercent: 0,
    maxHelpers: 8,
    nextReward: null,
    showDebug: false, // Set to true for debugging
    claimedRewardIds: [], // IDs of claimed rewards
    showProfileModal: false,
    refreshing: false,
    refreshTimer: null,
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
      this.startAutoRefresh();
    }
    
    // Check profile authorization
    this.checkProfileAuthorization();
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  /**
   * Check if user has authorized their profile, prompt if not
   */
  checkProfileAuthorization() {
    setTimeout(() => {
      const hasProfile = app.hasUserProfile();
      const hasSkipped = wx.getStorageSync('profile_auth_skipped_campaign');
      
      if (!hasProfile && !hasSkipped) {
        this.setData({ showProfileModal: true });
      }
    }, 1000);
  },

  /**
   * User taps "Authorize" button in modal
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
      }
    } catch (error) {
      console.error('Authorize profile error:', error);
    }
  },

  /**
   * User taps "Skip" button in modal
   */
  skipProfile() {
    this.setData({ showProfileModal: false });
    wx.setStorageSync('profile_auth_skipped_campaign', true);
  },

  preventTouchMove() {
    return false;
  },

  /**
   * Start auto-refresh polling (every 5 seconds)
   */
  startAutoRefresh() {
    this.stopAutoRefresh(); // Clear any existing timer
    
    const campaignId = this.data.campaign.id;
    if (!campaignId) return;
    
    // Auto-refresh every 5 seconds
    const timer = setInterval(() => {
      console.log('Auto-refreshing progress...');
      this.loadProgress(campaignId);
      this.loadClaimableRewards(campaignId);
    }, 5000);
    
    this.setData({ refreshTimer: timer });
    
    // Stop after 10 minutes to save resources
    setTimeout(() => {
      this.stopAutoRefresh();
    }, 10 * 60 * 1000);
  },

  /**
   * Stop auto-refresh polling
   */
  stopAutoRefresh() {
    if (this.data.refreshTimer) {
      clearInterval(this.data.refreshTimer);
      this.setData({ refreshTimer: null });
    }
  },

  /**
   * Manual refresh button handler
   */
  async refreshProgress() {
    const campaignId = this.data.campaign.id;
    if (!campaignId || this.data.refreshing) return;
    
    this.setData({ refreshing: true });
    
    try {
      await Promise.all([
        this.loadProgress(campaignId),
        this.loadClaimableRewards(campaignId),
      ]);
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000,
      });
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      this.setData({ refreshing: false });
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
      
      // Start auto-refresh
      this.startAutoRefresh();

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

        // Load helpers and claimable rewards
        await this.loadHelpers(campaignId);
        await this.loadClaimableRewards(campaignId);
      }
    } catch (error) {
      console.error('Join campaign error:', error);
      wx.showToast({
        title: (error && error.message) ? error.message : '加入活动失败',
        icon: 'none',
      });
    }
  },

  async loadClaimableRewards(campaignId) {
    try {
      const claimableRes = await api.get(`/campaigns/${campaignId}/rewards/claimable`);
      const claimableData = (claimableRes.data && claimableRes.data.data) ? claimableRes.data.data : claimableRes.data;
      
      if (claimableData && claimableData.rewards) {
        // Also load claimed rewards
        const claimsRes = await api.get(`/campaigns/${campaignId}/my-claims`);
        const claimsData = (claimsRes.data && claimsRes.data.data) ? claimsRes.data.data : claimsRes.data;
        const claims = (claimsData && claimsData.claims) ? claimsData.claims : [];
        
        // Create a map of claimed reward IDs
        const claimedMap = {};
        claims.forEach(claim => {
          claimedMap[claim.reward_id] = claim;
        });
        
        // Merge with claimable status
        const rewardsWithStatus = claimableData.rewards.map(item => ({
          reward: item.reward,
          canClaim: item.canClaim && !claimedMap[item.reward.id],
          claimed: !!claimedMap[item.reward.id],
          claim: claimedMap[item.reward.id] || null,
        }));
        
        this.setData({
          rewardsWithStatus,
          claimedRewardIds: claims.map(c => c.reward_id),
        });
      }
    } catch (error) {
      console.error('Load claimable rewards error:', error);
    }
  },

  async claimReward(e) {
    const rewardId = e.currentTarget.dataset.rewardId;
    const campaignId = this.data.campaign.id;
    
    if (!rewardId || !campaignId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '领取中...' });

    try {
      const claimRes = await api.post(`/campaigns/${campaignId}/rewards/${rewardId}/claim`);
      const claimData = (claimRes.data && claimRes.data.data) ? claimRes.data.data : claimRes.data;
      
      wx.hideLoading();
      
      if (claimRes.data && claimRes.data.success) {
        wx.showToast({ title: '领取成功！', icon: 'success' });
        
        // Refresh claimable rewards
        await this.loadClaimableRewards(campaignId);
        
        // Show reward content
        if (claimData && claimData.reward) {
          this.showRewardContent(claimData.reward);
        }
      } else {
        wx.showToast({ 
          title: (claimRes.data && claimRes.data.error) ? claimRes.data.error : '领取失败', 
          icon: 'none' 
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('Claim reward error:', error);
      wx.showToast({ 
        title: (error && error.message) ? error.message : '领取失败', 
        icon: 'none' 
      });
    }
  },

  viewReward(e) {
    const reward = e.currentTarget.dataset.reward;
    const claim = e.currentTarget.dataset.claim;
    
    if (reward) {
      this.showRewardContent(reward);
    }
  },

  showRewardContent(reward) {
    const content = reward.reward_content || {};
    let message = `🎁 ${reward.reward_name}\n\n`;
    
    if (content.description) {
      message += `${content.description}\n\n`;
    }
    
    if (content.download_url) {
      message += `📥 下载链接：\n${content.download_url}\n\n`;
    }
    
    if (content.booking_url) {
      message += `📅 预约链接：\n${content.booking_url}\n\n`;
    }
    
    // Show modal with reward content
    wx.showModal({
      title: '奖品详情',
      content: message,
      showCancel: content.download_url || content.booking_url,
      cancelText: '关闭',
      confirmText: content.download_url ? '复制链接' : '确定',
      success: (res) => {
        if (res.confirm && (content.download_url || content.booking_url)) {
          const url = content.download_url || content.booking_url;
          wx.setClipboardData({
            data: url,
            success: () => {
              wx.showToast({ title: '链接已复制', icon: 'success' });
            },
          });
        }
      },
    });
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
