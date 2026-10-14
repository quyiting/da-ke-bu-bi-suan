const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");
const { getHistory, deleteHistoryEntry } = require("../utils/history");
const fortune = require("../utils/fortune");

beforeEach(() => { global.wx = createWx(); });
function drawDaily() {
  const page = loadPage("pages/draw/draw.js");
  page.onLoad({ daily: "1" });
  page.handleDraw();
  page.runTimers();
  return page;
}

test("每日签按本地日期固定全部内容，换天更新", () => {
  assert.equal(typeof fortune.drawDailyLot, "function");
  const morning = fortune.drawDailyLot(new Date(2026, 9, 14, 8));
  const evening = fortune.drawDailyLot(new Date(2026, 9, 14, 23));
  assert.deepEqual(morning, evening);
  assert.equal(morning.dailyDate, "2026-10-14");
  assert.equal(fortune.drawDailyLot(new Date(2026, 9, 15)).dailyDate, "2026-10-15");
});

test("首页每日签只提供入口，重开和重复点击只保存一次", () => {
  const home = loadPage("pages/index/index.js");
  home.onShow();
  assert.equal(getHistory().length, 0);
  home.handleOpenDaily();
  assert.equal(wx.navigation.at(-1), "/pages/draw/draw?daily=1");
  const first = drawDaily();
  const reopened = drawDaily();
  assert.ok(first.data.currentLot.dailyDate);
  assert.equal(JSON.stringify(reopened.data.currentLot), JSON.stringify(first.data.currentLot));
  assert.equal(getHistory().length, 1);
  assert.equal(reopened.data.recordSaved, true);
});

test("删除每日签记录后仍固定原签，不重新添加被删除的记录", () => {
  const first = drawDaily();
  deleteHistoryEntry(getHistory()[0].id);
  const reopened = drawDaily();
  assert.equal(JSON.stringify(reopened.data.currentLot), JSON.stringify(first.data.currentLot));
  assert.equal(getHistory().length, 0);
  assert.equal(reopened.data.recordSaved, false);
});

test("每日签缓存写入失败可从历史恢复且不重复保存", () => {
  const write = wx.setStorageSync;
  wx.setStorageSync = (key, value) => {
    if (key === "fortune-daily-lot") throw new Error("cache unavailable");
    write(key, value);
  };
  const first = drawDaily();
  const reopened = drawDaily();
  assert.equal(JSON.stringify(reopened.data.currentLot), JSON.stringify(first.data.currentLot));
  assert.equal(getHistory().length, 1);
});

test("每日签所有写入失败时仍可阅读固定结果并提示保存失败", () => {
  wx.setStorageSync = () => { throw new Error("storage unavailable"); };
  const first = drawDaily();
  const reopened = drawDaily();
  assert.ok(first.data.currentLot.dailyDate);
  assert.equal(JSON.stringify(reopened.data.currentLot), JSON.stringify(first.data.currentLot));
  assert.equal(reopened.data.recordSaved, false);
  assert.match(wx.notices.at(-1), /保存失败/);
  const currentLot = first.data.currentLot;
  first.onShow();
  assert.equal(first.data.currentLot, currentLot, "返回页面保留当日未保存的签文及海报回调身份");
});

test("跨天返回今日签清除旧海报，新签只在再次揭开后保存", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 9, 14, 23, 59).getTime() });
  const page = drawDaily();
  assert.equal(page.data.currentLot.dailyDate, "2026-10-14");
  page.handlePosterOpen();
  assert.ok(page.data.posterImage);
  t.mock.timers.tick(120000);
  page.onShow();
  assert.equal(page.data.dailyDate, "2026-10-15");
  assert.equal(page.data.currentLot, null);
  assert.equal(page.data.posterImage, "");
  assert.equal(getHistory().length, 1);
  page.handleDraw();
  page.runTimers();
  assert.equal(page.data.currentLot.dailyDate, "2026-10-15");
  assert.equal(getHistory().length, 2);
});

test("满额时取消今日一签不写缓存，已抽过的每日签不触发替换", () => {
  wx.setStorageSync("fortune-history", Array.from({ length: 20 }, (_, index) => ({
    id: `r${index}`, title: `旧记录${index}`, type: "draw", createdAt: index + 1,
  })));
  const page = loadPage("pages/draw/draw.js");
  page.onLoad({ daily: "1" });
  page.handleDraw();
  wx.answerModal(false);
  page.runTimers();
  assert.equal(page.data.currentLot, null);
  assert.equal(wx.getStorageSync("fortune-daily-lot"), "");
  page.handleDraw();
  wx.answerModal(true);
  page.runTimers();
  const reopened = drawDaily();
  assert.ok(reopened.data.currentLot.dailyDate);
  assert.equal(getHistory().length, 20);
  assert.equal(wx.modals.length, 0);
});
