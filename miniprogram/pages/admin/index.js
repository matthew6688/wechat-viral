// pages/admin/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    isAdmin: false,
    currentTab: 'debug',
    loading: false,
    
    followEvents: [],
    scanEvents: [],
    referralChain: null,
    selectedUserId: '',
    selectedUserIndex: 0,
    users: [],
    
    stats: {
      totalUsers: 0,
      todayUsers: 0,
      totalScans: 0,
      totalFollows: 0,
      totalInvites: 0,
      conversionRate: 0,
    },

    settings: {
      activity: null,
    },
  },

  onLoad() {
    this.checkAdminStatus();
  },

  async checkAdminStatus() {
    this.setData({ loading: true });
    try {
      const response = await api.get('/users/me');
      const userData = (response.data && response.data.data) ? response.data.data : response.data;
      if (userData && userData.is_admin) {
        this.setData({ isAdmin: true, user: userData });
        this.loadDebugData();
        this.loadSettings();
        this.loadUsersForSelection();
      } else {
        wx.showToast({
          title: '无管理员权限',
          icon: 'none',
        });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/index' });
        }, 1500);
      }
    } catch (error) {
      console.error('Check admin status error:', error);
      wx.showToast({
        title: '检查管理员状态失败',
        icon: 'none',
      });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/index' });
      }, 1500);
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    if (tab === 'debug') {
      this.loadDebugData();
      this.loadUsersForSelection();
    } else if (tab === 'settings') {
      this.loadSettings();
    }
  },

  async loadDebugData() {
    this.setData({ loading: true });
    try {
      const response = await api.get('/admin/debug/oa-events');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      this.setData({
        followEvents: (data && data.followEvents) ? data.followEvents : [],
        scanEvents: (data && data.scanEvents) ? data.scanEvents : [],
      });
      this.calculateStats();
    } catch (error) {
      console.error('Load debug data error:', error);
      wx.showToast({
        title: '加载调试数据失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadUsersForSelection() {
    try {
      const response = await api.get('/admin/users');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      const users = (data && data.users) ? data.users : [];
      this.setData({ users, selectedUserIndex: 0 });
      if (users.length > 0) {
        this.setData({ selectedUserId: users[0].id });
        this.loadReferralChain(users[0].id);
      }
    } catch (error) {
      console.error('Load users for selection error:', error);
    }
  },

  async loadReferralChain(userId) {
    if (!userId) return;
    try {
      const response = await api.get(`/admin/debug/referral-chain/${userId}`);
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      this.setData({ 
        referralChain: data || null
      });
    } catch (error) {
      console.error('Load referral chain error:', error);
      wx.showToast({
        title: '加载推荐链失败',
        icon: 'none',
      });
    }
  },

  handleUserChange(e) {
    const index = e.detail.value;
    if (this.data.users && this.data.users[index]) {
      const userId = this.data.users[index].id;
      this.setData({ selectedUserId: userId, selectedUserIndex: index });
      this.loadReferralChain(userId);
    }
  },

  onUserIdInput(e) {
    this.setData({ selectedUserId: e.detail.value });
  },

  viewReferralChain() {
    if (!this.data.selectedUserId) {
      wx.showToast({
        title: '请输入用户ID',
        icon: 'none',
      });
      return;
    }
    this.loadReferralChain(this.data.selectedUserId);
  },

  calculateStats() {
    const { followEvents, scanEvents } = this.data;
    const followEventsList = followEvents || [];
    const scanEventsList = scanEvents || [];
    
    const totalUsers = new Set(followEventsList.map((e) => e.openid)).size;
    const today = new Date().toISOString().split('T')[0];
    const todayUsers = new Set(
      followEventsList
        .filter((e) => e.follow_time && e.follow_time.startsWith(today) && e.is_following)
        .map((e) => e.openid)
    ).size;
    const totalScans = scanEventsList.length;
    const totalFollows = followEventsList.filter((e) => e.is_following).length;
    const totalInvites = new Set(followEventsList.filter((e) => e.inviter_user_id).map((e) => e.openid)).size;
    const conversionRate = totalScans > 0 ? ((totalFollows / totalScans) * 100).toFixed(2) : 0;

    this.setData({
      stats: {
        totalUsers,
        todayUsers,
        totalScans,
        totalFollows,
        totalInvites,
        conversionRate: parseFloat(conversionRate),
      },
    });
  },

  async loadSettings() {
    this.setData({ loading: true });
    try {
      const response = await api.get('/admin/settings/activity');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      this.setData({ 'settings.activity': (data && data.activity) ? data.activity : null });
    } catch (error) {
      console.error('Load settings error:', error);
      wx.showToast({
        title: '加载设置失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleSettingInput(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({ [`settings.activity.${field}`]: value });
  },

  async saveSettings() {
    this.setData({ loading: true });
    wx.showLoading({ title: '保存设置中...' });
    try {
      const { activity } = this.data.settings;
      await api.put('/admin/settings/activity', activity);
      wx.showToast({
        title: '设置保存成功',
        icon: 'success',
      });
    } catch (error) {
      console.error('Save settings error:', error);
      wx.showToast({
        title: '保存设置失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  },
});
