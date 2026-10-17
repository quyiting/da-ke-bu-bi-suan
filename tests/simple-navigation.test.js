const test = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");

test("首页问事打开空白问题框并退出旧结果回看", () => {
  global.wx = createWx();
  wx.setStorageSync("fortune-pending-record-id", "old-record");
  const home = loadPage("pages/index/index.js");
  home.handleOpenYao();
  assert.equal(wx.getStorageSync("fortune-pending-record-id"), "");
  assert.equal(wx.navigation.at(-1), "/pages/yao/yao");
  const yao = loadPage("pages/yao/yao.js");
  yao.data.result = { question: "previous question" };
  yao.data.isViewingRecord = true;
  yao.onShow();
  assert.equal(yao.data.result, null);
  assert.equal(yao.data.isViewingRecord, false);
  assert.equal(yao.data.questionInput, "");
  assert.equal(yao.data.selectedGuideId, "");
});

test("回访操作每次展开一条记录并支持再次收起", () => {
  global.wx = createWx();
  const profile = loadPage("pages/profile/profile.js");
  const tap = (id) => profile.handleReviewToggle({ currentTarget: { dataset: { id } } });
  tap("first");
  assert.equal(profile.data.expandedReviewId, "first");
  tap("second");
  assert.equal(profile.data.expandedReviewId, "second");
  tap("second");
  assert.equal(profile.data.expandedReviewId, "");
});
