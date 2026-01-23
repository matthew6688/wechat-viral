// pages/home/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    user: null,
    points: 0,
    tasks: null,
    logs: null,
    showProfileModal: false,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    if (app.globalData.user) {
      this.setData({ user: app.globalData.user });
      this.loadData();
      this.checkProfileAuthorization();
    } else {
      wx.redirectTo({ url: '/pages/landing/index' });
    }
  },

  /**
   * Check if user has authorized their profile, prompt if not
   */
  checkProfileAuthorization() {
    setTimeout(() => {
      const hasProfile = app.hasUserProfile();
      const hasSkipped = wx.getStorageSync('profile_auth_skipped_home');
      
      if (!hasProfile && !hasSkipped) {
        this.setData({ showProfileModal: true });
      }
    }, 800); // Delay a bit to let the page load first
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
        // Refresh user data
        this.setData({ user: app.globalData.user });
      }
    } catch (error) {
      console.error('Authorize profile error:', error);
      wx.showToast({
        title: '授权失败',
        icon: 'none',
      });
    }
  },

  /**
   * User taps "Skip" button in modal
   */
  skipProfile() {
    this.setData({ showProfileModal: false });
    wx.setStorageSync('profile_auth_skipped_home', true);
  },

  preventTouchMove() {
    return false;
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  },

  async loadData() {
    try {
      const [pointsRes, tasksRes, logsRes] = await Promise.all([
        api.get('/points/balance'),
        api.get('/tasks'),
        api.get('/points/logs'),
      ]);

      const tasks = (tasksRes.data && tasksRes.data.data && tasksRes.data.data.tasks) ? tasksRes.data.data.tasks : 
                    (tasksRes.data && tasksRes.data.tasks) ? tasksRes.data.tasks : null;
      const logs = (logsRes.data && logsRes.data.data && logsRes.data.data.logs) ? logsRes.data.data.logs : 
                   (logsRes.data && logsRes.data.logs) ? logsRes.data.logs : null;
      
      const safeTasks = Array.isArray(tasks) ? tasks : [];
      let safeLogs = Array.isArray(logs) ? logs : [];
      
      safeLogs = safeLogs.map(log => ({
        ...log,
        formatted_date: this.formatDate(log.created_at)
      }));
      
      this.setData({
        points: (pointsRes.data && pointsRes.data.data && pointsRes.data.data.balance) ? pointsRes.data.data.balance : 
                (pointsRes.data && pointsRes.data.balance) ? pointsRes.data.balance : 0,
        tasks: safeTasks,
        logs: safeLogs,
      });
    } catch (error) {
      console.error('Load data error:', error);
    }
  },

  async completeTask(e) {
    const taskId = e.currentTarget.dataset.id;
    try {
      await api.post(`/tasks/${taskId}/complete`);
      wx.showToast({ title: '任务完成', icon: 'success' });
      this.loadData();
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  goToRewards() {
    wx.switchTab({ url: '/pages/rewards/index' });
  },

  goToInvite() {
    wx.switchTab({ url: '/pages/invite/index' });
  },

  goToCampaign() {
    // Navigate to campaigns list
    wx.navigateTo({ 
      url: '/pages/campaigns/index' 
    });
  },
});
