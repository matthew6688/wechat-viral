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
    const value = e.detail.value;
    console.log('Input changed:', field, value);
    this.setData({
      [`formData.${field}`]: value,
    });
  },

  selectRole(e: any) {
    const { role } = e.currentTarget.dataset;
    console.log('Role selected:', role);
    this.setData({
      'formData.role': role,
    });
  },

  async onRegister(e: any) {
    // Get form data from event if available (form submission)
    let formData = this.data.formData;
    
    // If submitted via form, merge the form values
    if (e && e.detail && e.detail.value) {
      const formValues = e.detail.value;
      formData = {
        ...formData,
        name: formValues.name || formData.name,
        company: formValues.company || formData.company,
        phone: formValues.phone || formData.phone,
        wechatId: formValues.wechatId || formData.wechatId,
        mainProducts: formValues.mainProducts || formData.mainProducts,
      };
    }
    
    console.log('Submitting form data:', formData);
    
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
      console.error('Registration error:', error);
      wx.showToast({
        title: error.message || '注册失败',
        icon: 'none',
      });
    }
  },
});
