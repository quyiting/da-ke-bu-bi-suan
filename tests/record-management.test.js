const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");
const { getHistory, getHistoryCapacity, deleteHistoryEntry } = require("../utils/history");

const tap = (dataset) => ({ currentTarget: { dataset } });
function seedRecords(count) {
  wx.setStorageSync("fortune-history", Array.from({ length: count }, (_, index) => ({
    id: `r${index}`, title: `记录${index}`, type: "draw", createdAt: index + 1, updatedAt: index + 1,
    result: { poem: `签文${index}` },
  })));
}
beforeEach(() => { global.wx = createWx(); });

test("单条删除保留其他记录及其完整结果", () => {
  seedRecords(2);
  assert.equal(typeof deleteHistoryEntry, "function");
  assert.equal(deleteHistoryEntry("r0"), true);
  assert.equal(getHistory().length, 1);
  assert.equal(getHistory()[0].id, "r1");
  assert.deepEqual(getHistory()[0].result, { poem: "签文1" });
  assert.equal(deleteHistoryEntry("missing"), false);
});

test("容量提醒计算剩余空间和真正最久未更新的记录", () => {
  seedRecords(18);
  assert.equal(typeof getHistoryCapacity, "function");
  const capacity = getHistoryCapacity();
  assert.equal(capacity.remaining, 2);
  assert.equal(capacity.isNearLimit, true);
  assert.equal(capacity.isFull, false);
  const records = getHistory();
  records[0].updatedAt = 10000;
  wx.setStorageSync("fortune-history", records);
  assert.equal(getHistoryCapacity().oldestEntry.id, "r1");
  const page = loadPage("pages/profile/profile.js");
  page.onShow();
  assert.equal(page.data.capacity.total, 18);
  assert.equal(page.data.capacity.remaining, 2);
});

test("取消删除保留记录，确认删除后刷新当前筛选和统计", () => {
  wx.setStorageSync("fortune-history", [
    { id: "draw", type: "draw", title: "签", result: { poem: "原签" } },
    { id: "yao", type: "yao", title: "卦", reviewStatus: "pending", result: { question: "原问题" } },
  ]);
  const page = loadPage("pages/profile/profile.js");
  page.onShow();
  page.setFilter(tap({ filter: "yao" }));
  assert.equal(typeof page.handleDeleteRecord, "function");
  page.handleDeleteRecord(tap({ id: "yao" }));
  assert.equal(getHistory().length, 2);
  wx.answerModal(false);
  assert.equal(getHistory().length, 2);
  page.handleDeleteRecord(tap({ id: "yao" }));
  wx.answerModal(true);
  assert.equal(getHistory().length, 1);
  assert.equal(page.data.filteredHistory.length, 0);
  assert.equal(page.data.activeFilter, "yao");
  assert.equal(page.data.summary.total, 1);
  assert.equal(page.data.summary.pendingReviewCount, 0);
});

test("删除写入失败时保留记录并提示重试", () => {
  seedRecords(2);
  const page = loadPage("pages/profile/profile.js");
  page.onShow();
  assert.equal(typeof page.handleDeleteRecord, "function");
  page.handleDeleteRecord(tap({ id: "r0" }));
  wx.setStorageSync = () => { throw new Error("storage unavailable"); };
  assert.doesNotThrow(() => wx.answerModal(true));
  assert.equal(getHistory().length, 2);
  assert.match(wx.notices.at(-1), /删除失败/);
});

for (const [name, filename, action, resultField] of [
  ["抽签", "pages/draw/draw.js", "handleDraw", "currentLot"],
  ["六爻", "pages/yao/yao.js", "handleCast", "result"],
]) {
  test(`${name}满额时取消生成保留全部原记录`, () => {
    seedRecords(20);
    const page = loadPage(filename);
    page[action]();
    page[action]();
    assert.equal(wx.modals.length, 1);
    assert.match(wx.modals[0].content, /记录0/);
    wx.answerModal(false);
    page.runTimers();
    assert.equal(getHistory().length, 20);
    assert.equal(page.data[resultField], null);
    assert.equal(getHistory()[0].id, "r0");
  });

  test(`${name}确认满额生成后仅替换最久未更新的记录`, () => {
    seedRecords(20);
    const originals = getHistory();
    originals[0].updatedAt = 10000;
    wx.setStorageSync("fortune-history", originals);
    const page = loadPage(filename);
    page[action]();
    assert.equal(wx.modals.length, 1);
    assert.match(wx.modals[0].content, /记录1/);
    wx.answerModal(true);
    page.runTimers();
    assert.equal(getHistory().length, 20);
    assert.ok(page.data[resultField]);
    assert.ok(getHistory().some(entry => entry.id === "r0"));
    assert.equal(getHistory().some(entry => entry.id === "r1"), false);
    assert.ok(getHistory().some(entry => !entry.id.startsWith("r")));
  });
}
