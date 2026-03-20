const { clearHistory, getHistory, summarizeHistory } = require("./history");
const { buildLocalAccountState } = require("./cloud");

const DEFAULT_SYNC_PREFERENCES = {
  storageMode: "local",
};

let syncQueue = Promise.resolve();

function getAppInstance() {
  try {
    return getApp();
  } catch (error) {
    return null;
  }
}

function getAccountSnapshot() {
  const app = getAppInstance();

  if (app && typeof app.getAccountState === "function") {
    return app.getAccountState();
  }

  return buildLocalAccountState();
}

function updateAccountSnapshot(patch) {
  const app = getAppInstance();

  if (app && typeof app.updateAccountState === "function") {
    return app.updateAccountState(patch);
  }

  return {
    ...getAccountSnapshot(),
    ...patch,
  };
}

function getSyncPreferences() {
  return {
    ...DEFAULT_SYNC_PREFERENCES,
  };
}

function buildResult(accountState, history, extra = {}) {
  const safeHistory = Array.isArray(history) ? history : getHistory();

  return {
    accountState,
    history: safeHistory,
    summary: summarizeHistory(safeHistory),
    ...extra,
  };
}

function buildStatusCopy(history = [], reason = "") {
  if (!history.length) {
    return "当前还没有本地记录，新内容会直接保存在这台设备。";
  }

  if (reason === "profile-review-updated") {
    return "回访状态已更新，并保存在当前设备。";
  }

  if (reason === "draw-created" || reason === "yao-created" || reason === "chart-created") {
    return "新记录已保存到当前设备本地。";
  }

  return "记录只保存在当前设备，不会上传到云端。";
}

function requestHistorySync(options = {}) {
  const runTask = () => {
    const history = getHistory();
    const accountState = updateAccountSnapshot(
      buildLocalAccountState(buildStatusCopy(history, options.reason || ""))
    );

    return buildResult(accountState, history, {
      ok: true,
      skipped: true,
      storage: "local",
    });
  };

  const nextPromise = syncQueue.then(runTask, runTask);
  syncQueue = nextPromise.catch(() => {});

  return nextPromise;
}

function clearLocalHistoryOnly() {
  clearHistory();

  const emptyHistory = getHistory();
  const accountState = updateAccountSnapshot(
    buildLocalAccountState("本机记录已清空；后续新记录会继续保存在当前设备。")
  );

  return buildResult(accountState, emptyHistory, {
    ok: true,
    skipped: true,
    storage: "local",
  });
}

module.exports = {
  clearLocalHistoryOnly,
  getAccountSnapshot,
  getSyncPreferences,
  requestHistorySync,
};
