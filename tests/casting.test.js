const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");
const { getHistory } = require("../utils/history");

beforeEach(() => { global.wx = createWx(); });

test("六次投币从初爻逐步揭示，最终卦盘和投币一致且只保存一次", () => {
  const page = loadPage("pages/yao/yao.js");
  page.handleCast();
  assert.equal(page.data.castProgress, 0);
  for (let progress = 1; progress <= 6; progress += 1) {
    page.runNextTimer();
    assert.equal(page.data.castProgress, progress);
    assert.equal(page.data.castingRows.filter(row => row.revealed).length, progress);
    assert.equal(page.data.castCoins.length, 3);
    assert.equal(page.data.result, null);
    assert.equal(getHistory().length, 0);
  }
  const rows = JSON.parse(JSON.stringify(page.data.castingRows));
  page.runNextTimer();
  assert.equal(page.data.isCasting, false);
  assert.equal(getHistory().length, 1);
  for (const row of rows) {
    const formal = page.data.result.formalLines.rows.find(line => line.position === row.position);
    assert.equal(formal.isYang, row.isYang);
    assert.equal(formal.isMoving, row.isMoving);
    const toss = page.data.result.castLines.find(line => line.position === row.position);
    assert.equal(toss.coins.reduce((sum, coin) => sum + coin, 0), row.value);
  }
  page.handleSkipCast();
  page.runTimers();
  assert.equal(getHistory().length, 1);
});

test("跳过动画使用已投出的同一组铜钱，后续回调不会重复保存", () => {
  const page = loadPage("pages/yao/yao.js");
  page.handleCast();
  page.runNextTimer();
  const first = page.data.castingRows.find(row => row.position === 1);
  page.handleSkipCast();
  const saved = getHistory()[0];
  assert.equal(saved.result.castLines[0].value, first.value);
  assert.equal(saved.result.castLines[0].isYang, first.isYang);
  assert.equal(page.data.castProgress, 6);
  page.runTimers();
  assert.equal(getHistory().length, 1);
  assert.equal(JSON.stringify(page.data.result), JSON.stringify(saved.result));
});

test("离开起卦页取消未完成动画，不产生隐藏记录，回来可重新起卦", () => {
  const page = loadPage("pages/yao/yao.js");
  page.handleCast();
  page.runNextTimer();
  page.onHide();
  page.runTimers();
  assert.equal(getHistory().length, 0);
  assert.equal(page.data.isCasting, false);
  assert.equal(page.data.result, null);
  page.onShow();
  page.handleCast();
  page.runTimers();
  assert.equal(getHistory().length, 1);
});

test("首页带入新问题会取消旧投币，旧回调不能覆盖新问题", () => {
  const page = loadPage("pages/yao/yao.js");
  page.handleCast();
  page.runNextTimer();
  wx.setStorageSync("fortune-pending-yao-intent", { topicId: "career", questionInput: "下周沟通计划" });
  page.onShow();
  page.runTimers();
  assert.equal(getHistory().length, 0);
  assert.equal(page.data.questionInput, "下周沟通计划");
  assert.equal(page.data.isCasting, false);
});
