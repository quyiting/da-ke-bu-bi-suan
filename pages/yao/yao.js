const { yaoTopics } = require("../../utils/yao-data");
const { buildSixYaoReading } = require("../../utils/yao");
const { addHistory, createHistoryEntry, getReviewMeta, updateHistoryEntry } = require("../../utils/history");
const { requestHistorySync } = require("../../utils/history-sync");

const POSTER_WIDTH = 620;
const POSTER_HEIGHT = 1080;
const PENDING_YAO_INTENT_KEY = "fortune-pending-yao-intent";
const reviewOptions = [
  { id: "pending", label: "待回看" },
  { id: "partial", label: "部分应" },
  { id: "matched", label: "已应" },
  { id: "unmet", label: "暂未应" },
];

function splitText(text, maxChars = 18, maxLines = 3) {
  const safeText = `${text || ""}`.trim();

  if (!safeText) {
    return [];
  }

  const result = [];
  let currentLine = "";

  for (let index = 0; index < safeText.length; index += 1) {
    const char = safeText[index];

    if (char === "\n") {
      if (currentLine) {
        result.push(currentLine);
        currentLine = "";
      }
    } else {
      currentLine += char;
    }

    if (currentLine.length >= maxChars) {
      result.push(currentLine);
      currentLine = "";
    }

    if (result.length >= maxLines) {
      break;
    }
  }

  if (currentLine && result.length < maxLines) {
    result.push(currentLine);
  }

  if (result.length === maxLines && safeText.length > result.join("").length) {
    result[maxLines - 1] = `${result[maxLines - 1].slice(0, Math.max(maxChars - 1, 1))}…`;
  }

  return result;
}

function drawRoundRect(ctx, x, y, width, height, radius, fillColor, strokeColor, lineWidth = 1) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
  ctx.closePath();

  if (fillColor) {
    ctx.setFillStyle(fillColor);
    ctx.fill();
  }

  if (strokeColor) {
    ctx.setStrokeStyle(strokeColor);
    ctx.setLineWidth(lineWidth);
    ctx.stroke();
  }
}

function drawHexagram(ctx, lines, x, y, width, lineHeight, gapY, useChanged = false) {
  const segmentGap = 26;
  const segmentWidth = (width - segmentGap) / 2;

  lines.forEach((line, index) => {
    const top = y + index * gapY;
    const isYang = useChanged ? line.changedIsYang : line.isYang;
    const accentColor = useChanged ? "#8c623f" : "#5b351f";

    if (isYang) {
      drawRoundRect(ctx, x, top, width, lineHeight, 999, accentColor);
    } else {
      drawRoundRect(ctx, x, top, segmentWidth, lineHeight, 999, accentColor);
      drawRoundRect(ctx, x + segmentWidth + segmentGap, top, segmentWidth, lineHeight, 999, accentColor);
    }

    if (line.isMoving) {
      ctx.beginPath();
      ctx.setFillStyle(useChanged ? "#d5b18e" : "#d17b4e");
      ctx.arc(x + width + 16, top + lineHeight / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function fillParagraph(ctx, text, x, y, options = {}) {
  const {
    color = "#503528",
    fontSize = 24,
    lineHeight = 34,
    maxChars = 18,
    maxLines = 3,
  } = options;
  const lines = splitText(text, maxChars, maxLines);

  ctx.setFillStyle(color);
  ctx.setFontSize(fontSize);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return y + lines.length * lineHeight;
}

function drawTagRow(ctx, tags, x, y) {
  let cursorX = x;

  tags.forEach((tag) => {
    const chipWidth = Math.min(160, Math.max(88, tag.length * 18 + 32));
    drawRoundRect(ctx, cursorX, y, chipWidth, 34, 17, "rgba(150, 95, 56, 0.12)");
    ctx.setFillStyle("#91592d");
    ctx.setFontSize(16);
    ctx.fillText(tag, cursorX + 16, y + 22);
    cursorX += chipWidth + 12;
  });
}

function getTopicById(topicId) {
  return yaoTopics.find((item) => item.id === topicId) || yaoTopics[0];
}

function getQuestionGuides(topicId) {
  return getTopicById(topicId).questionGuides || [];
}

function getGuideById(topicId, guideId) {
  return getQuestionGuides(topicId).find((item) => item.id === guideId) || null;
}

function buildTimingPreview(timingProfile) {
  const primaryPoint = (timingProfile.timeline || [])[0];

  if (!primaryPoint) {
    return timingProfile.primaryLabel && timingProfile.primaryLabel !== "常规显期"
      ? `主看 ${timingProfile.primaryLabel}`
      : "";
  }

  return `${primaryPoint.scopeLabel}先看 ${primaryPoint.label}${primaryPoint.note ? `（${primaryPoint.note}）` : ""}`;
}

function buildReviewState(status = "pending") {
  const meta = getReviewMeta(status);

  return {
    activeReviewLabel: meta.label,
    activeReviewStatus: status,
    activeReviewTone: meta.tone,
  };
}

function buildQuickTiming(result) {
  const primaryPoint = (result.timingProfile.timeline || [])[0];

  if (primaryPoint) {
    return {
      copy: `${primaryPoint.scopeLabel} · ${primaryPoint.title}`,
      value: primaryPoint.label,
    };
  }

  if (result.timingProfile.primaryLabel && result.timingProfile.primaryLabel !== "常规显期") {
    return {
      copy: result.timingProfile.summary,
      value: result.timingProfile.primaryLabel,
    };
  }

  return {
    copy: result.timingHint,
    value: "先看现实反馈",
  };
}

function buildQuickVoice(result) {
  const label = result.decision.label;

  if (label === "顺势而为") {
    return "这件事整体是顺的，可以开始往前动。";
  }

  if (label === "小步试探" || label === "边动边看") {
    return "可以动，但先别一次推太满。";
  }

  if (label === "宜缓不宜急") {
    return "现在不适合硬推，先缓一缓更稳。";
  }

  if (label === "先稳后动") {
    return "不是不能动，而是要先把关键条件摸清。";
  }

  if (label === "先看再定") {
    return "这卦先别急着给自己下终局判断。";
  }

  if (label === "暗线待发") {
    return "机会不是没有，只是答案还没完全浮到台面上。";
  }

  if (label === "先等暗线") {
    return "眼下先别逼结果，真正有用的信息还在暗线里。";
  }

  return "先看眼下最真实的反馈，再决定下一步。";
}

function buildQuickLead(result) {
  const label = result.decision.label;

  if (label === "顺势而为") {
    return "这时候更适合顺着眼前这股劲先做一步，再看外面的回应会不会继续跟上。";
  }

  if (label === "小步试探" || label === "边动边看") {
    return "先做一轮轻动作，边看反馈边决定要不要继续加码，会比一口气冲到底更稳。";
  }

  if (label === "宜缓不宜急") {
    return "现在更适合等条件补齐、消息落地，别让情绪替你做推进。";
  }

  if (label === "先稳后动") {
    return "先把真正能承接这件事的条件找出来，后面的判断会清楚很多。";
  }

  if (label === "先看再定") {
    return "眼下还不够亮，先别急着下重结论，回到世应和动爻给你的现实反馈就好。";
  }

  if (label === "暗线待发" || label === "先等暗线") {
    return "先盯消息、补资料、幕后条件和真实态度变化，不要只盯表面一句话。";
  }

  return result.decision.desc || result.overview;
}

function buildQuickActionValue(result) {
  const primaryAction = result.nextActions[0] || "";

  if (primaryAction.includes("暗线")) {
    return "先找暗线证据";
  }

  if (primaryAction.includes("现实条件") || primaryAction.includes("确认")) {
    return "先确认现实条件";
  }

  if (primaryAction.includes("节奏")) {
    return "先对齐节奏";
  }

  if (primaryAction.includes("守住")) {
    return "先想清底线";
  }

  if (primaryAction.includes("最能产生反馈")) {
    return "先做最小动作";
  }

  if (primaryAction.includes("不要")) {
    return "先别急着定";
  }

  return "先做一条轻动作";
}

function buildDisplayResult(result) {
  const quickTiming = buildQuickTiming(result);

  return {
    ...result,
    quickLead: buildQuickLead(result),
    quickPanels: [
      {
        copy: result.decision.desc,
        label: "现在更像",
        value: result.yongShenProfile.verdictLabel,
      },
      {
        copy: result.nextActions[1] || "先做一条轻动作，再等局面给你反馈。",
        label: "你先做",
        value: buildQuickActionValue(result),
      },
      {
        copy: quickTiming.copy,
        label: "先盯时间",
        value: quickTiming.value,
      },
    ],
    quickTags: [result.topic.label, result.decision.label]
      .concat(result.timingProfile.primaryLabel && result.timingProfile.primaryLabel !== "常规显期"
        ? [result.timingProfile.primaryLabel]
        : [])
      .slice(0, 3),
    quickVoice: buildQuickVoice(result),
  };
}

function consumePendingIntent(page) {
  const pendingIntent = wx.getStorageSync(PENDING_YAO_INTENT_KEY);

  if (!pendingIntent || !pendingIntent.topicId) {
    return;
  }

  wx.removeStorageSync(PENDING_YAO_INTENT_KEY);
  const topic = getTopicById(pendingIntent.topicId);
  const guides = topic.questionGuides || [];
  const guide = pendingIntent.guideId
    ? guides.find((item) => item.id === pendingIntent.guideId) || null
    : null;

  page.setData({
    activeRecordId: "",
    ...buildReviewState("pending"),
    castingText: guide ? `已替你把问题收束到“${guide.label}”，这卦会更好读。` : topic.settleHint,
    drawButtonText: "立即起卦",
    posterImage: "",
    posterVisible: false,
    questionGuides: guides,
    questionInput: pendingIntent.questionInput || (guide ? guide.template : topic.prompt),
    result: null,
    selectedGuideId: guide ? guide.id : "",
    selectedTopicId: topic.id,
    showDetailedResult: false,
  });
}

Page({
  data: {
    activeRecordId: "",
    activeReviewLabel: buildReviewState().activeReviewLabel,
    activeReviewStatus: buildReviewState().activeReviewStatus,
    activeReviewTone: buildReviewState().activeReviewTone,
    castingText: "先把问题收成一句话，再起一卦。",
    drawButtonText: "立即起卦",
    isCasting: false,
    isPosterGenerating: false,
    posterImage: "",
    posterVisible: false,
    questionInput: "",
    questionGuides: getQuestionGuides(yaoTopics[0].id),
    reviewOptions,
    result: null,
    selectedGuideId: "",
    selectedTopicId: yaoTopics[0].id,
    showDetailedResult: false,
    yaoTopics,
  },

  onShow() {
    consumePendingIntent(this);
  },

  selectTopic(event) {
    const { topicId } = event.currentTarget.dataset;
    const nextTopic = getTopicById(topicId);

    if (!topicId || topicId === this.data.selectedTopicId) {
      return;
    }

    this.setData({
      castingText: nextTopic.settleHint,
      questionInput: "",
      questionGuides: nextTopic.questionGuides || [],
      selectedGuideId: "",
      selectedTopicId: topicId,
    });
  },

  applyQuestionGuide(event) {
    const { guideId } = event.currentTarget.dataset;
    const guide = getGuideById(this.data.selectedTopicId, guideId);

    if (!guide) {
      return;
    }

    this.setData({
      castingText: `已替你把问题收束到“${guide.label}”，这卦会更好读。`,
      questionInput: guide.template,
      selectedGuideId: guide.id,
    });
  },

  handleQuestionInput(event) {
    this.setData({
      questionInput: event.detail.value,
    });
  },

  handleCast() {
    if (this.data.isCasting) {
      return;
    }

    const selectedTopic = getTopicById(this.data.selectedTopicId);
    const selectedGuide = getGuideById(this.data.selectedTopicId, this.data.selectedGuideId);
    const questionText = this.data.questionInput.trim() || (selectedGuide ? selectedGuide.template : selectedTopic.prompt);

    this.setData({
      activeRecordId: "",
      ...buildReviewState("pending"),
      castingText: "卦在路上，先别急着替它下结论。",
      drawButtonText: "起卦中",
      isCasting: true,
      isPosterGenerating: false,
      posterImage: "",
      posterVisible: false,
      result: null,
      showDetailedResult: false,
    });

    this.castTimer = setTimeout(() => {
      const result = buildDisplayResult(buildSixYaoReading(this.data.selectedTopicId, questionText));
      const historyEntry = createHistoryEntry("yao", {
        badge: `${result.changedHexagram.title} · ${result.decision.label}`,
        question: result.question,
        questionGuideLabel: selectedGuide ? selectedGuide.label : "",
        reviewStatus: "pending",
        subtitle: `${selectedGuide ? `${selectedGuide.label} · ` : ""}${result.calendar.monthPillar}月 ${result.calendar.dayPillar}日 · ${result.relationProfile.shiLabel}世 ${result.relationProfile.yingLabel}应`,
        summary: result.yongShenProfile.verdictBody,
        timingPreview: buildTimingPreview(result.timingProfile),
        title: `${result.topic.label} · ${result.originalHexagram.title}`,
        topicLabel: result.topic.label,
      });

      addHistory(historyEntry);
      requestHistorySync({
        reason: "yao-created",
      });

      this.setData({
        activeRecordId: historyEntry.id,
        castingText: "先看一句结果。要不要展开详细盘，等你自己决定。",
        drawButtonText: "再问一件事",
        isCasting: false,
        questionInput: result.question,
        result,
      });
    }, 1200);
  },

  handleDetailToggle() {
    this.setData({
      showDetailedResult: !this.data.showDetailedResult,
    });
  },

  handleReviewStatus(event) {
    const { status } = event.currentTarget.dataset;

    if (!status || !this.data.activeRecordId) {
      return;
    }

    const updatedEntry = updateHistoryEntry(this.data.activeRecordId, {
      reviewStatus: status,
      reviewUpdatedAt: Date.now(),
    });

    if (!updatedEntry) {
      return;
    }

    this.setData({
      ...buildReviewState(status),
    });
    requestHistorySync({
      reason: "yao-review-updated",
    });

    wx.showToast({
      title: `已标记为${updatedEntry.reviewLabel}`,
      icon: "none",
    });
  },

  handlePosterOpen() {
    if (!this.data.result) {
      return;
    }

    this.setData({
      posterVisible: true,
    });

    if (!this.data.posterImage && !this.data.isPosterGenerating) {
      this.generatePoster();
    }
  },

  handlePosterClose() {
    this.setData({
      posterVisible: false,
    });
  },

  noop() {},

  generatePoster() {
    if (!this.data.result || this.data.isPosterGenerating) {
      return;
    }

    const { result } = this.data;
    const ctx = wx.createCanvasContext("posterCanvas", this);

    this.setData({
      isPosterGenerating: true,
    });

    const gradient = ctx.createLinearGradient(0, 0, 0, POSTER_HEIGHT);
    gradient.addColorStop(0, "#f8efdf");
    gradient.addColorStop(1, "#e2c29a");
    ctx.setFillStyle(gradient);
    ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

    ctx.setFillStyle("rgba(146, 86, 35, 0.08)");
    ctx.beginPath();
    ctx.arc(520, 120, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(70, 920, 130, 0, Math.PI * 2);
    ctx.fill();

    drawRoundRect(ctx, 24, 24, POSTER_WIDTH - 48, POSTER_HEIGHT - 48, 30, "rgba(255, 250, 243, 0.88)", "rgba(126, 77, 46, 0.12)");

    drawRoundRect(ctx, 48, 54, 168, 34, 17, "rgba(146, 86, 35, 0.12)");
    ctx.setFillStyle("#8c5325");
    ctx.setFontSize(16);
    ctx.fillText("大可不必算 · 六爻", 64, 76);

    ctx.setFillStyle("#2e1f18");
    ctx.setFontSize(34);
    ctx.fillText(result.originalHexagram.title, 48, 126);
    ctx.setFillStyle("#8a6548");
    ctx.setFontSize(18);
    ctx.fillText(`之 ${result.changedHexagram.title} · ${result.relationProfile.palaceLabel}${result.relationProfile.palaceStage}`, 48, 158);

    drawRoundRect(ctx, 480, 114, 86, 86, 43, "rgba(168, 79, 44, 0.1)", "rgba(168, 79, 44, 0.18)");
    ctx.setFillStyle("#a84f2c");
    ctx.setFontSize(28);
    ctx.fillText("卦", 512, 162);

    drawRoundRect(ctx, 48, 210, 524, 108, 22, "rgba(255, 246, 233, 0.92)");
    fillParagraph(ctx, result.question, 72, 238, {
      color: "#4e3427",
      fontSize: 24,
      lineHeight: 34,
      maxChars: 18,
      maxLines: 2,
    });

    drawTagRow(ctx, [`月建 ${result.calendar.monthPillar}`, `日辰 ${result.calendar.dayPillar}`, `旬空 ${result.calendar.emptyLabel}`], 48, 340);

    drawRoundRect(ctx, 48, 396, 524, 250, 26, "rgba(255, 249, 242, 0.86)", "rgba(126, 77, 46, 0.08)");
    ctx.setFillStyle("#9b6437");
    ctx.setFontSize(16);
    ctx.fillText("本卦", 88, 432);
    ctx.fillText("变卦", 352, 432);

    drawHexagram(ctx, result.formalLines.rows, 82, 460, 120, 12, 26, false);
    drawHexagram(ctx, result.formalLines.rows, 346, 460, 120, 12, 26, true);

    ctx.setFillStyle("#3a2518");
    ctx.setFontSize(22);
    ctx.fillText(result.originalHexagram.title, 68, 620);
    ctx.fillText(result.changedHexagram.title, 332, 620);
    ctx.setFillStyle("#8a6548");
    ctx.setFontSize(16);
    ctx.fillText(`${result.relationProfile.shiLabel}世 · ${result.relationProfile.yingLabel}应`, 68, 648);
    ctx.fillText(result.yongShenProfile.verdictLabel, 332, 648);

    drawRoundRect(ctx, 48, 680, 524, 156, 24, "rgba(255, 247, 235, 0.94)");
    ctx.setFillStyle("#9b6437");
    ctx.setFontSize(16);
    ctx.fillText("断语", 72, 714);
    ctx.setFillStyle("#362318");
    ctx.setFontSize(28);
    ctx.fillText(result.decision.label, 72, 754);
    fillParagraph(ctx, result.decision.desc, 72, 792, {
      color: "#654a38",
      fontSize: 20,
      lineHeight: 30,
      maxChars: 21,
      maxLines: 2,
    });

    drawRoundRect(ctx, 48, 858, 524, 144, 24, "rgba(255, 250, 243, 0.84)", "rgba(126, 77, 46, 0.08)");
    ctx.setFillStyle("#9b6437");
    ctx.setFontSize(16);
    ctx.fillText("用神提要", 72, 892);
    fillParagraph(ctx, result.yongShenProfile.verdictBody, 72, 928, {
      color: "#5a4031",
      fontSize: 20,
      lineHeight: 30,
      maxChars: 21,
      maxLines: 2,
    });

    ctx.setFillStyle("#8a6548");
    ctx.setFontSize(16);
    ctx.fillText(result.generatedAtLabel, 48, 1034);
    ctx.setTextAlign("right");
    ctx.fillText("适合保存到相册后分享", 572, 1034);
    ctx.setTextAlign("left");

    ctx.draw(false, () => {
      wx.canvasToTempFilePath(
        {
          canvasId: "posterCanvas",
          destHeight: POSTER_HEIGHT * 2,
          destWidth: POSTER_WIDTH * 2,
          height: POSTER_HEIGHT,
          width: POSTER_WIDTH,
          success: ({ tempFilePath }) => {
            this.setData({
              isPosterGenerating: false,
              posterImage: tempFilePath,
            });
          },
          fail: () => {
            this.setData({
              isPosterGenerating: false,
            });
            wx.showToast({
              title: "海报生成失败",
              icon: "none",
            });
          },
        },
        this
      );
    });
  },

  savePoster() {
    if (!this.data.posterImage) {
      wx.showToast({
        title: this.data.isPosterGenerating ? "海报生成中" : "先生成海报",
        icon: "none",
      });
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterImage,
      success: () => {
        wx.showToast({
          title: "已保存到相册",
          icon: "success",
        });
      },
      fail: (error) => {
        if (error.errMsg && error.errMsg.indexOf("auth") !== -1) {
          wx.showModal({
            title: "需要相册权限",
            content: "允许保存到相册后，就可以把卦单海报留到手机里。",
            success: ({ confirm }) => {
              if (confirm) {
                wx.openSetting();
              }
            },
          });
          return;
        }

        wx.showToast({
          title: "保存失败",
          icon: "none",
        });
      },
    });
  },

  onUnload() {
    clearTimeout(this.castTimer);
  },

  onShareAppMessage() {
    if (this.data.result) {
      return {
        title: `我在大可不必算起到了${this.data.result.originalHexagram.title}之${this.data.result.changedHexagram.title}`,
        path: "/pages/yao/yao",
      };
    }

    return {
      title: "来大可不必算起一卦，看看这件事该怎么走",
      path: "/pages/yao/yao",
    };
  },

  onShareTimeline() {
    if (this.data.result) {
      return {
        title: `${this.data.result.originalHexagram.title}之${this.data.result.changedHexagram.title} · 大可不必算`,
        query: "",
      };
    }

    return {
      title: "大可不必算 · 六爻排盘",
      query: "",
    };
  },
});
