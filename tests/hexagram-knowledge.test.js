const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createWx, loadPage } = require("./helpers/miniprogram");
const { hexagramMap } = require("../utils/yao-data");
const { getHistory } = require("../utils/history");

beforeEach(() => { global.wx = createWx(); });
function getKnowledge(id) { return require("../utils/hexagram-knowledge").getHexagramKnowledge(id); }

test("64卦均有准确对应的卦名、原文和白话提示", () => {
  const ids = Object.keys(hexagramMap);
  assert.equal(ids.length, 64);
  const orders = new Set();
  for (const id of ids) {
    const knowledge = getKnowledge(id);
    assert.equal(knowledge.title, hexagramMap[id].title);
    assert.ok(knowledge.guaCi.length > 0, id);
    assert.ok(knowledge.plainMeaning.length > 0, id);
    orders.add(knowledge.order);
  }
  assert.equal(orders.size, 64);
  assert.equal(getKnowledge("qian-qian").guaCi, "乾：元亨，利贞。");
  assert.equal(getKnowledge("kan-zhen").name, "屯");
  assert.equal(getKnowledge("kan-zhen").order, 3);
  assert.equal(getKnowledge("li-kan").name, "未济");
  assert.equal(getKnowledge("li-kan").order, 64);
  assert.equal(getKnowledge("missing"), null);
});

test("知识卡片可展开收起，回看旧快照不修改当时结果", () => {
  const page = loadPage("pages/yao/yao.js");
  page.handleCast();
  page.runTimers();
  const saved = getHistory()[0];
  assert.equal(page.data.hexagramKnowledge.title, saved.result.originalHexagram.title);
  assert.equal(page.data.showHexagramKnowledge, false);
  page.handleKnowledgeToggle();
  assert.equal(page.data.showHexagramKnowledge, true);
  page.handleKnowledgeToggle();
  assert.equal(page.data.showHexagramKnowledge, false);
  const legacy = JSON.parse(JSON.stringify(saved));
  delete legacy.result.castLines;
  wx.setStorageSync("fortune-history", [legacy]);
  wx.setStorageSync("fortune-pending-record-id", legacy.id);
  const reopened = loadPage("pages/yao/yao.js");
  reopened.onShow();
  assert.equal(reopened.data.hexagramKnowledge.title, legacy.result.originalHexagram.title);
  assert.equal(JSON.stringify(reopened.data.result), JSON.stringify(legacy.result));
  assert.equal(getHistory().length, 1);
});
