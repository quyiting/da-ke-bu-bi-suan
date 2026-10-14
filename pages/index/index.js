const { yaoTopics } = require("../../utils/yao-data");
const { createHomeHighlight, getDateKey } = require("../../utils/fortune");
const { getDailyLot } = require("../../utils/daily-lot");
const { getHistory, summarizeHistory } = require("../../utils/history");
const { openRecord } = require("../../utils/record-navigation");

const PENDING_YAO_INTENT_KEY = "fortune-pending-yao-intent";
const shortcutConfigs = [
  {
    id: "love-response",
    copy: "先看回应，不先逼终局。",
    guideId: "response",
    title: "他现在怎么想",
    topicId: "love",
  },
  {
    id: "choice-continue",
    copy: "最适合处理悬而未决的一件事。",
    guideId: "continue",
    title: "这件事要不要继续",
    topicId: "choice",
  },
  {
    id: "career-timing",
    copy: "先判断时机，再决定要不要动。",
    guideId: "timing",
    title: "最近什么时候更适合动",
    topicId: "career",
  },
  {
    id: "love-advance",
    copy: "想知道该主动还是先等一等。",
    guideId: "advance",
    title: "我该主动还是等一等",
    topicId: "love",
  },
];
const utilityCards = [
  {
    action: "回看最近结果",
    copy: "把问过的事和后来有没有应，都留在这里。",
    mode: "switchTab",
    tag: "留痕迹",
    title: "看记录",
    url: "/pages/profile/profile",
  },
];
const tabPages = new Set([
  "/pages/index/index",
  "/pages/yao/yao",
  "/pages/profile/profile",
]);

function getVisibleHistory(history = getHistory()) {
  return (Array.isArray(history) ? history : []).filter((item) => item.type !== "chart");
}

function getTopicById(topicId) {
  return yaoTopics.find((item) => item.id === topicId) || yaoTopics[0];
}

function getGuideById(topicId, guideId) {
  const topic = getTopicById(topicId);
  return (topic.questionGuides || []).find((item) => item.id === guideId) || null;
}

function buildShortcutPresets() {
  return shortcutConfigs.map((config) => {
    const topic = getTopicById(config.topicId);
    const guide = getGuideById(config.topicId, config.guideId);

    return {
      copy: config.copy,
      guideId: config.guideId,
      guideLabel: guide ? guide.label : "",
      id: config.id,
      questionTemplate: guide ? guide.template : topic.prompt,
      title: config.title,
      topicId: topic.id,
      topicLabel: topic.label,
    };
  });
}

function buildSummaryCards(summary) {
  return [
    {
      label: "已抽签",
      value: `${summary.drawCount}`,
    },
    {
      label: "已问事",
      value: `${summary.yaoCount}`,
    },
    {
      label: "待回看",
      value: `${summary.pendingReviewCount}`,
    },
  ];
}

function buildHomeNotice(summary, todayHighlight) {
  if (summary.pendingReviewCount) {
    return `还有 ${summary.pendingReviewCount} 条结果等你回看，先把今天最在意的一件事问清楚。`;
  }

  if (!summary.total) {
    return "先点一个最接近你现状的问题，先拿一句结果，再决定要不要看详细盘。";
  }

  return todayHighlight.quote || "先问一句，再看今天该往哪边靠近。";
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

function getActiveShortcut(shortcutPresets, selectedShortcutId) {
  return (
    shortcutPresets.find((item) => item.id === selectedShortcutId) ||
    shortcutPresets[0] || {
      copy: "",
      guideId: "",
      guideLabel: "",
      id: "",
      questionTemplate: "",
      title: "先选一个问题",
      topicId: "",
      topicLabel: "",
    }
  );
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
    activeShortcut: {},
    dailyCard: {},
    recentCard: null,
    selectedShortcutId: shortcutConfigs[0].id,
    shortcutPresets: buildShortcutPresets(),
    summaryCards: [],
    topNotice: "",
    utilityCards,
  },

  onShow() {
    const history = getVisibleHistory();
    const summary = summarizeHistory(history);
    const todayHighlight = createHomeHighlight();
    const daily = getDailyLot();
    const shortcutPresets = buildShortcutPresets();
    const activeShortcut = getActiveShortcut(shortcutPresets, this.data.selectedShortcutId);

    this.setData({
      activeShortcut,
      dailyCard: {
        date: getDateKey(),
        title: daily ? daily.result.title : "给今天留一句提醒",
        copy: daily ? daily.result.poem : "先安顿自己，再出发。同一天打开，还是同一支签。",
        action: daily ? "回看今日一签" : "揭开今日一签",
      },
      recentCard: buildRecentCard(history, summary),
      shortcutPresets,
      summaryCards: buildSummaryCards(summary),
      topNotice: buildHomeNotice(summary, todayHighlight),
    });
  },

  handleSelectShortcut(event) {
    const { shortcutId } = event.currentTarget.dataset;
    const activeShortcut = getActiveShortcut(this.data.shortcutPresets, shortcutId);

    this.setData({
      activeShortcut,
      selectedShortcutId: activeShortcut.id,
    });
  },

  handleStartYao() {
    wx.removeStorageSync("fortune-pending-record-id");
    const activeShortcut = getActiveShortcut(this.data.shortcutPresets, this.data.selectedShortcutId);

    if (activeShortcut.topicId) {
      wx.setStorageSync(PENDING_YAO_INTENT_KEY, {
        guideId: activeShortcut.guideId,
        questionInput: activeShortcut.questionTemplate,
        topicId: activeShortcut.topicId,
      });
    }

    wx.switchTab({
      url: "/pages/yao/yao",
    });
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

  handleOpenUtility(event) {
    const { mode, url } = event.currentTarget.dataset;
    openPage(url, mode);
  },

  onShareAppMessage() {
    return {
      title: "来大可不必算问一件事，先看一句结果，再决定要不要展开详细盘",
      path: "/pages/index/index",
    };
  },
});
