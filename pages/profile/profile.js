const { getHistory, summarizeHistory, updateHistoryEntry } = require("../../utils/history");
const { clearLocalHistoryOnly, requestHistorySync } = require("../../utils/history-sync");
const { buildLocalAccountState } = require("../../utils/cloud");

const filterOptions = [
  { id: "all", label: "全部" },
  { id: "draw", label: "抽签" },
  { id: "yao", label: "六爻" },
  { id: "chart", label: "星盘" },
];
const reviewOptions = [
  { id: "pending", label: "待回看" },
  { id: "partial", label: "部分应" },
  { id: "matched", label: "已应" },
  { id: "unmet", label: "暂未应" },
];

function isRecognizedAccount(accountState = {}) {
  return !!(accountState.userLabel && accountState.userLabel !== "未识别");
}

function enhanceAccountState(accountState = {}, history = []) {
  const safeHistory = Array.isArray(history) ? history : [];
  const localCount = safeHistory.length;
  const recognized = isRecognizedAccount(accountState);
  let recognitionCopy = "静默识别，不需要额外登录弹窗";
  let cloudCopy = `最近云端：${accountState.cloudUpdatedLabel || "等待拉取云端信息"}`;
  let guideTitle = "";
  let guideCopy = "";

  if (!accountState.isConfigured) {
    recognitionCopy = "还没接云开发时，只会保存在本机。";
    cloudCopy = "配好云环境后，才能启用跨设备同步。";
  } else if (!recognized) {
    recognitionCopy =
      accountState.mode === "error"
        ? "还没拿到账号态，常见原因是云函数未部署或当前微信号不在开发成员里。"
        : "正在尝试静默识别当前微信身份。";
  }

  if (accountState.mode === "error") {
    if (recognized) {
      guideTitle = "云端连上了，但这次同步没成功";
      guideCopy = "记录还在本机。你可以先重试同步，或者稍后再回来处理。";
    } else {
      guideTitle = "下一步先检查云函数和开发权限";
      guideCopy =
        "先确认 account 和 historySync 都已经上传部署，再确认当前微信号已经加到这个小程序的开发成员里，然后回来点一次“重试同步”。";
    }
  } else if (accountState.autoPullBlocked) {
    guideTitle = "本机记录不会自动回灌";
    guideCopy = "你刚清空过这台设备，所以只有主动点“从云端拉回”，云端历史才会回到本机。";
  } else if (accountState.autoPushBlocked) {
    guideTitle = "云端备份处于手动恢复模式";
    guideCopy = localCount
      ? "你刚清空过云端，所以系统不会自动重传本机记录。想继续备份时，点“恢复云端备份”就行。"
      : "云端已经清空，而且本机当前也没有记录。后面有新记录时，再手动恢复备份即可。";
  } else if (accountState.isConfigured && recognized && !localCount && accountState.cloudHistoryCount) {
    guideTitle = "这台设备还能接回旧记录";
    guideCopy = `云端还保留 ${accountState.cloudHistoryCount} 条历史；如果你想在这台设备继续看旧记录，点“从云端拉回”就行。`;
  }

  return {
    ...accountState,
    cloudCopy,
    guideCopy,
    guideTitle,
    recognitionCopy,
  };
}

Page({
  data: {
    activeFilter: "all",
    accountState: enhanceAccountState(buildLocalAccountState("正在准备本机记录。")),
    filterOptions,
    filteredHistory: [],
    history: [],
    isSyncing: false,
    reviewOptions,
    summary: {
      chartCount: 0,
      drawCount: 0,
      exploreDays: 0,
      failedSyncCount: 0,
      favoriteTypeLabel: "还没形成偏好",
      lastUpdated: "暂无记录",
      lastSyncedLabel: "尚未同步",
      matchedReviewCount: 0,
      nextSuggestion: "先从一支主题签开始。",
      partialReviewCount: 0,
      pendingReviewCount: 0,
      pendingSyncCount: 0,
      syncedCount: 0,
      todayCount: 0,
      total: 0,
      unmetReviewCount: 0,
      yaoCount: 0,
    },
  },

  async onShow() {
    this.loadHistory();
    await this.refreshCloudState({
      mode: "sync",
      reason: "profile-open",
    });
  },

  loadHistory() {
    const history = getHistory();
    const summary = summarizeHistory(history);

    this.setData({
      accountState: enhanceAccountState(this.data.accountState, history),
      history,
      summary,
    });

    this.applyFilter(this.data.activeFilter, history);
  },

  setFilter(event) {
    const { filter } = event.currentTarget.dataset;
    this.applyFilter(filter);
  },

  applyFilter(filter, sourceHistory) {
    const baseHistory = sourceHistory || this.data.history;
    const filteredHistory =
      filter === "all"
        ? baseHistory
        : baseHistory.filter((item) => item.type === filter);

    this.setData({
      activeFilter: filter,
      filteredHistory,
    });
  },

  async handleReviewStatus(event) {
    const { id, status } = event.currentTarget.dataset;

    if (!id || !status) {
      return;
    }

    updateHistoryEntry(id, {
      reviewStatus: status,
      reviewUpdatedAt: Date.now(),
    });
    this.loadHistory();
    await this.refreshCloudState({
      mode: "sync",
      reason: "profile-review-updated",
    });
    wx.showToast({
      title: "回访已更新",
      icon: "none",
    });
  },

  async handleManualSync() {
    if (this.data.isSyncing) {
      return;
    }

    if (!this.data.accountState.isConfigured) {
      wx.showModal({
        title: "先接好云开发",
        content:
          "1. 在 utils/cloud.js 里填写 CLOUD_ENV_ID。\n2. 在微信开发者工具开通云开发环境。\n3. 右键 cloudfunctions 目录上传并部署两个云函数。",
        showCancel: false,
      });
      return;
    }

    const shouldPullFromCloud =
      this.data.accountState.autoPullBlocked &&
      !this.data.history.length &&
      this.data.accountState.cloudHistoryCount > 0;

    await this.refreshCloudState({
      forceRefreshAccount: true,
      mode: shouldPullFromCloud ? "pull" : "sync",
      reason: shouldPullFromCloud ? "manual-pull" : "manual-sync",
      showToast: true,
    });
  },

  async handlePullFromCloud() {
    if (this.data.isSyncing) {
      return;
    }

    if (!this.data.accountState.isConfigured) {
      wx.showModal({
        title: "先接好云开发",
        content:
          "1. 在 utils/cloud.js 里填写 CLOUD_ENV_ID。\n2. 在微信开发者工具开通云开发环境。\n3. 右键 cloudfunctions 目录上传并部署两个云函数。",
        showCancel: false,
      });
      return;
    }

    await this.refreshCloudState({
      forceRefreshAccount: true,
      mode: "pull",
      reason: "manual-pull",
      showToast: true,
    });
  },

  handleClearLocal() {
    if (!this.data.history.length) {
      wx.showToast({
        title: "本机已经是空的",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "清空本机记录",
      content: "只清空这台设备上的记录，云端备份不会动，而且之后不会自动回灌，除非你主动点“从云端拉回”。",
      success: async ({ confirm }) => {
        if (!confirm) {
          return;
        }

        const result = clearLocalHistoryOnly();

        this.setData({
          accountState: enhanceAccountState(result.accountState, result.history),
          history: result.history,
          summary: result.summary,
        });
        this.applyFilter(this.data.activeFilter, result.history);

        if (result.accountState.isConfigured) {
          await this.refreshCloudState({
            mode: "inspect",
            reason: "local-cleared",
          });
        }

        wx.showToast({
          title: "本机已清空",
          icon: "none",
        });
      },
    });
  },

  handleClearCloud() {
    if (this.data.isSyncing) {
      return;
    }

    if (!this.data.accountState.isConfigured) {
      wx.showModal({
        title: "先接好云开发",
        content:
          "1. 在 utils/cloud.js 里填写 CLOUD_ENV_ID。\n2. 在微信开发者工具开通云开发环境。\n3. 右键 cloudfunctions 目录上传并部署两个云函数。",
        showCancel: false,
      });
      return;
    }

    if (!this.data.accountState.cloudHistoryCount) {
      wx.showToast({
        title: "云端已经没有记录了",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "清空云端记录",
      content:
        "只清空当前账号在云端的历史备份，本机记录会保留。清空后不会自动重新上传，只有你手动点“恢复云端备份”才会重新备份。",
      success: async ({ confirm }) => {
        if (!confirm) {
          return;
        }

        await this.refreshCloudState({
          mode: "clear-remote",
          reason: "remote-cleared",
          showToast: true,
        });
      },
    });
  },

  async refreshCloudState(options = {}) {
    const currentAccountState = this.data.accountState;

    this.setData({
      accountState: {
        ...currentAccountState,
        statusCopy:
          options.mode === "pull"
            ? "正在把云端历史拉回到这台设备。"
            : options.mode === "clear-remote"
              ? "正在清空当前账号的云端历史备份。"
              : options.reason === "manual-sync" && currentAccountState.autoPushBlocked
                ? "正在把本机保留的记录重新上传为云端备份。"
              : options.reason === "manual-sync"
                ? "正在和云端对齐这台设备上的记录。"
                : this.data.accountState.statusCopy,
      },
      isSyncing: true,
    });

    const result = await requestHistorySync({
      forceRefreshAccount: !!options.forceRefreshAccount,
      mode: options.mode || "sync",
      reason: options.reason || "profile-open",
    });
    const nextHistory = result.history || getHistory();

    this.setData({
      accountState: enhanceAccountState(result.accountState || this.data.accountState, nextHistory),
      history: nextHistory,
      isSyncing: false,
      summary: result.summary || summarizeHistory(nextHistory),
    });
    this.applyFilter(this.data.activeFilter, nextHistory);

    if (options.showToast) {
      let toastTitle = "同步稍后再试";

      if (options.mode === "pull") {
        toastTitle = result.ok ? "已拉回云端记录" : result.skipped ? "云端没有可拉回记录" : "拉回稍后再试";
      } else if (options.mode === "clear-remote") {
        toastTitle = result.ok ? "云端已清空" : "清空云端失败";
      } else if (options.mode === "sync") {
        toastTitle =
          currentAccountState.autoPushBlocked && result.ok
            ? "云端备份已恢复"
            : result.ok
              ? "同步完成"
              : result.skipped
                ? "当前是本地模式"
                : "同步稍后再试";
      }

      wx.showToast({
        title: toastTitle,
        icon: "none",
      });
    }
  },

  onShareAppMessage() {
    return {
      title: "我把大可不必算里的签、六爻和记录画像都留在这里了",
      path: "/pages/profile/profile",
    };
  },
});
