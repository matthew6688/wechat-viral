// services/storage.js
const storage = {
  getToken() {
    return wx.getStorageSync('token') || '';
  },

  setToken(token) {
    wx.setStorageSync('token', token);
  },

  removeToken() {
    wx.removeStorageSync('token');
  },

  getUser() {
    return wx.getStorageSync('user') || null;
  },

  setUser(user) {
    wx.setStorageSync('user', user);
  },

  removeUser() {
    wx.removeStorageSync('user');
  },
};

module.exports = { storage };
