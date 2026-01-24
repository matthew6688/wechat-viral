const app = getApp<IAppOption>();

Page({
  data: {
    user: null as any,
    showProfileModal: false,
  },

  onLoad() {
    this.loadUser();
  },

  onShow() {
    this.loadUser();
    this.checkProfileAuthorization();
  },

  loadUser() {
    const user = app.globalData.user;
    if (user) {
      this.setData({ user });
    } else {
      wx.redirectTo({ url: '/pages/landing/index' });
    }
  },

  /**
   * Check if user has authorized their profile, prompt if not
   */
  checkProfileAuthorization() {
    setTimeout(() => {
      const hasProfile = app.hasUserProfile();
      const hasSkipped = wx.getStorageSync('profile_auth_skipped');
      
      if (!hasProfile && !hasSkipped) {
        this.setData({ showProfileModal: true });
      }
    }, 500);
  },

  /**
   * User taps "Authorize" button
   */
  async authorizeProfile() {
    this.setData({ showProfileModal: false });
    
    try {
      const result = await app.getUserProfile();
      if (result) {
        wx.showToast({
          title: '授权成功',
          icon: 'success',
        });
        // Refresh user data
        this.loadUser();
      }
    } catch (error) {
      console.error('Authorize profile error:', error);
    }
  },

  /**
   * User taps "Skip" button
   */
  skipProfile() {
    this.setData({ showProfileModal: false });
    wx.setStorageSync('profile_auth_skipped', true);
  },

  preventTouchMove() {
    return false;
  },

  goToAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' });
  },

  /**
   * Manual button to update profile
   */
  async updateProfile() {
    try {
      const result = await app.getUserProfile();
      if (result) {
        wx.showToast({
          title: '更新成功',
          icon: 'success',
        });
        this.loadUser();
      }
    } catch (error) {
      console.error('Update profile error:', error);
    }
  },

  /**
   * Force re-authorize WeChat profile (clears skip flag)
   */
  async forceReauthorize() {
    // Clear the skip flag
    wx.removeStorageSync('profile_auth_skipped');
    
    try {
      const result = await app.getUserProfile();
      if (result) {
        wx.showToast({
          title: '授权成功',
          icon: 'success',
        });
        this.loadUser();
      } else {
        wx.showToast({
          title: '授权被取消',
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('Reauthorize error:', error);
      wx.showToast({
        title: '授权失败',
        icon: 'none',
      });
    }
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
          wx.removeStorageSync('user');
          wx.removeStorageSync('profile_auth_skipped');
          wx.redirectTo({ url: '/pages/landing/index' });
        }
      },
    });
  },
});
