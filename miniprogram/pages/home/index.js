// pages/home/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    user: null,
    points: 0,
    tasks: null,
    logs: null,
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

      const tasks = (tasksRes.data && tasksRes.data.data && tasksRes.data.data.tasks) ? tasksRes.data.data.tasks : 
                    (tasksRes.data && tasksRes.data.tasks) ? tasksRes.data.tasks : null;
      const logs = (logsRes.data && logsRes.data.data && logsRes.data.data.logs) ? logsRes.data.data.logs : 
                   (logsRes.data && logsRes.data.logs) ? logsRes.data.logs : null;
      
      // Ensure arrays are never null
      const safeTasks = Array.isArray(tasks) ? tasks : [];
      const safeLogs = Array.isArray(logs) ? logs : [];
      
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
});
