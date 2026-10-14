const { drawModes, drawTopics, focusPrompts } = require("../../utils/content");
const { drawDailyLot, drawLot, getDateKey } = require("../../utils/fortune");
const { DAILY_LOT_KEY, getDailyLot } = require("../../utils/daily-lot");
const { addHistory, createHistoryEntry, getHistoryEntry } = require("../../utils/history");
const { requestHistorySync } = require("../../utils/history-sync");
const { fillParagraph } = require("../../utils/poster-text");
const { confirmHistoryCapacity } = require("../../utils/history-capacity");

const POSTER_WIDTH = 620;
const POSTER_HEIGHT = 1080;

Page({
  data: {
    currentLot: null,
    currentPrompt: drawTopics[0].prompt,
    drawButtonText: "抽一签",
    drawModes,
    drawTopics,
    isDrawing: false,
    isDaily: false,
    dailyDate: "",
    isViewingRecord: false,
    recordSaved: false,
    showDetailedResult: false,
    isPosterGenerating: false,
    posterImage: "",
    posterVisible: false,
    motionText: "先把念头放稳，再抽一签。",
    selectedModeId: drawModes[1].id,
    selectedTopicId: drawTopics[0].id,
    supportivePrompt: focusPrompts[0],
  },

  onLoad(options = {}) {
    if (options.daily === "1") {
      this.setData({ isDaily: true });
      this.refreshDaily();
    }
    if (options.recordId) {
      const entry = getHistoryEntry(options.recordId);

      if (entry && entry.type === "draw" && entry.result) {
        this.setData({
          currentLot: entry.result,
          isViewingRecord: true,
          recordSaved: true,
          selectedTopicId: entry.result.topic.id,
          selectedModeId: entry.result.mode.id,
          currentPrompt: entry.result.topic.prompt,
          motionText: `正在回看 ${entry.dateLabel} 的签文。`,
        });
      } else {
        wx.showToast({ title: "这条记录没有完整签文", icon: "none" });
      }
    }

    this.promptTimer = setInterval(() => {
      const nextPrompt =
        focusPrompts[Math.floor(Math.random() * focusPrompts.length)];

      this.setData({
        supportivePrompt: nextPrompt,
      });
    }, 2800);
  },

  onShow() {
    if (this.data.isDaily) this.refreshDaily();
  },

  refreshDaily() {
    const dailyDate = getDateKey();
    if (this.data.isDrawing && this.data.dailyDate === dailyDate) return;
    const daily = getDailyLot();
    const currentLot = this.data.currentLot && this.data.currentLot.dailyDate === dailyDate
      ? this.data.currentLot : daily && daily.result;
    if (this.data.dailyDate !== dailyDate) {
      clearTimeout(this.drawTimer);
      this.setData({ isDrawing: false, showDetailedResult: false, posterImage: "", posterVisible: false, isPosterGenerating: false });
    }
    this.setData({
      dailyDate,
      currentLot: currentLot || null,
      recordSaved: daily ? daily.recordSaved : false,
      selectedTopicId: "self",
      selectedModeId: "observe",
      currentPrompt: drawTopics.find((topic) => topic.id === "self").prompt,
      drawButtonText: "揭开今日一签",
      motionText: "一天一签，给今天留一句提醒。",
    });
  },

  onUnload() {
    clearInterval(this.promptTimer);
    clearTimeout(this.drawTimer);
  },

  handleDetailToggle() {
    this.setData({ showDetailedResult: !this.data.showDetailedResult });
  },

  handleNewDraw() {
    this.setData({
      isDaily: false,
      currentLot: null,
      isViewingRecord: false,
      recordSaved: false,
      showDetailedResult: false,
      isPosterGenerating: false,
      posterImage: "",
      posterVisible: false,
      drawButtonText: "抽一签",
      motionText: "先把念头放稳，再抽一签。",
    });
  },

  selectTopic(event) {
    const { topicId } = event.currentTarget.dataset;
    const selectedTopic = drawTopics.find((item) => item.id === topicId);

    if (this.data.isDaily || this.data.isDrawing || !selectedTopic || topicId === this.data.selectedTopicId) {
      return;
    }

    this.setData({
      currentPrompt: selectedTopic.prompt,
      selectedTopicId: topicId,
    });
  },

  selectMode(event) {
    const { modeId } = event.currentTarget.dataset;

    if (this.data.isDaily || this.data.isDrawing || !modeId || modeId === this.data.selectedModeId) {
      return;
    }

    this.setData({
      selectedModeId: modeId,
    });
  },

  handleDraw() {
    if (this.data.isDrawing) return;
    if (this.data.isDaily) {
      this.refreshDaily();
      if (this.data.currentLot) return;
    }
    confirmHistoryCapacity(this, () => this.startDraw());
  },

  startDraw() {
    if (this.data.isDrawing) {
      return;
    }

    this.setData({
      currentLot: null,
      recordSaved: false,
      showDetailedResult: false,
      isPosterGenerating: false,
      posterImage: "",
      posterVisible: false,
      drawButtonText: "抽签中",
      isDrawing: true,
      motionText: "签在路上，先别急着替它下结论。",
    });

    this.drawTimer = setTimeout(() => {
      const lot = this.data.isDaily ? drawDailyLot() : drawLot(this.data.selectedTopicId, this.data.selectedModeId);
      if (this.data.isDaily) {
        try { wx.setStorageSync(DAILY_LOT_KEY, lot); } catch (error) { /* 历史记录仍可保存完整每日签。 */ }
      }

      let recordSaved = true;
      try {
        addHistory(createHistoryEntry("draw", {
          title: `${lot.dailyDate ? "今日一签" : lot.topic.label} · ${lot.title}`,
          subtitle: `${lot.level} · ${lot.mode.label}`,
          summary: lot.insight,
          badge: `${lot.supportColor} · ${lot.supportDirection}`,
          result: lot,
        }));
        requestHistorySync({ reason: "draw-created" });
      } catch (error) {
        recordSaved = false;
        wx.showToast({ title: "本机保存失败，请先保存海报", icon: "none" });
      }

      this.setData({
        currentLot: lot,
        dailyDate: lot.dailyDate || "",
        drawButtonText: "再抽一签",
        isDrawing: false,
        recordSaved,
        motionText: "签已经出来了，先看最打动你的那一句。",
      });
      wx.pageScrollTo({ scrollTop: 0, duration: 200 });
    }, 1100);
  },

  handlePosterOpen() {
    if (!this.data.currentLot) return;
    this.setData({ posterVisible: true });
    if (!this.data.posterImage && !this.data.isPosterGenerating) this.generatePoster();
  },

  handlePosterClose() {
    this.setData({ posterVisible: false });
  },

  noop() {},

  generatePoster() {
    if (!this.data.currentLot || this.data.isPosterGenerating) return;
    const lot = this.data.currentLot;
    const ctx = wx.createCanvasContext("posterCanvas", this);
    this.setData({ isPosterGenerating: true });
    ctx.setFillStyle("#f5efe4");
    ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    ctx.setFillStyle("#fffaf3");
    ctx.fillRect(24, 24, 572, 1032);
    fillParagraph(ctx, `大可不必算 · ${lot.dailyDate ? "今日一签 " + lot.dailyDate : "抽签"}`, 48, 82, { color: "#a84f2c", fontSize: 22 });
    fillParagraph(ctx, lot.title, 48, 152, { fontSize: 38, maxChars: 12, maxLines: 1 });
    fillParagraph(ctx, `${lot.topic.label} · ${lot.level} · ${lot.mode.label}`, 48, 194, { fontSize: 20, maxChars: 24, maxLines: 1 });
    ctx.setFillStyle("#f5ecdd");
    ctx.fillRect(48, 230, 524, 170);
    fillParagraph(ctx, lot.poem, 72, 278, { fontSize: 28, lineHeight: 38, maxChars: 17, maxLines: 3 });
    fillParagraph(ctx, "一句提醒", 48, 454, { color: "#a84f2c", fontSize: 20 });
    fillParagraph(ctx, lot.insight, 48, 496, { maxChars: 21, maxLines: 3 });
    fillParagraph(ctx, "可以先做", 48, 644, { color: "#a84f2c", fontSize: 20 });
    lot.nextActions.slice(0, 3).forEach((action, index) => {
      fillParagraph(ctx, `${index + 1}. ${action}`, 48, 686 + index * 88, { fontSize: 22, maxChars: 22, maxLines: 2 });
    });
    fillParagraph(ctx, "内容仅供娱乐与自我探索参考", 48, 1008, { color: "#866d54", fontSize: 18, maxChars: 26 });
    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: "posterCanvas",
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        destWidth: POSTER_WIDTH * 2,
        destHeight: POSTER_HEIGHT * 2,
        success: ({ tempFilePath }) => {
          if (this.data.currentLot === lot) this.setData({ isPosterGenerating: false, posterImage: tempFilePath });
        },
        fail: () => {
          if (this.data.currentLot !== lot) return;
          this.setData({ isPosterGenerating: false });
          wx.showToast({ title: "海报生成失败，请重试", icon: "none" });
        },
      }, this);
    });
  },

  savePoster() {
    if (!this.data.posterImage) return;
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterImage,
      success: () => wx.showToast({ title: "已保存到相册", icon: "success" }),
      fail: () => wx.showToast({ title: "保存失败，请检查相册权限", icon: "none" }),
    });
  },

  onShareAppMessage() {
    if (this.data.currentLot) {
      return {
        title: `我在大可不必算抽到了${this.data.currentLot.topic.label} · ${this.data.currentLot.title}`,
        path: "/pages/draw/draw",
      };
    }

    return {
      title: "来大可不必算抽一签，先听一句提醒",
      path: "/pages/draw/draw",
    };
  },
});
