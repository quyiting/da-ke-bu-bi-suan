const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");
const { getHistory } = require("../utils/history");

const tap = (dataset) => ({ currentTarget: { dataset } });
beforeEach(() => { global.wx = createWx(); });

test("抽签后重建页面能回看原签且不新增记录", () => {
  const draw = loadPage("pages/draw/draw.js");
  draw.handleDraw();
  draw.runTimers();
  const saved = getHistory()[0];
  assert.ok(saved.result, "抽签必须保存完整签文");
  assert.equal(saved.result.poem, draw.data.currentLot.poem);

  const reopened = loadPage("pages/draw/draw.js");
  reopened.onLoad({ recordId: saved.id });
  assert.equal(reopened.data.currentLot.poem, saved.result.poem);
  assert.equal(reopened.data.isViewingRecord, true);
  assert.equal(getHistory().length, 1);
});

test("记录页打开六爻后恢复原卦并保留最新回访", () => {
  const yao = loadPage("pages/yao/yao.js");
  yao.handleCast();
  yao.runTimers();
  const saved = getHistory()[0];
  assert.ok(saved.result, "六爻必须保存完整卦盘");
  assert.equal(saved.result.originalHexagram.title, yao.data.result.originalHexagram.title);

  const profile = loadPage("pages/profile/profile.js");
  profile.onShow();
  profile.handleReviewStatus(tap({ id: saved.id, status: "matched" }));
  profile.handleOpenRecord(tap({ id: saved.id }));
  assert.equal(wx.navigation.at(-1), "/pages/yao/yao");

  const reopened = loadPage("pages/yao/yao.js");
  reopened.onShow();
  assert.equal(JSON.stringify(reopened.data.result), JSON.stringify(saved.result));
  assert.equal(reopened.data.activeRecordId, saved.id);
  assert.equal(reopened.data.activeReviewStatus, "matched");
  assert.equal(reopened.data.showDetailedResult, false);
  assert.equal(reopened.data.isViewingRecord, true);
  assert.equal(getHistory().length, 1);
  reopened.handleReviewStatus(tap({ status: "partial" }));
  assert.equal(getHistory()[0].reviewStatus, "partial");
});

test("首页最近结果直接回看原签而不是重新抽签", () => {
  const draw = loadPage("pages/draw/draw.js");
  draw.handleDraw();
  draw.runTimers();
  const saved = getHistory()[0];
  const home = loadPage("pages/index/index.js");
  home.onShow();
  home.handleOpenRecent();
  assert.equal(wx.navigation.at(-1), `/pages/draw/draw?recordId=${saved.id}`);
});

test("旧摘要记录不会触发重新起卦", () => {
  wx.setStorageSync("fortune-history", [{ id: "legacy", type: "yao", title: "旧卦", summary: "旧摘要" }]);
  const profile = loadPage("pages/profile/profile.js");
  profile.onShow();
  assert.equal(typeof profile.handleOpenRecord, "function", "记录页需要提供回看入口");
  profile.handleOpenRecord(tap({ id: "legacy" }));
  assert.equal(wx.navigation.length, 0);
  assert.equal(getHistory().length, 1);
  assert.match(wx.notices.at(-1), /摘要/);
});

test("抽签先展示简明结果，展开或开始新签不改变原记录", () => {
  const draw = loadPage("pages/draw/draw.js");
  draw.handleDraw();
  draw.runTimers();
  assert.equal(draw.data.showDetailedResult, false);
  draw.handleDetailToggle();
  assert.equal(draw.data.showDetailedResult, true);
  const saved = getHistory()[0];
  const reopened = loadPage("pages/draw/draw.js");
  reopened.onLoad({ recordId: saved.id });
  reopened.handleNewDraw();
  assert.equal(reopened.data.currentLot, null);
  assert.equal(reopened.data.isViewingRecord, false);
  assert.equal(getHistory().length, 1);
});

test("六爻回看结束后能开始新问题，原卦仍留在记录中", () => {
  const yao = loadPage("pages/yao/yao.js");
  yao.handleCast();
  yao.runTimers();
  const profile = loadPage("pages/profile/profile.js");
  profile.handleOpenRecord(tap({ id: getHistory()[0].id }));
  const reopened = loadPage("pages/yao/yao.js");
  reopened.onShow();
  assert.equal(typeof reopened.handleNewQuestion, "function");
  reopened.handleNewQuestion();
  assert.equal(reopened.data.isViewingRecord, false);
  assert.equal(reopened.data.result, null);
  assert.equal(reopened.data.activeRecordId, "");
  assert.equal(getHistory().length, 1);
});

for (const [name, filename, action, field] of [
  ["抽签", "pages/draw/draw.js", "handleDraw", "currentLot"],
  ["六爻", "pages/yao/yao.js", "handleCast", "result"],
]) {
  test(`${name}本地保存失败时仍能阅读结果且不会卡在生成中`, () => {
    const page = loadPage(filename);
    const setStorage = wx.setStorageSync;
    wx.setStorageSync = (key, value) => {
      if (key === "fortune-history") throw new Error("storage full");
      setStorage(key, value);
    };
    page[action]();
    assert.doesNotThrow(() => page.runTimers());
    assert.ok(page.data[field]);
    assert.equal(page.data.recordSaved, false);
    assert.equal(page.data[action === "handleDraw" ? "isDrawing" : "isCasting"], false);
    assert.match(wx.notices.at(-1), /保存失败/);
    assert.equal(getHistory().length, 0);
  });
}

test("记录列表仅向页面发送摘要，完整卦盘留在本地用于回看", () => {
  const yao = loadPage("pages/yao/yao.js");
  yao.handleCast();
  yao.runTimers();
  const profile = loadPage("pages/profile/profile.js");
  profile.onShow();
  assert.ok(getHistory()[0].result);
  assert.equal(profile.data.history[0].hasResult, true);
  assert.equal(profile.data.history[0].result, undefined);
});

test("起卦等待中切换分类不会让问题和卦盘分类错配", () => {
  const yao = loadPage("pages/yao/yao.js");
  yao.data.questionInput = "对方有没有回应";
  yao.handleCast();
  yao.selectTopic(tap({ topicId: "career" }));
  yao.runTimers();
  assert.equal(yao.data.result.topic.id, "love");
  assert.equal(yao.data.result.question, "对方有没有回应");
});

test("回访保存失败时保留之前的状态并提示重试", () => {
  const yao = loadPage("pages/yao/yao.js");
  yao.handleCast();
  yao.runTimers();
  wx.setStorageSync = () => { throw new Error("storage unavailable"); };
  assert.doesNotThrow(() => yao.handleReviewStatus(tap({ status: "matched" })));
  assert.equal(yao.data.activeReviewStatus, "pending");
  assert.equal(getHistory()[0].reviewStatus, "pending");
  assert.match(wx.notices.at(-1), /回访保存失败/);
});
