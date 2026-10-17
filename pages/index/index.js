const { yaoTopics } = require("../../utils/yao-data");
const { getDateKey } = require("../../utils/fortune");
const { getDailyLot } = require("../../utils/daily-lot");
const { getHistory, summarizeHistory } = require("../../utils/history");
const { openRecord } = require("../../utils/record-navigation");

const PENDING_YAO_INTENT_KEY = "fortune-pending-yao-intent";
const tabPages = new Set([
  "/pages/index/index",
  "/pages/yao/yao",
  "/pages/profile/profile",
]);

function getVisibleHistory(history = getHistory()) {
  return (Array.isArray(history) ? history : []).filter((item) => item.type !== "chart");
}

function buildRecentCard(history = [], summary = {}) {
  const recentEntry = Array.isArray(history) ? history[0] : null;

  if (!recentEntry) {
    return {
      actionLabel: "从问事开始",
      body: "选一个最接近你现状的问题去问，比空泛地看一堆结果更容易留下感觉。",
      eyebrow: "还没开始",
      mode: "switchTab",
      tags: ["先问一句", "再看详细盘"],
      title: "先把今天最在意的事问出来",
      url: "/pages/yao/yao",
    };
  }

  if (recentEntry.type === "yao") {
    return {
      actionLabel: recentEntry.result ? "回看这次问事" : "去记录看摘要",
      recordId: recentEntry.result ? recentEntry.id : "",
      body: recentEntry.summary,
      eyebrow: summary.pendingReviewCount ? "先回看，再继续问" : "最近问到这里",
      mode: "switchTab",
      tags: [recentEntry.typeLabel]
        .concat(recentEntry.reviewLabel ? [recentEntry.reviewLabel] : [])
        .concat(recentEntry.timingPreview ? [recentEntry.timingPreview] : []),
      title: recentEntry.question || recentEntry.title,
      url: "/pages/profile/profile",
    };
  }

  if (recentEntry.type === "draw") {
    return {
      actionLabel: recentEntry.result ? "回看这支签" : "去记录看摘要",
      recordId: recentEntry.result ? recentEntry.id : "",
      body: recentEntry.summary,
      eyebrow: "最近抽到这支签",
      mode: "switchTab",
      tags: [recentEntry.typeLabel].concat(recentEntry.badge ? [recentEntry.badge] : []),
      title: recentEntry.title,
      url: "/pages/profile/profile",
    };
  }

  return {
    actionLabel: "去我的记录",
    body: recentEntry.summary,
    eyebrow: "最近留下的记录",
    mode: "switchTab",
    tags: [recentEntry.typeLabel].concat(recentEntry.topicLabel ? [recentEntry.topicLabel] : []),
    title: recentEntry.title,
    url: "/pages/profile/profile",
  };
}

function openPage(url, mode = "switchTab") {
  if (!url) {
    return;
  }

  if (mode === "navigate" || !tabPages.has(url)) {
    wx.navigateTo({ url });
    return;
  }

  wx.switchTab({ url });
}

Page({
  data: {
    dailyCard: {},
    recentCard: null,
    hasHistory: false,
  },

  onShow() {
    const history = getVisibleHistory();
    const daily = getDailyLot();
    this.setData({
      hasHistory: history.length > 0,
      dailyCard: {
        date: getDateKey(),
        title: daily ? daily.result.title : "给今天留一句提醒",
        copy: daily ? daily.result.poem : "每天一签，慢慢找到自己的节奏。",
        action: daily ? "回看今日一签" : "抽今日一签",
      },
      recentCard: buildRecentCard(history, summarizeHistory(history)),
    });
  },

  handleOpenYao() {
    wx.removeStorageSync("fortune-pending-record-id");
    wx.setStorageSync(PENDING_YAO_INTENT_KEY, {
      topicId: yaoTopics[0].id,
      guideId: "",
      questionInput: "",
    });
    wx.switchTab({ url: "/pages/yao/yao" });
  },

  handleOpenDraw() {
    wx.navigateTo({
      url: "/pages/draw/draw",
    });
  },

  handleOpenDaily() {
    wx.navigateTo({ url: "/pages/draw/draw?daily=1" });
  },

  handleOpenRecent() {
    const { recentCard } = this.data;

    if (!recentCard) {
      return;
    }

    if (recentCard.recordId) {
      openRecord(recentCard.recordId);
      return;
    }

    openPage(recentCard.url, recentCard.mode);
  },

  onShareAppMessage() {
    return {
      title: "来大可不必算问一件事，先看一句结果，再决定要不要展开详细盘",
      path: "/pages/index/index",
    };
  },
});
