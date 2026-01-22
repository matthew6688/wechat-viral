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
    currentSlide: 0,
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
      }
    }
  },

  async loadReferralCode() {
    try {
      const response = await api.get('/referrals/my-code');
      let shortCode = '';
      if (response && response.data) {
        if (typeof response.data === 'string') {
          shortCode = response.data;
        } else if (response.data.data && response.data.data.shortCode) {
          shortCode = response.data.data.shortCode;
        } else if (response.data.shortCode) {
          shortCode = response.data.shortCode;
        }
      }
      this.setData({ referralCode: shortCode });
    } catch (error) {
      console.error('Load referral code error:', error);
    }
  },

  async loadMPQRCode() {
    this.setData({ 'loading.mp': true });
    try {
      const token = wx.getStorageSync('token') || '';
      const apiBase = 'http://localhost:3000/api';
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/referrals/qrcode`,
          method: 'GET',
          responseType: 'arraybuffer',
          header: token ? { 'Authorization': `Bearer ${token}` } : {},
          success: resolve,
          fail: reject,
        });
      });
      
      if (response.statusCode === 200 && response.data instanceof ArrayBuffer) {
        const base64 = wx.arrayBufferToBase64(response.data);
        this.setData({ mpQRCode: `data:image/png;base64,${base64}` });
      }
    } catch (error) {
      console.error('Load MP QR code error:', error);
    } finally {
      this.setData({ 'loading.mp': false });
    }
  },

  async loadOAQRCode() {
    if (!this.data.user || !this.data.user.id) return;

    this.setData({ 'loading.oa': true });
    try {
      const qrInfoResponse = await api.get(`/oa/qrcode/${this.data.user.id}`);
      const qrInfo = (qrInfoResponse.data && qrInfoResponse.data.data) ? qrInfoResponse.data.data : qrInfoResponse.data;
      
      if (qrInfo && qrInfo.ticket) {
        const token = wx.getStorageSync('token') || '';
        const apiBase = 'http://localhost:3000/api';
        
        const response = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiBase}/oa/qrcode-image/${qrInfo.ticket}`,
            method: 'GET',
            responseType: 'arraybuffer',
            header: token ? { 'Authorization': `Bearer ${token}` } : {},
            success: resolve,
            fail: reject,
          });
        });
        
        if (response.statusCode === 200 && response.data instanceof ArrayBuffer) {
          const base64 = wx.arrayBufferToBase64(response.data);
          this.setData({ oaQRCode: `data:image/png;base64,${base64}` });
        }
      }
    } catch (error) {
      console.error('Load OA QR code error:', error);
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
    } catch (error) {
      console.error('Load poster templates error:', error);
      this.setData({ posterTemplates: [] });
    }
  },

  prevSlide() {
    const current = this.data.currentSlide;
    this.setData({ currentSlide: current > 0 ? current - 1 : 0 });
  },

  nextSlide() {
    this.setData({ currentSlide: this.data.currentSlide + 1 });
  },

  async generatePoster() {
    if (!this.data.user) return;

    this.setData({ 'loading.poster': true });
    wx.showLoading({ title: 'Generating...' });
    try {
      const requestData = this.data.selectedTemplateId ? { templateId: this.data.selectedTemplateId } : {};
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
      
      if (response.statusCode === 200 && response.data instanceof ArrayBuffer) {
        const base64 = wx.arrayBufferToBase64(response.data);
        this.setData({ posterImage: `data:image/png;base64,${base64}` });
      }
    } catch (error) {
      console.error('Generate poster error:', error);
      wx.showToast({ title: 'Failed to generate', icon: 'none' });
    } finally {
      this.setData({ 'loading.poster': false });
      wx.hideLoading();
    }
  },

  copyReferralLink() {
    const link = `https://yourapp.com/invite?ref=${this.data.referralCode}`;
    wx.setClipboardData({
      data: link,
      success: () => {
        wx.showToast({ title: 'Link copied!', icon: 'success' });
      },
    });
  },

  savePoster() {
    if (!this.data.posterImage && !this.data.mpQRCode) {
      // Generate poster first if not available
      this.generatePoster();
      return;
    }

    const imageToSave = this.data.posterImage || this.data.mpQRCode;
    wx.showLoading({ title: 'Saving...' });

    const base64Data = imageToSave.includes(',') 
      ? imageToSave.split(',')[1] 
      : imageToSave;

    const fs = wx.getFileSystemManager();
    const fileName = `poster_${Date.now()}.png`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    
    fs.writeFile({
      filePath,
      data: base64Data,
      encoding: 'base64',
      success: () => {
        wx.hideLoading();
        wx.saveImageToPhotosAlbum({
          filePath,
          success: () => {
            wx.showToast({ title: 'Saved!', icon: 'success' });
          },
          fail: (err) => {
            if (err.errMsg && err.errMsg.includes('auth deny')) {
              wx.showModal({
                title: 'Permission Required',
                content: 'Please allow access to save images',
                showCancel: false,
              });
            } else {
              wx.showToast({ title: 'Save failed', icon: 'none' });
            }
          },
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: 'Save failed', icon: 'none' });
      },
    });
  },
});
