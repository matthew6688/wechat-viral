const app = getApp();

Page({
  data: {
    headline: '欢迎加入AI出口增长实验室',
    subheadline: '开启您的增长之旅',
    body: '加入我们，获得专业的出口增长指导，与行业专家交流，共同成长。',
  },

  onLoad(options: any) {
    console.log('Landing page loaded', options);
  },

  handleCTA() {
    const user = app.globalData.user;
    if (user) {
      wx.switchTab({ url: '/pages/home/index' });
    } else {
      wx.navigateTo({ url: '/pages/register/index' });
    }
  },
});
