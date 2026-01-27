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
    remainingHelpers: 0,
    currentRewardIndex: -1,
    showDebug: false, // Set to true for debugging
    claimedRewardIds: [], // IDs of claimed rewards
    showProfileModal: false,
    showFollowOAModal: false, // 引导关注公众号弹窗
    oaFollowQRCode: '', // 公众号关注二维码
    hasFollowedOA: false, // 是否已关注公众号
    oaPollingStatus: '', // 轮询状态提示
    refreshing: false,
    refreshTimer: null,
    oaFollowPollingTimer: null, // 公众号关注状态轮询定时器
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
      // Reload campaign details to sync any changes from admin
      this.loadCampaignData(campaignId);
      this.startAutoRefresh();
    }
    
    // Check profile authorization
    this.checkProfileAuthorization();
    
    // Check OA follow status
    this.checkOAFollowStatus();
  },

  onHide() {
    this.stopAutoRefresh();
    this.stopOAFollowPolling();
  },

  onUnload() {
    this.stopAutoRefresh();
    this.stopOAFollowPolling();
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
    
    // After profile modal is dismissed, check OA follow status
    setTimeout(() => {
      this.checkOAFollowStatus(true); // immediate check
    }, 500);
  },

  /**
   * User taps "Skip" button in modal
   */
  skipProfile() {
    this.setData({ showProfileModal: false });
    wx.setStorageSync('profile_auth_skipped_campaign', true);
    
    // After profile modal is dismissed, check OA follow status
    setTimeout(() => {
      this.checkOAFollowStatus(true); // immediate check
    }, 500);
  },

  /**
   * Check if user has followed the Official Account
   * Show prompt if not followed
   * @param {boolean} immediate - If true, don't use setTimeout
   */
  checkOAFollowStatus(immediate = false) {
    const doCheck = () => {
      const user = app.globalData.user;
      const hasFollowedOA = user && user.openid_oa;
      const hasSkipped = wx.getStorageSync('oa_follow_skipped_campaign');
      
      console.log('[OA Check] User:', user?.id, 'hasFollowedOA:', hasFollowedOA, 'hasSkipped:', hasSkipped, 'showProfileModal:', this.data.showProfileModal);
      
      this.setData({ hasFollowedOA: !!hasFollowedOA });
      
      // If not followed and not skipped, show prompt (only if profile modal is not showing)
      if (!hasFollowedOA && !hasSkipped && !this.data.showProfileModal) {
        console.log('[OA Check] Showing OA follow modal');
        this.setData({ showFollowOAModal: true });
        // Load OA QR code
        this.loadOAFollowQRCode();
        // Start polling to detect when user follows
        this.startOAFollowPolling();
      }
    };
    
    if (immediate) {
      doCheck();
    } else {
      setTimeout(doCheck, 1500); // Delay to let profile modal show first
    }
  },

  /**
   * Start polling to detect OA follow status
   * Checks every 3 seconds, stops after 90 seconds
   */
  startOAFollowPolling() {
    this.stopOAFollowPolling(); // Clear any existing timer
    
    console.log('[OA Polling] Starting polling for OA follow status...');
    this.setData({ oaPollingStatus: '等待关注...' });
    
    let pollCount = 0;
    const maxPolls = 30; // 30 polls * 3 seconds = 90 seconds max
    
    const timer = setInterval(async () => {
      pollCount++;
      console.log(`[OA Polling] Poll #${pollCount}`);
      
      if (pollCount >= maxPolls) {
        console.log('[OA Polling] Max polls reached, stopping');
        this.stopOAFollowPolling();
        this.setData({ oaPollingStatus: '检测超时，请点击"我已关注"' });
        return;
      }
      
      try {
        // Fetch latest user data from server
        const response = await api.get('/users/me');
        const userData = (response.data && response.data.data) ? response.data.data : response.data;
        
        if (userData && userData.openid_oa) {
          console.log('[OA Polling] User has followed OA!', userData.openid_oa);
          
          // Update local user data
          app.globalData.user = userData;
          wx.setStorageSync('user', userData);
          
          // Stop polling and close modal
          this.stopOAFollowPolling();
          this.setData({
            hasFollowedOA: true,
            showFollowOAModal: false,
            oaPollingStatus: '',
          });
          
          wx.showToast({
            title: '关注成功！',
            icon: 'success',
          });
        } else {
          this.setData({ oaPollingStatus: `检测中... (${pollCount}/${maxPolls})` });
        }
      } catch (error) {
        console.error('[OA Polling] Error checking status:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    this.setData({ oaFollowPollingTimer: timer });
  },

  /**
   * Stop OA follow polling
   */
  stopOAFollowPolling() {
    const timer = this.data.oaFollowPollingTimer;
    if (timer) {
      console.log('[OA Polling] Stopping polling');
      clearInterval(timer);
      this.setData({ oaFollowPollingTimer: null, oaPollingStatus: '' });
    }
  },

  /**
   * Load the OA linking QR code for the current user
   * This QR code links the MP user with their OA account when scanned
   */
  async loadOAFollowQRCode() {
    const user = app.globalData.user;
    if (!user || !user.id) return;

    try {
      const apiBase = require('../../utils/config').API_BASE_URL;
      const token = wx.getStorageSync('token') || '';
      
      // Get LINKING QR code info (includes user_id in scene)
      const qrInfoResponse = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/oa/linking-qrcode`,
          method: 'GET',
          header: token ? { 'Authorization': `Bearer ${token}` } : {},
          success: resolve,
          fail: reject,
        });
      });
      
      console.log('[OA QRCode] Linking QRCode response:', qrInfoResponse.data);
      
      const qrInfo = (qrInfoResponse.data && qrInfoResponse.data.data) 
        ? qrInfoResponse.data.data 
        : qrInfoResponse.data;
      
      if (qrInfo && qrInfo.ticket) {
        // Get QR code image
        const imageResponse = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiBase}/oa/qrcode-image/${qrInfo.ticket}`,
            method: 'GET',
            responseType: 'arraybuffer',
            header: token ? { 'Authorization': `Bearer ${token}` } : {},
            success: resolve,
            fail: reject,
          });
        });
        
        if (imageResponse.statusCode === 200 && imageResponse.data instanceof ArrayBuffer) {
          const base64 = wx.arrayBufferToBase64(imageResponse.data);
          this.setData({
            oaFollowQRCode: `data:image/png;base64,${base64}`,
          });
          console.log('[OA QRCode] Linking QRCode loaded successfully, scene:', qrInfo.sceneStr);
        }
      }
    } catch (error) {
      console.error('Load OA linking QR code error:', error);
    }
  },

  /**
   * Show follow OA prompt modal when user taps the banner
   */
  showFollowOAPrompt() {
    this.setData({ showFollowOAModal: true });
    this.loadOAFollowQRCode();
  },

  /**
   * User taps "Later" button in OA follow modal
   */
  skipFollowOA() {
    this.stopOAFollowPolling();
    this.setData({ showFollowOAModal: false });
    wx.setStorageSync('oa_follow_skipped_campaign', true);
  },

  /**
   * User taps "Done" button after following OA
   */
  async confirmFollowedOA() {
    // Stop polling first
    this.stopOAFollowPolling();
    
    // Refresh user data to check if they've followed
    wx.showLoading({ title: '检查中...' });
    
    try {
      // Fetch latest user data from server
      const response = await api.get('/users/me');
      const userData = (response.data && response.data.data) ? response.data.data : response.data;
      
      if (userData && userData.openid_oa) {
        // Update local user data
        app.globalData.user = userData;
        wx.setStorageSync('user', userData);
        
        this.setData({ 
          hasFollowedOA: true,
          showFollowOAModal: false,
        });
        wx.hideLoading();
        wx.showToast({
          title: '关注成功！',
          icon: 'success',
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: '请先关注公众号',
          icon: 'none',
        });
        // Show modal again and restart polling
        setTimeout(() => {
          this.setData({ showFollowOAModal: true });
          this.startOAFollowPolling();
        }, 1500);
      }
    } catch (error) {
      wx.hideLoading();
      console.error('Check follow status error:', error);
    }
  },

  /**
   * Preview OA QR code for easier scanning
   */
  previewOAQRCode() {
    if (!this.data.oaFollowQRCode) return;
    
    const base64Data = this.data.oaFollowQRCode.split(',')[1];
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/oa_qr_${Date.now()}.png`;
    
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
        console.error('Save OA QR code error:', err);
      },
    });
  },

  preventTouchMove() {
    return false;
  },

  /**
   * Start auto-refresh polling (every 10 seconds)
   */
  startAutoRefresh() {
    this.stopAutoRefresh(); // Clear any existing timer
    
    const campaignId = this.data.campaign.id;
    if (!campaignId) return;
    
    // Auto-refresh every 10 seconds (reduced from 5 seconds to reduce noise)
    const timer = setInterval(() => {
      // Silently refresh without console.log
      this.loadProgress(campaignId).catch(err => {
        // Only log errors, don't show toast for auto-refresh
        console.error('[Auto-refresh] Load progress error:', err);
      });
      this.loadClaimableRewards(campaignId).catch(err => {
        // Only log errors, don't show toast for auto-refresh
        console.error('[Auto-refresh] Load claimable rewards error:', err);
      });
    }, 10000); // Changed from 5000 to 10000 (10 seconds)
    
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
   * Refresh button handler (called from wxml)
   */
  refreshPage() {
    this.refreshProgress();
  },

  /**
   * Manual refresh button handler
   * Refreshes both campaign details and progress
   */
  async refreshProgress() {
    const campaignId = this.data.campaign.id;
    if (!campaignId || this.data.refreshing) return;
    
    this.setData({ refreshing: true });
    
    try {
      // Refresh campaign details (name, description, rewards, etc.)
      await this.loadCampaignData(campaignId);
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1000,
      });
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

      // Calculate total helpers required (max of all rewards' helpers_required)
      // helpers_required represents "总共需要多少人" (total helpers needed to unlock this reward)
      // So the max progress is the maximum helpers_required among all rewards
      const maxHelpers = rewards.length > 0 
        ? Math.max(...rewards.map(r => (r.helpers_required || r.required_helpers || 0)), 0)
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
        
        // Use maxHelpers (calculated from rewards) as the target
        // This ensures consistency with the progress display
        const targetHelpers = this.data.maxHelpers || 8;
        const progressPercent = this.calculateProgress(
          participant.helper_count || 0,
          targetHelpers
        );

        // Find next reward
        const nextReward = this.data.rewards.find(
          r => (participant.helper_count || 0) < (r.helpers_required || r.required_helpers || 0)
        ) || null;

        // Calculate remaining helpers based on target (maxHelpers from rewards)
        const remainingHelpers = Math.max(0, targetHelpers - (participant.helper_count || 0));
        
        // Find current reward index (the NEXT reward to unlock, not the highest unlocked)
        // If helper_count = 1 and required = 1, the reward is unlocked, so currentRewardIndex should point to the next one
        const helperCount = participant.helper_count || 0;
        let currentRewardIndex = -1;
        if (this.data.rewards && this.data.rewards.length > 0) {
          // Find the first reward that is NOT yet unlocked
          for (let i = 0; i < this.data.rewards.length; i++) {
            const reward = this.data.rewards[i];
            const required = reward.helpers_required || reward.required_helpers || 0;
            if (helperCount < required) {
              currentRewardIndex = i;
              break;
            }
          }
          // If all rewards are unlocked, set to last index
          if (currentRewardIndex === -1) {
            currentRewardIndex = this.data.rewards.length - 1;
          }
        }

        this.setData({
          participant,
          participation: participant, // Fix: Also update participation for wxml
          sceneStr,
          progressPercent,
          nextReward,
          remainingHelpers,
          currentRewardIndex,
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
      // Only log errors, don't show toast for auto-refresh
      console.error('[Load Claimable Rewards] Error:', error);
      // Don't show toast for background refresh errors
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

  onRewardClick(e) {
    const rewardFromDataset = e.currentTarget.dataset.reward;
    const index = e.currentTarget.dataset.index;
    
    // Get the reward from the rewards array to ensure we have the correct data
    // The dataset might not preserve all fields correctly, so use the index to get from array
    const actualReward = (this.data.rewards && this.data.rewards[index]) ? this.data.rewards[index] : rewardFromDataset;
    
    // Use the same data source and field order as wxml
    // wxml uses: participation.helper_count
    const helperCount = this.data.participation?.helper_count || this.data.participant?.helper_count || 0;
    
    // Match the exact field order used in wxml: required_helpers || helpers_required
    // Backend returns helpers_required, but wxml checks required_helpers first
    const required = actualReward.required_helpers || actualReward.helpers_required || 0;
    
    // Debug logging to identify the issue
    console.log('[Reward Click] Debug:', {
      index: index,
      rewardName: actualReward.reward_name || actualReward.name,
      rewardId: actualReward.id,
      helperCount: helperCount,
      required: required,
      rewardFields: {
        required_helpers: actualReward.required_helpers,
        helpers_required: actualReward.helpers_required,
      },
      allRewards: this.data.rewards?.map((r, i) => ({
        index: i,
        name: r.reward_name || r.name,
        required_helpers: r.required_helpers,
        helpers_required: r.helpers_required,
      }))
    });
    
    // Check if reward is unlocked (same logic as wxml)
    if (helperCount >= required) {
      // Reward is unlocked, show how to redeem
      // Check if already claimed
      const isClaimed = this.data.claimedRewardIds?.includes(actualReward.id);
      
      if (isClaimed) {
        // Already claimed, show reward content
        this.showRewardContent(actualReward);
      } else {
        // Not claimed yet, show claim option
        wx.showModal({
          title: '领取奖品',
          content: `您已解锁"${actualReward.reward_name || actualReward.name}"，是否立即领取？`,
          success: (res) => {
            if (res.confirm) {
              this.claimReward({ currentTarget: { dataset: { rewardId: actualReward.id } } });
            }
          }
        });
      }
    } else {
      // Reward not unlocked yet
      const remaining = required - helperCount;
      console.log('[Reward Click] Calculation:', {
        required: required,
        helperCount: helperCount,
        remaining: remaining,
        rewardName: actualReward.reward_name || actualReward.name
      });
      wx.showToast({
        title: `还需 ${remaining} 人助力才能解锁此奖品`,
        icon: 'none',
        duration: 2000
      });
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
        
        // Use maxHelpers (calculated from rewards) as the target
        const targetHelpers = this.data.maxHelpers || 8;
        const progressPercent = this.calculateProgress(
          participant.helper_count || 0,
          targetHelpers
        );

        const nextReward = progressData.nextReward || null;

        // Calculate remaining helpers based on target (maxHelpers from rewards)
        const remainingHelpers = Math.max(0, targetHelpers - (participant.helper_count || 0));
        
        // Find current reward index (the NEXT reward to unlock)
        const helperCount = participant.helper_count || 0;
        let currentRewardIndex = -1;
        if (this.data.rewards && this.data.rewards.length > 0) {
          // Find the first reward that is NOT yet unlocked
          for (let i = 0; i < this.data.rewards.length; i++) {
            const reward = this.data.rewards[i];
            const required = reward.helpers_required || reward.required_helpers || 0;
            if (helperCount < required) {
              currentRewardIndex = i;
              break;
            }
          }
          // If all rewards are unlocked, set to last index
          if (currentRewardIndex === -1) {
            currentRewardIndex = this.data.rewards.length - 1;
          }
        }

        this.setData({
          participant,
          participation: participant, // Fix: Also update participation for wxml
          helpers,
          progressPercent,
          nextReward,
          remainingHelpers,
          currentRewardIndex,
        });
      }
    } catch (error) {
      // Only log errors, don't show toast for auto-refresh
      console.error('[Load Progress] Error:', error);
      // Don't show toast for background refresh errors
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
    
    // Check if user has followed OA - warn if not
    if (!this.data.hasFollowedOA) {
      const res = await new Promise((resolve) => {
        wx.showModal({
          title: '提示',
          content: '您还未关注公众号，关注后才能收到好友助力通知。是否先关注公众号？',
          confirmText: '去关注',
          cancelText: '继续生成',
          success: resolve,
        });
      });
      
      if (res.confirm) {
        // User chose to follow OA first
        this.setData({ showFollowOAModal: true });
        this.loadOAFollowQRCode();
        this.startOAFollowPolling();
        return;
      }
      // User chose to continue without following - proceed with poster generation
    }
    
    const campaignId = campaign.id;

    wx.showLoading({ title: '生成海报中...' });

    try {
      // Use the api service instead of direct wx.request for better error handling
      const response = await api.get(`/campaigns/${campaignId}/poster/base64`);

      if (!response.data || !response.data.success) {
        throw new Error((response.data && response.data.error) || '生成海报失败');
      }

      const posterData = response.data.data.poster; // data:image/png;base64,...
      
      if (!posterData) {
        throw new Error('海报数据为空');
      }
      
      // Convert base64 to temp file
      // Handle both formats: "data:image/png;base64,xxx" and "xxx"
      const base64Data = posterData.includes(',') ? posterData.split(',')[1] : posterData;
      const fs = wx.getFileSystemManager();
      
      // Clean up old poster files before creating new one to avoid storage limit
      try {
        const dirPath = wx.env.USER_DATA_PATH;
        const files = fs.readdirSync(dirPath);
        const posterFiles = files.filter((file) => file.startsWith('poster_'));
        
        // Keep only the 3 most recent poster files, delete older ones
        if (posterFiles.length > 3) {
          const sortedFiles = posterFiles.sort().reverse(); // Sort by name (timestamp)
          const filesToDelete = sortedFiles.slice(3); // Keep first 3, delete the rest
          
          for (const file of filesToDelete) {
            try {
              fs.unlinkSync(`${dirPath}/${file}`);
              console.log(`[Poster] Deleted old poster file: ${file}`);
            } catch (unlinkErr) {
              console.warn(`[Poster] Failed to delete ${file}:`, unlinkErr);
            }
          }
        }
      } catch (cleanupErr) {
        // If cleanup fails, continue anyway (might be first time or permission issue)
        console.warn('[Poster] Cleanup warning:', cleanupErr);
      }
      
      const filePath = `${wx.env.USER_DATA_PATH}/poster_${campaignId}_${Date.now()}.png`;
      
      await new Promise((resolve, reject) => {
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
      const res = await new Promise((resolve, reject) => {
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

    } catch (error) {
      wx.hideLoading();
      if (error.errMsg !== 'showActionSheet:fail cancel') {
        console.error('Generate poster error:', error);
        wx.showToast({
          title: error.message || error.errMsg || '生成海报失败',
          icon: 'none',
          duration: 3000,
        });
      }
    }
  },

  /**
   * Save poster image to photo album
   */
  async savePosterToAlbum(filePath) {
    try {
      // Check album write permission
      const setting = await new Promise((resolve, reject) => {
        wx.getSetting({
          success: (res) => resolve(res.authSetting),
          fail: reject,
        });
      });

      if (!setting['scope.writePhotosAlbum']) {
        // Request permission
        await new Promise((resolve, reject) => {
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
      await new Promise((resolve, reject) => {
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
    } catch (error) {
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
