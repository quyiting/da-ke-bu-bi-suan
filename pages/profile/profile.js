const { getHistory, getHistoryEntry, getHistoryCapacity, deleteHistoryEntry, saveReviewNote, summarizeHistory, updateHistoryEntry } = require("../../utils/history");
const { clearLocalHistoryOnly } = require("../../utils/history-sync");
const { buildLocalAccountState } = require("../../utils/cloud");
const { openRecord } = require("../../utils/record-navigation");

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
    : "抽签和问事结果会直接写入当前设备本地存储。";

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
  return (Array.isArray(history) ? history : [])
    .filter((item) => item.type !== "chart")
    .map(({ result, ...entry }) => ({ ...entry, hasResult: Boolean(result) }));
}

Page({
  data: {
    activeFilter: "all",
    showStats: false,
    expandedReviewId: "",
    capacity: { total: 0, limit: 20, remaining: 20, isNearLimit: false, isFull: false },
    editingReviewId: "",
    reviewNoteDraft: "",
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
    const allHistory = getHistory();
    const history = getVisibleHistory(allHistory);
    const summary = summarizeHistory(history);
    const statusCopy = history.length
      ? "记录已保存在当前设备本地。"
      : "当前还没有本地记录，新内容会直接保存在这台设备。";

    this.setData({
      capacity: getHistoryCapacity(allHistory),
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

  handleReviewToggle(event) {
    const { id } = event.currentTarget.dataset;
    this.setData({ expandedReviewId: this.data.expandedReviewId === id ? "" : id });
  },

  handleStatsToggle() {
    this.setData({ showStats: !this.data.showStats });
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

    try {
      updateHistoryEntry(id, {
        reviewStatus: status,
        reviewUpdatedAt: Date.now(),
      });
    } catch (error) {
      wx.showToast({ title: "回访保存失败，请重试", icon: "none" });
      return;
    }
    this.loadHistory();
    wx.showToast({
      title: "回访已更新",
      icon: "none",
    });
  },

  handleOpenRecord(event) {
    openRecord(event.currentTarget.dataset.id);
  },

  handleEditReviewNote(event) {
    const entry = getHistoryEntry(event.currentTarget.dataset.id);
    if (!entry || entry.type !== "yao") return;
    this.setData({ editingReviewId: entry.id, reviewNoteDraft: entry.reviewNote });
  },

  handleReviewNoteInput(event) {
    this.setData({ reviewNoteDraft: event.detail.value.slice(0, 200) });
  },

  handleCancelReviewNote() {
    this.setData({ editingReviewId: "", reviewNoteDraft: "" });
  },

  handleSaveReviewNote() {
    if (!this.data.editingReviewId) return;
    try {
      const entry = saveReviewNote(this.data.editingReviewId, this.data.reviewNoteDraft);
      this.handleCancelReviewNote();
      this.loadHistory();
      wx.showToast({ title: entry ? "回访备注已保存" : "记录已不在本机", icon: "none" });
    } catch (error) {
      wx.showToast({ title: "备注保存失败，请重试", icon: "none" });
    }
  },

  noop() {},

  handleDeleteRecord(event) {
    const { id } = event.currentTarget.dataset;
    const entry = getHistoryEntry(id);
    if (!entry) return;

    wx.showModal({
      title: "删除这条记录？",
      content: `“${entry.title}”的完整结果和回访信息都会从本机删除，删除后无法恢复。`,
      confirmText: "删除",
      confirmColor: "#a84f2c",
      success: ({ confirm }) => {
        if (!confirm) return;
        try {
          const deleted = deleteHistoryEntry(id);
          this.loadHistory();
          wx.showToast({ title: deleted ? "记录已删除" : "记录已不在本机", icon: "none" });
        } catch (error) {
          wx.showToast({ title: "删除失败，请重试", icon: "none" });
        }
      },
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
          capacity: getHistoryCapacity(result.history),
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
