const { featureCards, homeJourneyCards, ritualSteps } = require("../../utils/content");
const { createHomeHighlight } = require("../../utils/fortune");
const { getHistory, summarizeHistory } = require("../../utils/history");

function buildSummaryCards(summary) {
  let preferenceValue = "尚未形成";

  if (summary.favoriteType === "draw") {
    preferenceValue = "问签偏多";
  } else if (summary.favoriteType === "yao") {
    preferenceValue = "六爻偏多";
  } else if (summary.favoriteType === "chart") {
    preferenceValue = "星盘偏多";
  } else if (summary.total) {
    preferenceValue = "比较均衡";
  }

  return [
    {
      label: "累计记录",
      value: `${summary.total}`,
    },
    {
      label: "探索天数",
      value: `${summary.exploreDays}`,
    },
    {
      label: "近期偏好",
      value: preferenceValue,
    },
  ];
}

function buildRecommendation(summary, todayHighlight) {
  const currentHour = new Date().getHours();

  if (!summary.total) {
    return {
      action: "从主题抽签开始",
      desc: "你还没有第一条记录，最适合先从一件具体的事开始问，这样更容易留下记忆点。",
      title: "先收下你的第一支主题签",
      url: "/pages/draw/draw",
    };
  }

  if (summary.pendingReviewCount) {
    return {
      action: "回看我的记录",
      desc: `你还有 ${summary.pendingReviewCount} 条六爻在等回访。现在回头标一次“已应 / 部分应 / 暂未应”，会比继续起新卦更有价值。`,
      title: "先把正在应的卦对照一下",
      url: "/pages/profile/profile",
    };
  }

  if (!summary.chartCount) {
    return {
      action: "先建一张星盘",
      desc: "你已经开始用内容功能了，但还没有你的出生档案。补上星盘后，整个产品会更像一套个人化报告系统。",
      title: "把“看内容”升级成“看自己的盘”",
      url: "/pages/chart/chart",
    };
  }

  if (currentHour < 12) {
    return {
      action: "先起一卦",
      desc: `今天主线偏${todayHighlight.focus}，如果你手头正有一件需要判断的事，六爻会比泛泛的日运更直接。`,
      title: "把今天最在意的问题先卜出来",
      url: "/pages/yao/yao",
    };
  }

  if (summary.favoriteType === "chart") {
    return {
      action: "搭配六爻判断",
      desc: "你已经有了偏长期的星盘画像，这时候补一卦当下判断，会让内容层次更完整。",
      title: "把长期画像接到眼前决策",
      url: "/pages/yao/yao",
    };
  }

  if (summary.favoriteType === "yao") {
    return {
      action: "补一支主题签",
      desc: "你最近更常用六爻做判断，这时候加一支主题签，会让体验从“判断局势”多一层“接收提醒”的感觉。",
      title: "把抽签互动补进来",
      url: "/pages/draw/draw",
    };
  }

  if (summary.favoriteType === "draw") {
    return {
      action: "再起一卦",
      desc: "你已经很会用抽签收提醒了，现在补一层六爻判断，会更适合处理“要不要动”这种具体问题。",
      title: "给直觉提醒配一个判断工具",
      url: "/pages/yao/yao",
    };
  }

  return {
    action: "回看我的记录",
    desc: "你的使用已经比较均衡了，接下来最值得做的是复盘最近反复出现的主题，为后续会员内容做铺垫。",
    title: "开始做一次轻复盘",
    url: "/pages/profile/profile",
  };
}

Page({
  data: {
    featureCards,
    homeJourneyCards,
    recommendation: {
      action: "开始体验",
      desc: "先从一支主题签或者一卦六爻开始。",
      title: "欢迎来到大可不必算",
      url: "/pages/chart/chart",
    },
    recentEntry: null,
    ritualSteps,
    summaryCards: [],
    todayHighlight: {},
  },

  onShow() {
    const history = getHistory();
    const summary = summarizeHistory(history);
    const todayHighlight = createHomeHighlight();

    this.setData({
      recommendation: buildRecommendation(summary, todayHighlight),
      recentEntry: history[0] || null,
      todayHighlight,
      summaryCards: buildSummaryCards(summary),
    });
  },

  onShareAppMessage() {
    return {
      title: "来大可不必算抽一支签，看看今天的风向",
      path: "/pages/index/index",
    };
  },
});
