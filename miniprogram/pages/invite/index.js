// pages/invite/index.js
const app = getApp();
const api = require('../../services/api').api;

Page({
  data: {
    user: null,
    referralCode: '',
    mpQRCode: '',
    oaQRCode: '',
    posterImage: '',
    qrType: 'mp',
    loading: {
      mp: false,
      oa: false,
      poster: false,
    },
    posterTemplates: [],
    selectedTemplateId: '',
  },

  onLoad() {
    this.loadUserData();
  },

  onShow() {
    if (app.globalData.user) {
      this.setData({ user: app.globalData.user });
      this.loadReferralCode();
      this.loadMPQRCode();
      this.loadOAQRCode();
      this.loadOAPosterTemplates();
    } else {
      // If user data is not available, wait for app.login to complete
      setTimeout(() => {
        if (app.globalData.user) {
          this.setData({ user: app.globalData.user });
          this.loadReferralCode();
          this.loadMPQRCode();
          this.loadOAQRCode();
          this.loadOAPosterTemplates();
        }
      }, 1000);
    }
  },

  async loadUserData() {
    if (app.globalData.user) {
      this.setData({ user: app.globalData.user });
      this.loadReferralCode();
      this.loadMPQRCode();
      this.loadOAQRCode();
      this.loadOAPosterTemplates();
    } else {
      try {
        const user = await api.get('/users/me');
        app.globalData.user = user.data;
        this.setData({ user: user.data });
        this.loadReferralCode();
        this.loadMPQRCode();
        this.loadOAQRCode();
        this.loadOAPosterTemplates();
      } catch (error) {
        console.error('Failed to load user data:', error);
        wx.showToast({
          title: '加载用户数据失败',
          icon: 'none',
        });
      }
    }
  },

  async loadReferralCode() {
    try {
      const response = await api.get('/referrals/my-code');
      console.log('Referral code response:', response);
      
      // Handle different response structures
      let shortCode = '';
      if (response && response.data) {
        // Check if response.data is the shortCode directly
        if (typeof response.data === 'string') {
          shortCode = response.data;
        } 
        // Check if response.data has a data property
        else if (response.data.data && response.data.data.shortCode) {
          shortCode = response.data.data.shortCode;
        }
        // Check if response.data has shortCode directly
        else if (response.data.shortCode) {
          shortCode = response.data.shortCode;
        }
      }
      
      console.log('Extracted shortCode:', shortCode);
      this.setData({ referralCode: shortCode });
      
      if (!shortCode) {
        console.warn('No referral code found in response');
        wx.showToast({
          title: '邀请码为空',
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('Load referral code error:', error);
      wx.showToast({
        title: '加载邀请码失败',
        icon: 'none',
      });
    }
  },

  async loadMPQRCode() {
    this.setData({ 'loading.mp': true });
    try {
      // Use wx.request directly for arraybuffer response
      const token = wx.getStorageSync('token') || '';
      const apiBase = 'http://localhost:3000/api';
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/referrals/qrcode`,
          method: 'GET',
          responseType: 'arraybuffer',
          header: token ? {
            'Authorization': `Bearer ${token}`,
          } : {},
          success: resolve,
          fail: reject,
        });
      });
      
      if (response.statusCode === 200 && response.data instanceof ArrayBuffer) {
        const base64 = wx.arrayBufferToBase64(response.data);
        this.setData({ mpQRCode: `data:image/png;base64,${base64}` });
      } else {
        throw new Error('Invalid QR code response');
      }
    } catch (error) {
      console.error('Load MP QR code error:', error);
      wx.showToast({
        title: '加载小程序码失败',
        icon: 'none',
      });
    } finally {
      this.setData({ 'loading.mp': false });
    }
  },

  async loadOAQRCode() {
    if (!this.data.user || !this.data.user.id) {
      console.log('User not available for OA QR code');
      return;
    }

    this.setData({ 'loading.oa': true });
    try {
      // First get QR code info
      const qrInfoResponse = await api.get(`/oa/qrcode/${this.data.user.id}`);
      const qrInfo = (qrInfoResponse.data && qrInfoResponse.data.data) ? qrInfoResponse.data.data : qrInfoResponse.data;
      
      if (qrInfo && qrInfo.ticket) {
        // Then get QR code image
        const token = wx.getStorageSync('token') || '';
        const apiBase = 'http://localhost:3000/api';
        
        const response = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiBase}/oa/qrcode-image/${qrInfo.ticket}`,
            method: 'GET',
            responseType: 'arraybuffer',
            header: token ? {
              'Authorization': `Bearer ${token}`,
            } : {},
            success: resolve,
            fail: reject,
          });
        });
        
        if (response.statusCode === 200 && response.data instanceof ArrayBuffer) {
          const base64 = wx.arrayBufferToBase64(response.data);
          this.setData({ oaQRCode: `data:image/png;base64,${base64}` });
        } else {
          throw new Error('Invalid OA QR code response');
        }
      } else {
        throw new Error('Failed to get QR code ticket');
      }
    } catch (error) {
      console.error('Load OA QR code error:', error);
      wx.showToast({
        title: '加载服务号二维码失败',
        icon: 'none',
      });
    } finally {
      this.setData({ 'loading.oa': false });
    }
  },

  async loadOAPosterTemplates() {
    try {
      const response = await api.get('/oa/poster-templates');
      const data = (response.data && response.data.data) ? response.data.data : response.data;
      const templates = (data && data.templates) ? data.templates : [];
      this.setData({ posterTemplates: templates });
      if (templates.length > 0) {
        this.setData({ selectedTemplateId: templates[0].id });
      }
      // Don't auto-generate poster - let user click button
    } catch (error) {
      console.error('Load poster templates error:', error);
      // Set empty array to avoid errors
      this.setData({ posterTemplates: [] });
      // Don't show error for non-admin users, just log it
    }
  },

  async generatePoster() {
    if (!this.data.user) return;

    this.setData({ 'loading.poster': true });
    wx.showLoading({ title: '生成海报中...' });
    try {
      const requestData = this.data.selectedTemplateId ? { templateId: this.data.selectedTemplateId } : {};
      
      // Use wx.request directly for arraybuffer response
      const token = wx.getStorageSync('token') || '';
      const apiBase = 'http://localhost:3000/api';
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/oa/poster/${this.data.user.id}`,
          method: 'POST',
          data: requestData,
          responseType: 'arraybuffer',
          header: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          success: resolve,
          fail: reject,
        });
      });
      
      if (response.statusCode === 200) {
        if (response.data instanceof ArrayBuffer) {
          const base64 = wx.arrayBufferToBase64(response.data);
          this.setData({ posterImage: `data:image/png;base64,${base64}` });
        } else if (response.data && typeof response.data === 'object' && response.data.error) {
          throw new Error(response.data.error);
        } else {
          console.error('Unexpected response format:', response);
          throw new Error('Invalid poster response format');
        }
      } else {
        const errorMsg = (response.data && response.data.error) ? response.data.error : 
                        `Request failed with status ${response.statusCode}`;
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Generate poster error:', error);
      wx.hideLoading(); // Hide loading in error case
      
      const errorMsg = (error && error.errMsg) ? error.errMsg : 
                      (error && error.message) ? error.message : 
                      '生成海报失败';
      
      // Check if error is about IP whitelist
      if (errorMsg.includes('not in whitelist') || errorMsg.includes('invalid ip')) {
        wx.showModal({
          title: 'IP 白名单配置',
          content: '需要在微信公众平台配置服务器 IP 白名单。服务器 IP: 159.196.12.75',
          showCancel: false,
        });
      } else {
        wx.showToast({
          title: errorMsg.length > 20 ? errorMsg.substring(0, 20) + '...' : errorMsg,
          icon: 'none',
          duration: 3000,
        });
      }
    } finally {
      this.setData({ 'loading.poster': false });
      // Ensure hideLoading is called (already called in catch, but safe to call again)
      wx.hideLoading();
    }
  },

  switchQRType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ qrType: type });
  },

  handleTemplateChange(e) {
    const index = e.detail.value;
    const template = this.data.posterTemplates[index];
    if (template) {
      this.setData({ selectedTemplateId: template.id });
      this.generatePoster();
    }
  },

  copyReferralCode() {
    wx.setClipboardData({
      data: this.data.referralCode,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success',
        });
      },
    });
  },

  savePoster() {
    if (!this.data.posterImage) {
      wx.showToast({
        title: '海报未生成',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    // Get base64 data (remove data:image/png;base64, prefix if present)
    const base64Data = this.data.posterImage.includes(',') 
      ? this.data.posterImage.split(',')[1] 
      : this.data.posterImage;

    // Use file system manager to write file
    const fs = wx.getFileSystemManager();
    const fileName = `poster_${Date.now()}.png`;
    // Use temporary file path - wx.env.USER_DATA_PATH is available in newer versions
    // Fallback to a temp path if not available
    let filePath;
    try {
      if (wx.env && wx.env.USER_DATA_PATH) {
        filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      } else {
        // Fallback: use a temp file path
        filePath = `${wx.env.USER_DATA_PATH || ''}/${fileName}`;
      }
    } catch (e) {
      // If wx.env is not available, use a simple path
      filePath = fileName;
    }
    
    fs.writeFile({
      filePath,
      data: base64Data,
      encoding: 'base64',
      success: () => {
        wx.hideLoading();
        wx.saveImageToPhotosAlbum({
          filePath,
          success: () => {
            wx.showToast({
              title: '海报已保存到相册',
              icon: 'success',
            });
          },
          fail: (err) => {
            console.error('Save image to album failed:', err);
            if (err.errMsg && err.errMsg.includes('auth deny')) {
              wx.showModal({
                title: '需要授权',
                content: '保存图片需要访问相册权限，请在设置中开启相册权限',
                showCancel: false,
                confirmText: '知道了',
              });
            } else {
              wx.showToast({
                title: err.errMsg || '保存失败，请检查相册权限',
                icon: 'none',
                duration: 3000,
              });
            }
          },
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Write file failed:', err);
        wx.showToast({
          title: '保存失败: ' + (err.errMsg || '未知错误'),
          icon: 'none',
          duration: 3000,
        });
      },
    });
  },
});
