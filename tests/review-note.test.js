const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");
const { getHistory, deleteHistoryEntry, saveReviewNote, summarizeHistory } = require("../utils/history");

const tap = (dataset) => ({ currentTarget: { dataset } });
const input = (value) => ({ detail: { value } });
function cast() {
  const page = loadPage("pages/yao/yao.js");
  page.handleCast();
  page.runTimers();
  return page;
}
beforeEach(() => { global.wx = createWx(); });

test("旧摘要记录可补充备注，读取时默认空备注", () => {
  wx.setStorageSync("fortune-history", [{ id: "old", type: "yao", title: "旧卦", summary: "旧摘要" }]);
  assert.equal(getHistory()[0].reviewNote, "");
  assert.equal(typeof saveReviewNote, "function");
  saveReviewNote("old", "  后来收到了回复  ");
  assert.equal(getHistory()[0].reviewNote, "后来收到了回复");
  assert.equal(getHistory()[0].summary, "旧摘要");
  assert.equal(getHistory()[0].reviewStatus, "pending");
});

test("记录页保存备注后原卦页能读取，卦盘和创建时间保持不变", () => {
  cast();
  const original = getHistory()[0];
  const profile = loadPage("pages/profile/profile.js");
  profile.onShow();
  assert.equal(typeof profile.handleEditReviewNote, "function");
  profile.handleEditReviewNote(tap({ id: original.id }));
  profile.handleReviewNoteInput(input("  已沟通，对方说明天回复。  "));
  profile.handleSaveReviewNote();
  assert.equal(profile.data.editingReviewId, "");
  assert.equal(profile.data.history[0].reviewNote, "已沟通，对方说明天回复。");
  const saved = getHistory()[0];
  assert.equal(saved.createdAt, original.createdAt);
  assert.equal(saved.reviewStatus, "pending");
  assert.ok(saved.reviewUpdatedAt);
  assert.equal(JSON.stringify(saved.result), JSON.stringify(original.result));
  profile.handleOpenRecord(tap({ id: original.id }));
  const reopened = loadPage("pages/yao/yao.js");
  reopened.onShow();
  assert.equal(reopened.data.activeReviewNote, "已沟通，对方说明天回复。");
  assert.ok(reopened.data.activeReviewUpdatedLabel);
});

test("原卦页编辑备注后记录页同步，状态更新保留备注并支持清空", () => {
  const yao = cast();
  assert.equal(typeof yao.handleEditReviewNote, "function");
  yao.handleEditReviewNote();
  yao.handleReviewNoteInput(input("周五收到反馈"));
  yao.handleSaveReviewNote();
  yao.handleReviewStatus(tap({ status: "partial" }));
  const profile = loadPage("pages/profile/profile.js");
  profile.onShow();
  assert.equal(profile.data.history[0].reviewNote, "周五收到反馈");
  assert.equal(profile.data.history[0].reviewStatus, "partial");
  yao.handleEditReviewNote();
  yao.handleReviewNoteInput(input(""));
  yao.handleSaveReviewNote();
  assert.equal(getHistory()[0].reviewNote, "");
  assert.equal(getHistory()[0].reviewStatus, "partial");
});

test("取消编辑不会保存草稿", () => {
  const yao = cast();
  assert.equal(typeof yao.handleEditReviewNote, "function");
  yao.handleEditReviewNote();
  yao.handleReviewNoteInput(input("还没决定保存"));
  yao.handleCancelReviewNote();
  assert.equal(yao.data.editingReviewId, "");
  assert.equal(getHistory()[0].reviewNote, "");
});

test("备注写入失败时保留草稿供重试", () => {
  const yao = cast();
  assert.equal(typeof yao.handleEditReviewNote, "function");
  yao.handleEditReviewNote();
  yao.handleReviewNoteInput(input("今天见面了"));
  wx.setStorageSync = () => { throw new Error("storage unavailable"); };
  assert.doesNotThrow(() => yao.handleSaveReviewNote());
  assert.equal(yao.data.reviewNoteDraft, "今天见面了");
  assert.ok(yao.data.editingReviewId);
  assert.equal(getHistory()[0].reviewNote, "");
  assert.match(wx.notices.at(-1), /备注保存失败/);
});

test("备注最多保留200字且保存不会恢复已经删除的记录", () => {
  const yao = cast();
  const id = getHistory()[0].id;
  assert.equal(typeof saveReviewNote, "function");
  saveReviewNote(id, "记".repeat(201));
  assert.equal(getHistory()[0].reviewNote.length, 200);
  assert.equal(typeof yao.handleEditReviewNote, "function");
  yao.handleEditReviewNote();
  deleteHistoryEntry(id);
  yao.handleSaveReviewNote();
  assert.equal(getHistory().length, 0);
  assert.equal(yao.data.editingReviewId, "");
  assert.match(wx.notices.at(-1), /不在本机/);
});

test("从首页开始新问题时关闭旧记录的备注草稿", () => {
  const yao = cast();
  yao.handleEditReviewNote();
  yao.handleReviewNoteInput(input("尚未保存的旧备注"));
  wx.setStorageSync("fortune-pending-yao-intent", { topicId: "career", questionInput: "合作如何推进" });
  yao.onShow();
  assert.equal(yao.data.editingReviewId, "");
  assert.equal(yao.data.reviewNoteDraft, "");
  assert.equal(yao.data.result, null);
  assert.equal(getHistory()[0].reviewNote, "");
});

test("最近更新展示修改时间而不是起卦时间", () => {
  wx.setStorageSync("fortune-history", [{
    id: "reviewed", type: "yao", title: "已回访",
    createdAt: new Date(2026, 9, 13, 8, 0).getTime(),
    updatedAt: new Date(2026, 9, 14, 12, 0).getTime(),
  }]);
  assert.equal(summarizeHistory(getHistory()).lastUpdated, "10月14日 12:00");
});
