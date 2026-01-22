Component({
  data: {
    selected: 0,
    color: "#9ca3af",
    selectedColor: "#1a1a2e",
    list: [
      {
        pagePath: "/pages/home/index",
        text: "Home",
        icon: "🏠"
      },
      {
        pagePath: "/pages/rewards/index",
        text: "Rewards",
        icon: "🎁"
      },
      {
        pagePath: "/pages/invite/index",
        text: "Invite",
        icon: "👥"
      },
      {
        pagePath: "/pages/profile/index",
        text: "Profile",
        icon: "👤"
      },
      {
        pagePath: "/pages/admin/index",
        text: "Admin",
        icon: "⚙"
      }
    ]
  },
  attached() {
    // Check if user is admin to show/hide admin tab
    const app = getApp();
    if (app.globalData && app.globalData.user && !app.globalData.user.is_admin) {
      // Remove admin tab for non-admin users
      const list = this.data.list.filter(item => item.text !== 'Admin');
      this.setData({ list });
    }
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    }
  }
});
