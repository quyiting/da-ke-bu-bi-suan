const { bootstrapCloudAccount, buildLocalAccountState } = require("./utils/cloud");

App({
  globalData: {
    accountState: buildLocalAccountState("正在准备本机记录。"),
    accountStorageKey: "fortune-account-state",
    historyStorageKey: "fortune-history",
  },

  onLaunch() {
    const history = wx.getStorageSync(this.globalData.historyStorageKey);

    if (!Array.isArray(history)) {
      wx.setStorageSync(this.globalData.historyStorageKey, []);
    }

    this.globalData.accountState = buildLocalAccountState();
    wx.setStorageSync(this.globalData.accountStorageKey, this.globalData.accountState);

    this.accountPromise = this.ensureAccountState();
  },

  getAccountState() {
    return this.globalData.accountState;
  },

  updateAccountState(patch) {
    const nextState = {
      ...this.globalData.accountState,
      ...(patch || {}),
    };

    this.globalData.accountState = nextState;
    wx.setStorageSync(this.globalData.accountStorageKey, nextState);

    return nextState;
  },

  ensureAccountState(forceRefresh = false) {
    if (!forceRefresh && this.accountPromise) {
      return this.accountPromise;
    }

    this.accountPromise = Promise.resolve(bootstrapCloudAccount())
      .then((accountState) => this.updateAccountState(accountState))
      .catch(() =>
        this.updateAccountState(buildLocalAccountState("当前使用本地存储。"))
      );

    return this.accountPromise;
  },
});
