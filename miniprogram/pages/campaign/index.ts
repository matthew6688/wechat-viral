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
  reward_type?: string;
  reward_content?: Record<string, any>;
  claim_method?: string;
  claim_link?: string;
  claim_text?: string;
}

interface RewardWithStatus {
  reward: CampaignReward;
  canClaim: boolean;
  claimed: boolean;
  claim?: RewardClaim;
}

interface RewardClaim {
  id: string;
  reward_id: string;
  claimed_at: string;
  reward_content?: Record<string, any>;
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
    rewardsWithStatus: [] as RewardWithStatus[], // Rewards with claim status
    participant: {} as CampaignParticipant,
    helpers: [] as CampaignHelper[],
    sceneStr: '',
    qrCodeUrl: '',
    qrCodeLoading: false,
    posterLoading: false, // Poster generation state
    progressPercent: 0,
    maxHelpers: 8,
    nextReward: null as CampaignReward | null,
    showDebug: false, // Set to true for debugging
    showProfileModal: false, // Profile authorization modal
    refreshing: false, // Manual refresh state
    pollTimer: null as any, // Smart polling timer
    lastPollTime: 0, // Track last poll time
    claimingRewardId: null as string | null, // Currently claiming reward
    showRewardModal: false, // Show reward content modal
    claimedRewardContent: null as any, // Content of claimed reward
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
    
    // Start smart polling for real-time updates
    this.startSmartPolling(campaignId);
  },

  onShow() {
    // Refresh data when page becomes visible
    const campaignId = (this.data.campaign as Campaign)?.id;
    if (campaignId) {
      this.loadProgress(campaignId);
      // Restart polling if it was stopped
      this.startSmartPolling(campaignId);
    }
  },

  onHide() {
    // Stop polling when page is hidden
    this.stopPolling();
  },

  onUnload() {
    // Clean up polling timer when leaving page
    this.stopPolling();
  },

  /**
   * Start smart polling - refresh every 5 seconds
   */
  startSmartPolling(campaignId: string) {
    this.stopPolling(); // Clear any existing timer
    
    const pollInterval = 5000; // 5 seconds
    const maxPollDuration = 10 * 60 * 1000; // Stop after 10 minutes of inactivity
    
    this.setData({ lastPollTime: Date.now() });
    
    const timer = setInterval(() => {
      // Stop polling after max duration
      if (Date.now() - this.data.lastPollTime > maxPollDuration) {
        console.log('Stopping polling due to inactivity');
        this.stopPolling();
        return;
      }
      
      // Silently refresh progress
      this.loadProgress(campaignId);
    }, pollInterval);
    
    this.setData({ pollTimer: timer });
    console.log('Smart polling started (5s interval)');
  },

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
      this.setData({ pollTimer: null });
      console.log('Polling stopped');
    }
  },

  /**
   * Manual refresh triggered by user
   */
  async refreshProgress() {
    const campaignId = (this.data.campaign as Campaign)?.id;
    if (!campaignId || this.data.refreshing) return;
    
    this.setData({ refreshing: true, lastPollTime: Date.now() });
    
    try {
      await this.loadProgress(campaignId);
      wx.showToast({ title: '已刷新', icon: 'success', duration: 1000 });
    } catch (error) {
      console.error('Refresh error:', error);
      wx.showToast({ title: '刷新失败', icon: 'none', duration: 1000 });
    } finally {
      this.setData({ refreshing: false });
    }
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
        
        // Also load rewards with status
        const rewardsWithStatus = progressData.rewardsWithStatus || [];

        this.setData({
          participant,
          helpers,
          progressPercent,
          nextReward,
          rewardsWithStatus,
        });
      }
    } catch (error: any) {
      console.error('Load progress error:', error);
    }
  },

  /**
   * Claim a reward
   */
  async claimReward(e: any) {
    const rewardId = e.currentTarget.dataset.rewardId;
    const campaignId = this.data.campaign.id;
    
    if (!rewardId || !campaignId || this.data.claimingRewardId) return;
    
    this.setData({ claimingRewardId: rewardId });
    
    wx.showLoading({ title: '领取中...' });
    
    try {
      const claimRes: any = await api.post(`/campaigns/${campaignId}/rewards/${rewardId}/claim`);
      const claimData = claimRes.data?.data || claimRes.data;
      
      wx.hideLoading();
      
      if (claimData?.success) {
        wx.showToast({
          title: '领取成功！',
          icon: 'success',
        });
        
        // Refresh rewards list
        await this.loadProgress(campaignId);
        
        // Show reward content
        if (claimData.reward) {
          this.showRewardContent(claimData.reward);
        }
      } else {
        wx.showToast({
          title: claimData?.message || '领取失败',
          icon: 'none',
        });
      }
    } catch (error: any) {
      wx.hideLoading();
      console.error('Claim reward error:', error);
      wx.showToast({
        title: error.message || '领取失败',
        icon: 'none',
      });
    } finally {
      this.setData({ claimingRewardId: null });
    }
  },
  
  /**
   * View already claimed reward
   */
  viewReward(e: any) {
    const reward = e.currentTarget.dataset.reward;
    const claim = e.currentTarget.dataset.claim;
    
    if (reward) {
      this.showRewardContent({
        ...reward,
        claim_content: claim?.reward_content || reward.reward_content,
      });
    }
  },
  
  /**
   * Show reward content in modal or navigate
   */
  showRewardContent(reward: any) {
    const claimMethod = reward.claim_method || 'link';
    
    if (claimMethod === 'link' && reward.claim_link) {
      // Show option to copy link
      wx.showModal({
        title: '🎉 恭喜获得奖品！',
        content: `${reward.reward_name}\n\n领取链接已复制到剪贴板，请在浏览器中打开`,
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          wx.setClipboardData({
            data: reward.claim_link,
          });
        },
      });
    } else if (claimMethod === 'text' && reward.claim_text) {
      // Show text content
      wx.showModal({
        title: '🎉 恭喜获得奖品！',
        content: `${reward.reward_name}\n\n${reward.claim_text}`,
        showCancel: false,
        confirmText: '知道了',
      });
    } else if (claimMethod === 'activation_code') {
      // Show activation code
      const code = reward.claim_content?.activation_code || 
                   reward.reward_content?.activation_code || 
                   '获取中...';
      wx.showModal({
        title: '🎉 恭喜获得奖品！',
        content: `${reward.reward_name}\n\n激活码：${code}\n\n（已复制到剪贴板）`,
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          if (code !== '获取中...') {
            wx.setClipboardData({
              data: code,
            });
          }
        },
      });
    } else {
      // Default - show reward info
      wx.showModal({
        title: '🎉 恭喜获得奖品！',
        content: `${reward.reward_name}\n\n${reward.reward_description || ''}`,
        showCancel: false,
        confirmText: '知道了',
      });
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

  /**
   * Generate and save poster to album
   */
  async generatePoster() {
    const campaign = this.data.campaign;
    if (!campaign || !campaign.id) {
      wx.showToast({
        title: '活动数据加载中，请稍后再试',
        icon: 'none',
      });
      return;
    }
    const campaignId = campaign.id;

    wx.showLoading({ title: '生成海报中...' });

    try {
      const token = wx.getStorageSync('token') || '';
      const apiBase = require('../../utils/config').API_BASE_URL;
      
      // Call poster API to get base64 image
      const response: any = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/campaigns/${campaignId}/poster/base64`,
          method: 'GET',
          header: token ? { 'Authorization': `Bearer ${token}` } : {},
          success: resolve,
          fail: reject,
        });
      });

      if (response.statusCode !== 200 || !response.data?.success) {
        throw new Error(response.data?.error || '生成海报失败');
      }

      const posterData = response.data.data.poster; // data:image/png;base64,...
      
      // Convert base64 to temp file
      const base64Data = posterData.split(',')[1];
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/poster_${campaignId}_${Date.now()}.png`;
      
      await new Promise<void>((resolve, reject) => {
        fs.writeFile({
          filePath,
          data: base64Data,
          encoding: 'base64',
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });

      wx.hideLoading();

      // Show action sheet to preview or save
      const res = await new Promise<WechatMiniprogram.ShowActionSheetSuccessCallbackResult>((resolve, reject) => {
        wx.showActionSheet({
          itemList: ['预览海报', '保存到相册'],
          success: resolve,
          fail: reject,
        });
      });

      if (res.tapIndex === 0) {
        // Preview
        wx.previewImage({
          urls: [filePath],
          current: filePath,
        });
      } else if (res.tapIndex === 1) {
        // Save to album
        await this.savePosterToAlbum(filePath);
      }

    } catch (error: any) {
      wx.hideLoading();
      if (error.errMsg !== 'showActionSheet:fail cancel') {
        console.error('Generate poster error:', error);
        wx.showToast({
          title: error.message || '生成海报失败',
          icon: 'none',
        });
      }
    }
  },

  /**
   * Save poster image to photo album
   */
  async savePosterToAlbum(filePath: string) {
    try {
      // Check album write permission
      const setting = await new Promise<WechatMiniprogram.AuthSetting>((resolve, reject) => {
        wx.getSetting({
          success: (res) => resolve(res.authSetting),
          fail: reject,
        });
      });

      if (!setting['scope.writePhotosAlbum']) {
        // Request permission
        await new Promise<void>((resolve, reject) => {
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => resolve(),
            fail: () => {
              // User denied, show settings modal
              wx.showModal({
                title: '需要相册权限',
                content: '请在设置中开启相册写入权限以保存海报',
                confirmText: '去设置',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                },
              });
              reject(new Error('用户拒绝授权'));
            },
          });
        });
      }

      // Save to album
      await new Promise<void>((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath,
          success: () => resolve(),
          fail: reject,
        });
      });

      wx.showToast({
        title: '已保存到相册',
        icon: 'success',
      });
    } catch (error: any) {
      console.error('Save to album error:', error);
      if (error.message !== '用户拒绝授权') {
        wx.showToast({
          title: '保存失败',
          icon: 'none',
        });
      }
    }
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
