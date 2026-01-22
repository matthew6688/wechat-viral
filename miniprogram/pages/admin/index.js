// pages/admin/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    isAdmin: false,
    currentTab: 'users',
    loading: false,
    
    users: [],
    rewards: [],
    tasks: [],
    
    stats: {
      totalUsers: 0,
      totalInvites: 0,
      conversionRate: 0,
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
        this.loadAllData();
      } else {
        wx.showToast({ title: 'Admin access required', icon: 'none' });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/index' });
        }, 1500);
      }
    } catch (error) {
      console.error('Check admin status error:', error);
      wx.showToast({ title: 'Failed to verify admin', icon: 'none' });
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
  },

  async loadAllData() {
    await Promise.all([
      this.loadUsers(),
      this.loadRewards(),
      this.loadTasks(),
      this.loadStats(),
    ]);
  },

  async loadUsers() {
    try {
      const response = await api.get('/admin/users');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      const users = (data && data.users) ? data.users : [];
      this.setData({ users });
    } catch (error) {
      console.error('Load users error:', error);
    }
  },

  async loadRewards() {
    try {
      const response = await api.get('/rewards');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      const rewards = (data && data.rewards) ? data.rewards : [];
      this.setData({ rewards });
    } catch (error) {
      console.error('Load rewards error:', error);
    }
  },

  async loadTasks() {
    try {
      const response = await api.get('/tasks');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      const tasks = (data && data.tasks) ? data.tasks : [];
      this.setData({ tasks });
    } catch (error) {
      console.error('Load tasks error:', error);
    }
  },

  async loadStats() {
    try {
      const response = await api.get('/admin/debug/oa-events');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      const followEvents = (data && data.followEvents) ? data.followEvents : [];
      const scanEvents = (data && data.scanEvents) ? data.scanEvents : [];
      
      const totalUsers = this.data.users.length;
      const totalInvites = new Set(followEvents.filter((e) => e.inviter_user_id).map((e) => e.openid)).size;
      const totalScans = scanEvents.length;
      const totalFollows = followEvents.filter((e) => e.is_following).length;
      const conversionRate = totalScans > 0 ? ((totalFollows / totalScans) * 100).toFixed(0) : 0;

      this.setData({
        stats: {
          totalUsers,
          totalInvites,
          conversionRate: parseFloat(conversionRate),
        },
      });
    } catch (error) {
      console.error('Load stats error:', error);
    }
  },
});
