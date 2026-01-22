const app = getApp();
import { api } from '../../services/api';

declare function getApp(): any;

Page({
  data: {
    currentTab: 'debug' as 'debug' | 'settings' | 'stats',
    isAdmin: false,
    
    // Debug data
    scanEvents: [] as any[],
    followEvents: [] as any[],
    referralChain: null as any,
    selectedUserId: '',
    
    // Stats
    stats: {
      totalUsers: 0,
      todayUsers: 0,
      totalScans: 0,
      totalFollows: 0,
      totalInvites: 0,
      conversionRate: '0.00',
    },
    
    // Settings
    settings: {
      activity: null as any,
    },
    
    loading: false,
  },

  onLoad() {
    this.checkAdminStatus();
  },

  async checkAdminStatus() {
    try {
      const user = app.globalData.user;
      if (user && user.is_admin) {
        this.setData({ isAdmin: true });
        this.loadData();
      } else {
        wx.showToast({
          title: '无权限访问',
          icon: 'none',
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('Check admin status error:', error);
    }
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      await Promise.all([
        this.loadStats(),
        this.loadScanEvents(),
        this.loadFollowEvents(),
      ]);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadStats() {
    try {
      const response = await api.get('/admin/debug/stats');
      this.setData({ stats: response.data });
    } catch (error) {
      console.error('Load stats error:', error);
    }
  },

  async loadScanEvents() {
    try {
      const response = await api.get('/admin/debug/scan-events', {
        params: { limit: 50 },
      });
      this.setData({ scanEvents: response.data.events || [] });
    } catch (error) {
      console.error('Load scan events error:', error);
    }
  },

  async loadFollowEvents() {
    try {
      const response = await api.get('/admin/debug/follow-events', {
        params: { limit: 50 },
      });
      this.setData({ followEvents: response.data.events || [] });
    } catch (error) {
      console.error('Load follow events error:', error);
    }
  },

  async loadReferralChain(userId: string) {
    try {
      const response = await api.get(`/admin/debug/referral-chain/${userId}`);
      this.setData({ referralChain: response.data });
    } catch (error) {
      console.error('Load referral chain error:', error);
    }
  },

  async loadSettings() {
    try {
      const response = await api.get('/admin/settings');
      this.setData({ settings: response.data });
    } catch (error) {
      console.error('Load settings error:', error);
    }
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    
    if (tab === 'settings') {
      this.loadSettings();
    } else if (tab === 'stats') {
      this.loadStats();
    }
  },

  onUserIdInput(e: any) {
    this.setData({ selectedUserId: e.detail.value });
  },

  async viewReferralChain() {
    if (!this.data.selectedUserId) {
      wx.showToast({
        title: '请输入用户ID',
        icon: 'none',
      });
      return;
    }
    
    await this.loadReferralChain(this.data.selectedUserId);
  },

  async saveSettings() {
    try {
      wx.showLoading({ title: '保存中...' });
      await api.post('/admin/settings', this.data.settings);
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
      });
    } catch (error: any) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    }
  },

  formatDate(dateStr: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },
});
