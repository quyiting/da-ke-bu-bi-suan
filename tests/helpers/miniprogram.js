const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

function createWx() {
  const storage = new Map();
  const navigation = [];
  const notices = [];
  const paintedTexts = [];
  const modals = [];
  return {
    navigation,
    notices,
    paintedTexts,
    modals,
    getStorageSync(key) {
      return storage.has(key) ? JSON.parse(storage.get(key)) : "";
    },
    setStorageSync(key, value) {
      storage.set(key, JSON.stringify(value));
    },
    removeStorageSync(key) {
      storage.delete(key);
    },
    navigateTo(options) {
      navigation.push(options.url);
    },
    switchTab(options) {
      navigation.push(options.url);
    },
    pageScrollTo() {},
    showToast(options) {
      notices.push(options.title);
    },
    showModal(options) {
      notices.push(options.content);
      modals.push(options);
    },
    answerModal(confirm) {
      const modal = modals.shift();
      if (!modal) throw new Error("No pending modal");
      modal.success({ confirm, cancel: !confirm });
    },
    createCanvasContext() {
      const context = {};
      for (const method of ["setFillStyle", "setFontSize", "setTextAlign", "setStrokeStyle", "setLineWidth", "fillRect", "beginPath", "moveTo", "lineTo", "arcTo", "closePath", "fill", "stroke", "arc"]) {
        context[method] = () => {};
      }
      context.fillText = (text) => paintedTexts.push(text);
      context.createLinearGradient = () => ({ addColorStop() {} });
      context.draw = (reserve, callback) => callback();
      return context;
    },
    canvasToTempFilePath(options) {
      options.success({ tempFilePath: "/tmp/test-poster.png" });
    },
  };
}

function loadPage(relativePath) {
  const filename = path.resolve(__dirname, "../..", relativePath);
  const timers = new Map();
  let page;
  let timerId = 0;
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    require: createRequire(filename),
    console,
    wx: global.wx,
    Page(definition) {
      page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)) };
      page.setData = function (patch) { Object.assign(this.data, patch); };
    },
    setTimeout(callback) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return ++timerId; },
    clearInterval() {},
  }, { filename });
  page.runTimers = () => {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach((callback) => callback());
  };
  page.runNextTimer = () => {
    const next = timers.entries().next().value;
    if (!next) return;
    timers.delete(next[0]);
    next[1]();
  };
  return page;
}

module.exports = { createWx, loadPage };
