export const storage = {
  getToken(): string {
    return wx.getStorageSync('token') || '';
  },

  setToken(token: string) {
    wx.setStorageSync('token', token);
  },

  removeToken() {
    wx.removeStorageSync('token');
  },

  getUser(): any {
    return wx.getStorageSync('user') || null;
  },

  setUser(user: any) {
    wx.setStorageSync('user', user);
  },

  removeUser() {
    wx.removeStorageSync('user');
  },
};
