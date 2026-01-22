const app = getApp();
import { api } from '../../services/api';

declare function getApp(): any;

Page({
  data: {
    user: null as any,
    referralCode: '',
    mpQRCode: '', // Mini Program QR code
    oaQRCode: '', // Official Account QR code
    posterUrl: '',
    qrType: 'mp' as 'mp' | 'oa', // Current QR code type
    loading: false,
  },

  onLoad() {
    this.loadUserData();
  },

  async loadUserData() {
    try {
      const user = app.globalData.user;
      if (!user) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
        });
        return;
      }

      this.setData({ user });

      // Get referral code
      const response = await api.get('/referrals/my-code');
      this.setData({ referralCode: response.data.shortCode });

      // Load QR codes
      await this.loadMPQRCode();
      await this.loadOAQRCode();
    } catch (error) {
      console.error('Load user data error:', error);
    }
  },

  async loadMPQRCode() {
    try {
      // Note: This endpoint needs to be implemented in referrals route
      // For now, we'll skip this and focus on OA QR code
      // const response = await api.get('/referrals/qrcode');
      // this.setData({ mpQRCode: response.data.url });
    } catch (error) {
      console.error('Load MP QR code error:', error);
    }
  },

  async loadOAQRCode() {
    try {
      const userId = this.data.user.id;
      const response: any = await api.get(`/oa/qrcode/${userId}`);
      
      // Fetch QR code image and convert to base64
      const imageResponse: any = await new Promise((resolve, reject) => {
        const apiBase = 'http://localhost:3000/api'; // Should match config
        const token = app.globalData.token || '';
        wx.request({
          url: `${apiBase}/oa/qrcode-image/${response.data.ticket}`,
          method: 'GET',
          responseType: 'arraybuffer',
          header: token ? {
            'Authorization': `Bearer ${token}`,
          } : {},
          success: resolve,
          fail: reject,
        });
      });
      
      const base64 = wx.arrayBufferToBase64(imageResponse.data);
      this.setData({ oaQRCode: `data:image/png;base64,${base64}` });
    } catch (error) {
      console.error('Load OA QR code error:', error);
    }
  },

  switchQRType(e: any) {
    const type = e.currentTarget.dataset.type;
    this.setData({ qrType: type });
  },

  async generatePoster() {
    try {
      this.setData({ loading: true });
      wx.showLoading({ title: '生成中...' });

      const userId = this.data.user.id;
      const apiBase = 'http://localhost:3000/api'; // Should match config
      const token = app.globalData.token || '';
      
      const response: any = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/oa/poster/${userId}`,
          method: 'GET',
          responseType: 'arraybuffer',
          header: token ? {
            'Authorization': `Bearer ${token}`,
          } : {},
          success: resolve,
          fail: reject,
        });
      });

      const base64 = wx.arrayBufferToBase64(response.data);
      this.setData({ posterUrl: `data:image/png;base64,${base64}` });

      wx.hideLoading();
      wx.showToast({
        title: '生成成功',
        icon: 'success',
      });
    } catch (error: any) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '生成失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async savePoster() {
    if (!this.data.posterUrl) {
      wx.showToast({
        title: '请先生成海报',
        icon: 'none',
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });
      
      // Save to album
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: this.data.posterUrl,
          success: resolve,
          fail: reject,
        });
      });

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
      });
    } catch (error: any) {
      wx.hideLoading();
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要授权',
          content: '保存图片需要访问相册权限',
          showCancel: false,
        });
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none',
        });
      }
    }
  },

  copyReferralCode() {
    wx.setClipboardData({
      data: this.data.referralCode,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
        });
      },
    });
  },
});
