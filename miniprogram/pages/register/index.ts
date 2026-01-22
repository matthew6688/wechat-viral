const app = getApp();
import { api } from '../../services/api';

Page({
  data: {
    formData: {
      name: '',
      phone: '',
      wechatId: '',
      company: '',
      role: 'Other',
      mainProducts: '',
    },
    marketOptions: ['B2B', 'B2C', 'Both'],
  },

  onLoad() {
    // Check if user is already registered
    if (app.globalData.user) {
      wx.switchTab({ url: '/pages/home/index' });
    }
  },

  handleInput(e: any) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`formData.${field}`]: e.detail.value,
    });
  },

  async onRegister() {
    const { formData } = this.data;
    
    if (!formData.name || !formData.phone) {
      wx.showToast({
        title: '请填写姓名和手机号',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '注册中...' });

    try {
      // First login to get token
      await app.login();
      
      // Then register/update user
      const response: any = await api.post('/users/register', formData);
      
      app.globalData.user = response.data;
      
      wx.hideLoading();
      wx.showToast({
        title: '注册成功',
        icon: 'success',
      });
      
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/index' });
      }, 1500);
    } catch (error: any) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '注册失败',
        icon: 'none',
      });
    }
  },
});
