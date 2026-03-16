const { bootstrapCloudAccount, buildLocalAccountState } = require("./utils/cloud");

App({
  globalData: {
    accountState: buildLocalAccountState("正在准备本机记录。"),
    accountStorageKey: "fortune-account-state",
    historyStorageKey: "fortune-history",
  },

  onLaunch() {
    const history = wx.getStorageSync(this.globalData.historyStorageKey);
    const storedAccountState = wx.getStorageSync(this.globalData.accountStorageKey);

    if (!Array.isArray(history)) {
      wx.setStorageSync(this.globalData.historyStorageKey, []);
    }

    if (storedAccountState && typeof storedAccountState === "object") {
      this.globalData.accountState = {
        ...this.globalData.accountState,
        ...storedAccountState,
      };
    } else {
      wx.setStorageSync(this.globalData.accountStorageKey, this.globalData.accountState);
    }

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

    this.accountPromise = bootstrapCloudAccount()
      .then((accountState) => this.updateAccountState(accountState))
      .catch(() =>
        this.updateAccountState(
          buildLocalAccountState("静默识别暂时没有成功，当前先继续保留在本机模式。")
        )
      );

    return this.accountPromise;
  },
});
