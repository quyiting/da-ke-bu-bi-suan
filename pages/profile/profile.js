const { getHistory, summarizeHistory, updateHistoryEntry } = require("../../utils/history");
const { clearLocalHistoryOnly } = require("../../utils/history-sync");
const { buildLocalAccountState } = require("../../utils/cloud");

const filterOptions = [
  { id: "all", label: "全部" },
  { id: "draw", label: "抽签" },
  { id: "yao", label: "问事" },
];
const reviewOptions = [
  { id: "pending", label: "待回看" },
  { id: "partial", label: "部分应" },
  { id: "matched", label: "已应" },
  { id: "unmet", label: "暂未应" },
];

function enhanceAccountState(accountState = {}, history = []) {
  const safeHistory = Array.isArray(history) ? history : [];
  const total = safeHistory.length;
  let guideTitle = total ? "记录只留在这台设备" : "第一条记录会直接保存在本机";
  let guideCopy = total
    ? "当前版本只使用微信小程序本地存储。换设备、清理小程序数据或卸载后，这些记录都不会自动迁移回来。"
    : "抽签、问事和星盘结果都会直接写入当前设备本地存储，不会上传到云端。";

  if (total >= 10) {
    guideTitle = "这台设备已经存下不少记录";
    guideCopy = "如果这些记录你还想继续留着，尽量不要清理小程序缓存；当前版本没有云端备份和跨设备恢复。";
  }

  return {
    ...buildLocalAccountState(accountState.statusCopy || "记录只保存在当前设备。"),
    ...accountState,
    deviceCopy: total ? `当前设备已保存 ${total} 条记录。` : "当前设备还没有保存记录。",
    guideCopy,
    guideTitle,
    storageCopy: "通过微信小程序本地存储保存，不连接云端。",
  };
}

function getVisibleHistory(history = getHistory()) {
  return (Array.isArray(history) ? history : []).filter((item) => item.type !== "chart");
}

Page({
  data: {
    activeFilter: "all",
    accountState: enhanceAccountState(buildLocalAccountState("记录只保存在当前设备。")),
    filterOptions,
    filteredHistory: [],
    history: [],
    reviewOptions,
    summary: {
      chartCount: 0,
      drawCount: 0,
      exploreDays: 0,
      favoriteTypeLabel: "还没形成偏好",
      lastUpdated: "暂无记录",
      matchedReviewCount: 0,
      nextSuggestion: "先问一件今天最在意的事。",
      partialReviewCount: 0,
      pendingReviewCount: 0,
      todayCount: 0,
      total: 0,
      unmetReviewCount: 0,
      yaoCount: 0,
    },
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    const history = getVisibleHistory();
    const summary = summarizeHistory(history);
    const statusCopy = history.length
      ? "记录已保存在当前设备本地。"
      : "当前还没有本地记录，新内容会直接保存在这台设备。";

    this.setData({
      accountState: enhanceAccountState(buildLocalAccountState(statusCopy), history),
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

  handleReviewStatus(event) {
    const { id, status } = event.currentTarget.dataset;

    if (!id || !status) {
      return;
    }

    updateHistoryEntry(id, {
      reviewStatus: status,
      reviewUpdatedAt: Date.now(),
    });
    this.loadHistory();
    wx.showToast({
      title: "回访已更新",
      icon: "none",
    });
  },

  handleClearLocal() {
    if (!getHistory().length) {
      wx.showToast({
        title: "本机已经是空的",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "清空本机记录",
      content: "这会删除当前设备上的所有历史记录。现在只使用本地存储，清空后不能从云端恢复。",
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }

        const result = clearLocalHistoryOnly();
        const visibleHistory = getVisibleHistory(result.history);
        const visibleSummary = summarizeHistory(visibleHistory);

        this.setData({
          accountState: enhanceAccountState(result.accountState, visibleHistory),
          history: visibleHistory,
          summary: visibleSummary,
        });
        this.applyFilter(this.data.activeFilter, visibleHistory);

        wx.showToast({
          title: "本机已清空",
          icon: "none",
        });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: "我把大可不必算里的签、六爻和记录画像都留在这里了",
      path: "/pages/profile/profile",
    };
  },
});
