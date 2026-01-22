const app = getApp();
import { api } from '../../services/api';

Page({
  data: {
    user: null as any,
    points: 0,
    tasks: [] as any[],
    logs: [] as any[],
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    if (app.globalData.user) {
      this.setData({ user: app.globalData.user });
      this.loadData();
    } else {
      wx.redirectTo({ url: '/pages/landing/index' });
    }
  },

  async loadData() {
    try {
      const [pointsRes, tasksRes, logsRes] = await Promise.all([
        api.get('/points/balance'),
        api.get('/tasks'),
        api.get('/points/logs'),
      ]);

      this.setData({
        points: (pointsRes as any).data.balance || 0,
        tasks: (tasksRes as any).data.tasks || [],
        logs: (logsRes as any).data.logs || [],
      });
    } catch (error) {
      console.error('Load data error:', error);
    }
  },

  async completeTask(e: any) {
    const taskId = e.currentTarget.dataset.id;
    try {
      await api.post(`/tasks/${taskId}/complete`);
      wx.showToast({ title: '任务完成', icon: 'success' });
      this.loadData();
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },
});
