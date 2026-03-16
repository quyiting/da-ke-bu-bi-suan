const { chartIntroTips } = require("../../utils/chart-data");
const {
  buildBirthChart,
  buildDefaultProfile,
  formatRegion,
  normalizeRegion,
} = require("../../utils/chart");
const { addHistory, createHistoryEntry } = require("../../utils/history");
const { requestHistorySync } = require("../../utils/history-sync");

const CHART_PROFILE_KEY = "chart-profile";

function loadProfile() {
  const storedProfile = wx.getStorageSync(CHART_PROFILE_KEY);
  const defaultProfile = buildDefaultProfile();
  const safeProfile =
    storedProfile && typeof storedProfile === "object" ? storedProfile : {};

  return {
    birthDate: safeProfile.birthDate || defaultProfile.birthDate,
    birthTime: safeProfile.birthTime || defaultProfile.birthTime,
    birthRegion: normalizeRegion(safeProfile.birthRegion || defaultProfile.birthRegion),
  };
}

Page({
  data: {
    birthDate: "",
    birthRegion: [],
    birthRegionLabel: "",
    birthTime: "",
    chartIntroTips,
    chartResult: null,
  },

  onLoad() {
    const profile = loadProfile();

    this.setData({
      birthDate: profile.birthDate,
      birthRegion: profile.birthRegion,
      birthRegionLabel: formatRegion(profile.birthRegion),
      birthTime: profile.birthTime,
    });
  },

  handleBirthDateChange(event) {
    this.setData({
      birthDate: event.detail.value,
    });
  },

  handleBirthTimeChange(event) {
    this.setData({
      birthTime: event.detail.value,
    });
  },

  handleRegionChange(event) {
    const region = normalizeRegion(event.detail.value);

    this.setData({
      birthRegion: region,
      birthRegionLabel: formatRegion(region),
    });
  },

  generateChart() {
    const profile = {
      birthDate: this.data.birthDate,
      birthRegion: this.data.birthRegion,
      birthTime: this.data.birthTime,
    };
    const chartResult = buildBirthChart(profile);

    wx.setStorageSync(CHART_PROFILE_KEY, profile);

    addHistory(
      createHistoryEntry("chart", {
        title: `星盘 · ${chartResult.introLine}`,
        subtitle: chartResult.dominantElement.element,
        summary: chartResult.reportSections[0].body,
        badge: chartResult.birthSummary,
      })
    );
    requestHistorySync({
      reason: "chart-created",
    });

    this.setData({
      birthRegionLabel: formatRegion(profile.birthRegion),
      chartResult,
    });
  },

  onShareAppMessage() {
    if (this.data.chartResult) {
      return {
        title: `我在大可不必算生成了 ${this.data.chartResult.introLine} 的轻量星盘`,
        path: "/pages/chart/chart",
      };
    }

    return {
      title: "来大可不必算生成一张轻量星盘，看看你的大三角底色",
      path: "/pages/chart/chart",
    };
  },
});
