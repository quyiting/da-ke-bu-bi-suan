const { drawModes, drawTopics, focusPrompts } = require("../../utils/content");
const { drawLot } = require("../../utils/fortune");
const { addHistory, createHistoryEntry } = require("../../utils/history");
const { requestHistorySync } = require("../../utils/history-sync");

Page({
  data: {
    currentLot: null,
    currentPrompt: drawTopics[0].prompt,
    drawButtonText: "开始抽签",
    drawModes,
    drawTopics,
    isDrawing: false,
    motionText: "先定一个念头，再轻触签筒。",
    selectedModeId: drawModes[1].id,
    selectedTopicId: drawTopics[0].id,
    supportivePrompt: focusPrompts[0],
  },

  onLoad() {
    this.promptTimer = setInterval(() => {
      const nextPrompt =
        focusPrompts[Math.floor(Math.random() * focusPrompts.length)];

      this.setData({
        supportivePrompt: nextPrompt,
      });
    }, 2800);
  },

  onUnload() {
    clearInterval(this.promptTimer);
    clearTimeout(this.drawTimer);
  },

  selectTopic(event) {
    const { topicId } = event.currentTarget.dataset;
    const selectedTopic = drawTopics.find((item) => item.id === topicId);

    if (!selectedTopic || topicId === this.data.selectedTopicId) {
      return;
    }

    this.setData({
      currentPrompt: selectedTopic.prompt,
      selectedTopicId: topicId,
    });
  },

  selectMode(event) {
    const { modeId } = event.currentTarget.dataset;

    if (!modeId || modeId === this.data.selectedModeId) {
      return;
    }

    this.setData({
      selectedModeId: modeId,
    });
  },

  handleDraw() {
    if (this.data.isDrawing) {
      return;
    }

    this.setData({
      currentLot: null,
      drawButtonText: "抽签中",
      isDrawing: true,
      motionText: "签筒摇动中，请让问题停留在心里。",
    });

    this.drawTimer = setTimeout(() => {
      const lot = drawLot(this.data.selectedTopicId, this.data.selectedModeId);

      addHistory(
        createHistoryEntry("draw", {
          title: `${lot.topic.label} · ${lot.title}`,
          subtitle: `${lot.level} · ${lot.mode.label}`,
          summary: lot.insight,
          badge: `${lot.supportColor} · ${lot.supportDirection}`,
        })
      );
      requestHistorySync({
        reason: "draw-created",
      });

      this.setData({
        currentLot: lot,
        drawButtonText: "再抽一次",
        isDrawing: false,
        motionText: "签文已现，可以慢慢看。",
      });
    }, 1100);
  },

  onShareAppMessage() {
    if (this.data.currentLot) {
      return {
        title: `我在大可不必算抽到了${this.data.currentLot.topic.label} · ${this.data.currentLot.title}`,
        path: "/pages/draw/draw",
      };
    }

    return {
      title: "来大可不必算抽一支今日签，看看今天的提醒",
      path: "/pages/draw/draw",
    };
  },
});
