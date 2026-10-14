const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx } = require("./helpers/miniprogram");
const { createHistoryEntry, addHistory, getHistory, updateHistoryEntry } = require("../utils/history");

beforeEach(() => { global.wx = createWx(); });

test("完整结果在本地重新读取后保持原样", () => {
  addHistory(createHistoryEntry("draw", {
    title: "一支签",
    result: { title: "云开", poem: "云开见月明", nextActions: ["先完成一件小事"] },
  }));
  assert.deepEqual(getHistory()[0].result, {
    title: "云开", poem: "云开见月明", nextActions: ["先完成一件小事"],
  });
});

test("更新回访保留当时卦盘和创建时间", () => {
  const entry = createHistoryEntry("yao", {
    title: "一件事", result: { originalHexagram: { title: "乾为天" }, question: "是否继续" },
  });
  addHistory(entry);
  updateHistoryEntry(entry.id, { reviewStatus: "matched", reviewUpdatedAt: 1000 });
  const saved = getHistory()[0];
  assert.equal(saved.reviewStatus, "matched");
  assert.equal(saved.createdAt, entry.createdAt);
  assert.deepEqual(saved.result, { originalHexagram: { title: "乾为天" }, question: "是否继续" });
});

test("旧摘要记录仍然可以读取和回访", () => {
  wx.setStorageSync("fortune-history", [{ id: "legacy", type: "yao", title: "旧卦", summary: "旧摘要" }]);
  updateHistoryEntry("legacy", { reviewStatus: "partial" });
  assert.equal(getHistory()[0].summary, "旧摘要");
  assert.equal(getHistory()[0].reviewStatus, "partial");
});
