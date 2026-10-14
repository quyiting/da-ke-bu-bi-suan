const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");
const { addHistory, createHistoryEntry } = require("../utils/history");

beforeEach(() => { global.wx = createWx(); });

test("回看原签时海报使用已保存的签文", () => {
  const entry = createHistoryEntry("draw", {
    title: "云开",
    result: {
      title: "云开", level: "中吉", poem: "云开见月明", insight: "先做一件小事",
      topic: { id: "love", label: "感情", prompt: "关系如何" },
      mode: { id: "observe", label: "观察" }, nextActions: ["先确认对方的真实想法"],
    },
  });
  addHistory(entry);
  const page = loadPage("pages/draw/draw.js");
  page.onLoad({ recordId: entry.id });
  assert.equal(typeof page.handlePosterOpen, "function", "抽签需要海报入口");
  page.handlePosterOpen();
  assert.equal(page.data.posterVisible, true);
  assert.equal(page.data.isPosterGenerating, false);
  assert.ok(page.data.posterImage);
  assert.ok(wx.paintedTexts.includes("云开见月明"));
  assert.ok(wx.paintedTexts.includes("先做一件小事"));
  assert.equal(page.onShareAppMessage().path, "/pages/draw/draw");
});

for (const [name, filename, action] of [
  ["抽签", "pages/draw/draw.js", "handleDraw"],
  ["六爻", "pages/yao/yao.js", "handleCast"],
]) {
  test(`${name}海报导出失败后可以重试`, () => {
    const page = loadPage(filename);
    page[action]();
    page.runTimers();
    assert.equal(typeof page.handlePosterOpen, "function");
    wx.canvasToTempFilePath = (options) => options.fail();
    page.handlePosterOpen();
    assert.equal(page.data.isPosterGenerating, false);
    assert.equal(page.data.posterImage, "");
    assert.match(wx.notices.at(-1), /海报生成失败/);
    wx.canvasToTempFilePath = (options) => options.success({ tempFilePath: "/tmp/retry.png" });
    page.handlePosterOpen();
    assert.ok(page.data.posterImage);
  });
}

test("生成旧海报的回调不能覆盖新卦的海报状态", () => {
  const yao = loadPage("pages/yao/yao.js");
  yao.handleCast();
  yao.runTimers();
  let pendingExport;
  wx.canvasToTempFilePath = (options) => { pendingExport = options; };
  yao.handlePosterOpen();
  yao.handleNewQuestion();
  yao.handleCast();
  yao.runTimers();
  pendingExport.success({ tempFilePath: "/tmp/old-result.png" });
  assert.equal(yao.data.posterImage, "");
});
