// pages/profile/index.js
const app = getApp();

Page({
  data: {
    user: null,
  },

  onLoad() {
    this.loadUser();
  },

  onShow() {
    this.loadUser();
  },

  loadUser() {
    const user = app.globalData.user;
    if (user) {
      this.setData({ user });
    } else {
      wx.redirectTo({ url: '/pages/landing/index' });
    }
  },

  goToAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' });
  },

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.user = null;
          app.globalData.token = null;
          wx.removeStorageSync('token');
          wx.redirectTo({ url: '/pages/landing/index' });
        }
      },
    });
  },
});
