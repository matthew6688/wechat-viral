// pages/landing/index.js
const app = getApp();

Page({
  data: {
    headline: '欢迎加入AI出口增长实验室',
    subheadline: '开启您的增长之旅',
    body: '加入我们，获得专业的出口增长指导，与行业专家交流，共同成长。',
  },

  onLoad(options) {
    console.log('Landing page loaded', options);
    
    // If there's a ref parameter, save it to sceneContext for later use
    if (options.ref) {
      console.log('Referral code detected:', options.ref);
      // Store in app globalData for later use during registration
      if (!app.globalData.sceneContext) {
        app.globalData.sceneContext = {};
      }
      app.globalData.sceneContext.referralCode = options.ref;
      app.globalData.sceneContext.from = options.from || 'oa';
    }
  },

  handleCTA() {
    console.log('CTA button clicked');
    const user = app.globalData.user;
    console.log('Current user:', user);
    if (user) {
      console.log('User exists, switching to home');
      wx.switchTab({ 
        url: '/pages/home/index',
        success: () => console.log('Switch to home success'),
        fail: (err) => console.error('Switch to home failed:', err)
      });
    } else {
      console.log('No user, navigating to register');
      wx.navigateTo({ 
        url: '/pages/register/index',
        success: () => console.log('Navigate to register success'),
        fail: (err) => console.error('Navigate to register failed:', err)
      });
    }
  },
});
