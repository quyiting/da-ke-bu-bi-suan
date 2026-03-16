const {
  clearHistory,
  combineHistory,
  getHistory,
  markHistoryEntriesFailed,
  markHistoryEntriesSynced,
  markHistoryLocalOnly,
  summarizeHistory,
} = require("./history");
const {
  bootstrapCloudAccount,
  buildLocalAccountState,
  clearCloudHistorySnapshot,
  formatTimeLabel,
  pullCloudHistorySnapshot,
  pushCloudHistorySnapshot,
} = require("./cloud");

const SYNC_PREFERENCES_KEY = "fortune-history-sync-preferences";
const DEFAULT_SYNC_PREFERENCES = {
  lastLocalClearAt: 0,
  suppressAutoPull: false,
  suppressAutoPush: false,
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

function isRecognizedAccount(accountState = getAccountSnapshot()) {
  return !!(accountState && accountState.userLabel && accountState.userLabel !== "未识别");
}

async function ensureAccountSnapshot(forceRefresh = false) {
  const app = getAppInstance();

  if (app && typeof app.ensureAccountState === "function") {
    return app.ensureAccountState(forceRefresh);
  }

  return bootstrapCloudAccount();
}

function getSyncPreferences() {
  const stored = wx.getStorageSync(SYNC_PREFERENCES_KEY);

  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_SYNC_PREFERENCES };
  }

  return {
    ...DEFAULT_SYNC_PREFERENCES,
    ...stored,
  };
}

function setSyncPreferences(nextPreferences) {
  const safePreferences = {
    ...DEFAULT_SYNC_PREFERENCES,
    ...(nextPreferences || {}),
  };
  wx.setStorageSync(SYNC_PREFERENCES_KEY, safePreferences);

  return safePreferences;
}

function updateSyncPreferences(patch) {
  return setSyncPreferences({
    ...getSyncPreferences(),
    ...(patch || {}),
  });
}

function clearAutoPullSuppression() {
  return updateSyncPreferences({
    suppressAutoPull: false,
  });
}

function clearAutoPushSuppression() {
  return updateSyncPreferences({
    suppressAutoPush: false,
  });
}

function sanitizeHistoryEntry(entry) {
  const safeEntry = entry || {};

  return {
    badge: safeEntry.badge || "",
    createdAt: safeEntry.createdAt || 0,
    id: safeEntry.id,
    question: safeEntry.question || "",
    questionGuideLabel: safeEntry.questionGuideLabel || "",
    reviewStatus: safeEntry.reviewStatus || "",
    reviewUpdatedAt: safeEntry.reviewUpdatedAt || 0,
    subtitle: safeEntry.subtitle || "",
    summary: safeEntry.summary || "",
    syncedAt: safeEntry.syncedAt || 0,
    syncStatus: safeEntry.syncStatus || "local",
    timingPreview: safeEntry.timingPreview || "",
    title: safeEntry.title || "",
    topicLabel: safeEntry.topicLabel || "",
    type: safeEntry.type,
    typeLabel: safeEntry.typeLabel || "",
    updatedAt: safeEntry.updatedAt || safeEntry.createdAt || 0,
  };
}

function serializeHistory(history) {
  return (Array.isArray(history) ? history : []).map((entry) => sanitizeHistoryEntry(entry));
}

function getHistorySnapshot() {
  const history = getHistory();

  return {
    fingerprint: history
      .map((entry) => `${entry.id}:${entry.updatedAt || 0}:${entry.syncStatus || "local"}:${entry.reviewUpdatedAt || 0}`)
      .join("|"),
    history,
  };
}

function hasHistoryChanged(fingerprint) {
  return getHistorySnapshot().fingerprint !== fingerprint;
}

function getHistoryIds(history = []) {
  return (Array.isArray(history) ? history : []).map((entry) => entry.id);
}

function buildCloudMetaPatch(
  remoteHistory = [],
  remoteSyncedAt = 0,
  syncPreferences = getSyncPreferences(),
  localHistory = getHistory()
) {
  const remoteCount = Array.isArray(remoteHistory) ? remoteHistory.length : 0;
  const localCount = Array.isArray(localHistory) ? localHistory.length : 0;
  const shouldPull = remoteCount > 0 && (syncPreferences.suppressAutoPull || !localCount);
  const shouldRestoreUpload = !!syncPreferences.suppressAutoPush && localCount > 0;

  return {
    actionLabel: shouldPull ? "从云端拉回" : shouldRestoreUpload ? "恢复云端备份" : "立即同步",
    autoPullBlocked: !!syncPreferences.suppressAutoPull,
    autoPushBlocked: !!syncPreferences.suppressAutoPush,
    cloudHistoryCount: remoteCount,
    cloudHistoryLabel: `云端 ${remoteCount} 条`,
    cloudUpdatedAt: remoteSyncedAt || 0,
    cloudUpdatedLabel: remoteSyncedAt
      ? formatTimeLabel(remoteSyncedAt)
      : remoteCount
        ? "云端已有备份"
        : "暂无云端备份",
  };
}

function buildCloudReadyState(basePatch = {}) {
  return {
    mode: "cloud",
    modeLabel: "云端同步已开启",
    statusTag: "已识别",
    tone: "cloud",
    ...basePatch,
  };
}

function buildErrorState(statusCopy, extraPatch = {}) {
  return {
    ...buildCloudReadyState({
      actionLabel: "重试同步",
      mode: "error",
      modeLabel: "云端待重连",
      statusCopy,
      statusTag: "异常",
      tone: "error",
      ...extraPatch,
    }),
  };
}

function getCloudFailureCopy(recognizedCopy, unrecognizedCopy) {
  return isRecognizedAccount() ? recognizedCopy : unrecognizedCopy;
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

async function pullRemoteSnapshot() {
  const pullResult = await pullCloudHistorySnapshot();

  if (pullResult.ok) {
    return pullResult;
  }

  return null;
}

function buildPullFailedResult(localHistory, statusCopy) {
  const nextAccountState = updateAccountSnapshot(
    buildErrorState(
      statusCopy ||
        getCloudFailureCopy(
          "账号已经识别成功，但刚刚没拉到云端记录。你可以稍后再试一次同步。",
          "云环境已经接上，但账号静默识别还没完成，或者云函数还没部署成功。先检查云函数部署和账号权限。"
        )
    )
  );

  return buildResult(nextAccountState, localHistory, {
    ok: false,
  });
}

async function inspectCloudState(snapshot, reason) {
  const latestHistory = getHistory();
  const syncPreferences = getSyncPreferences();
  const pullResult = await pullRemoteSnapshot();

  if (!pullResult) {
    return buildPullFailedResult(
      latestHistory,
      getCloudFailureCopy(
        "账号已经识别成功，但这次读取云端状态没有成功。",
        "云环境已经接上，但还没拿到可用账号态。大概率是云函数还没部署成功，或者当前微信号没有这个小程序的开发权限。"
      )
    );
  }

  const remoteHistory = pullResult.history;
  const remoteCount = pullResult.count || remoteHistory.length;
  let statusCopy = "云端状态已更新。";

  if (syncPreferences.suppressAutoPull && !latestHistory.length) {
    statusCopy = remoteCount
      ? `本机记录已清空，云端还保留 ${remoteCount} 条。需要时可手动拉回。`
      : "本机记录已清空，云端也没有可拉回的备份。";
  } else if (syncPreferences.suppressAutoPush && latestHistory.length) {
    statusCopy = remoteCount
      ? `云端当前有 ${remoteCount} 条，本机仍保留 ${latestHistory.length} 条，但自动恢复上传已关闭。要重新备份，请手动点“恢复云端备份”。`
      : `云端备份当前保持清空状态。本机仍保留 ${latestHistory.length} 条，只有手动点“恢复云端备份”才会重新上传。`;
  } else if (reason === "profile-open" && !latestHistory.length && remoteCount) {
    statusCopy = `云端检测到 ${remoteCount} 条备份，准备按当前设备策略处理。`;
  }

  const nextAccountState = updateAccountSnapshot({
    ...buildCloudReadyState({
      ...buildCloudMetaPatch(remoteHistory, pullResult.syncedAt, syncPreferences, latestHistory),
      statusCopy,
    }),
  });

  return buildResult(nextAccountState, latestHistory, {
    ok: true,
    remoteCount,
    skipped: true,
    syncedAt: pullResult.syncedAt || 0,
  });
}

async function pullCloudHistoryToDevice(snapshot, options = {}) {
  const pullResult = await pullRemoteSnapshot();
  const latestHistory = getHistory();

  if (!pullResult) {
    return buildPullFailedResult(
      latestHistory,
      getCloudFailureCopy(
        "云端状态读取失败，这次还没法把历史拉回本机。",
        "云环境已经接上，但账号静默识别还没完成，所以这次还没法把历史拉回本机。先检查云函数部署和开发者权限。"
      )
    );
  }

  const remoteHistory = pullResult.history;
  const remoteCount = pullResult.count || remoteHistory.length;
  const syncedAt = pullResult.syncedAt || Date.now();
  const syncPreferences = clearAutoPullSuppression();

  if (!remoteCount) {
    const nextAccountState = updateAccountSnapshot({
      ...buildCloudReadyState({
        ...buildCloudMetaPatch([], 0, syncPreferences, latestHistory),
        statusCopy: "云端目前没有可拉回的历史记录。",
      }),
    });

    return buildResult(nextAccountState, latestHistory, {
      ok: true,
      remoteCount: 0,
      skipped: true,
      syncedAt: 0,
    });
  }

  const shouldReplaceLocal = (options.replaceLocal || !snapshot.history.length) && !latestHistory.length;
  const pulledHistory = shouldReplaceLocal
    ? remoteHistory
    : combineHistory(latestHistory, remoteHistory);
  const syncedHistory = markHistoryEntriesSynced(getHistoryIds(remoteHistory), syncedAt, pulledHistory);
  const nextAccountState = updateAccountSnapshot({
    ...buildCloudReadyState({
      ...buildCloudMetaPatch(remoteHistory, syncedAt, syncPreferences, syncedHistory),
      actionLabel: syncPreferences.suppressAutoPush && syncedHistory.length ? "恢复云端备份" : "立即同步",
      lastSyncedAt: syncedAt,
      lastSyncedLabel: formatTimeLabel(syncedAt),
      statusCopy: `已从云端拉回 ${remoteCount} 条记录，现在这台设备也接上了自己的历史。`,
    }),
  });

  return buildResult(nextAccountState, syncedHistory, {
    ok: true,
    remoteCount,
    syncedAt,
  });
}

async function clearRemoteHistory(snapshot) {
  const clearResult = await clearCloudHistorySnapshot();
  const latestHistory = getHistory();

  if (!clearResult.ok) {
    const nextAccountState = updateAccountSnapshot(
      buildErrorState("云端清空没有成功，本机记录还在，可以稍后再试。")
    );

    return buildResult(nextAccountState, latestHistory, {
      ok: false,
    });
  }

  const syncPreferences = updateSyncPreferences({
    suppressAutoPull: false,
    suppressAutoPush: true,
  });
  const localOnlyHistory = latestHistory.length ? markHistoryLocalOnly(latestHistory) : [];
  const syncedAt = clearResult.syncedAt || Date.now();
  const nextAccountState = updateAccountSnapshot({
    ...buildCloudReadyState({
      ...buildCloudMetaPatch([], syncedAt, syncPreferences, localOnlyHistory),
      actionLabel: localOnlyHistory.length ? "恢复云端备份" : "立即同步",
      lastSyncedAt: syncedAt,
      lastSyncedLabel: formatTimeLabel(syncedAt),
      statusCopy: localOnlyHistory.length
        ? `云端记录已清空，本机仍保留 ${localOnlyHistory.length} 条。现在只有你手动点“恢复云端备份”，这些记录才会重新上传。`
        : "云端记录已清空，这个账号当前没有备份历史了。",
    }),
  });

  return buildResult(nextAccountState, localOnlyHistory, {
    ok: true,
    remoteCount: 0,
    syncedAt,
  });
}

async function syncHistory(snapshot, options = {}) {
  let syncPreferences = getSyncPreferences();
  const allowUploadRestore = !!options.forceUploadRestore || options.reason === "manual-sync";
  const pullResult = await pullRemoteSnapshot();

  if (!pullResult) {
    return buildPullFailedResult(
      getHistory(),
      getCloudFailureCopy(
        "账号已经识别成功，但刚刚没拉到云端记录。你可以稍后再试一次同步。",
        "云环境已经接上，但当前还没拿到稳定账号态，所以暂时不能同步。先检查云函数部署和开发者权限。"
      )
    );
  }

  const remoteHistory = pullResult.history;
  const remoteCount = pullResult.count || remoteHistory.length;

  if (syncPreferences.suppressAutoPush && !allowUploadRestore) {
    const latestHistory = getHistory();
    const nextAccountState = updateAccountSnapshot({
      ...buildCloudReadyState({
        ...buildCloudMetaPatch(remoteHistory, pullResult.syncedAt, syncPreferences, latestHistory),
        statusCopy: latestHistory.length
          ? `云端备份当前保持清空状态。本机仍保留 ${latestHistory.length} 条，只有手动点“恢复云端备份”才会重新上传。`
          : remoteCount
            ? "云端当前已有备份，但自动恢复上传仍处于关闭状态。"
            : "云端当前保持清空状态，等你手动恢复备份后才会重新上传。",
      }),
    });

    return buildResult(nextAccountState, latestHistory, {
      ok: true,
      remoteCount,
      skipped: true,
      syncedAt: pullResult.syncedAt || 0,
    });
  }

  if (syncPreferences.suppressAutoPush && allowUploadRestore) {
    syncPreferences = clearAutoPushSuppression();
  }

  if (!snapshot.history.length && remoteCount && !syncPreferences.suppressAutoPull) {
    return pullCloudHistoryToDevice(snapshot, {
      replaceLocal: true,
    });
  }

  const mergedForCloud = combineHistory(snapshot.history, remoteHistory);
  const pushResult = await pushCloudHistorySnapshot(serializeHistory(mergedForCloud));
  const latestHistory = getHistory();
  const attemptedIds = getHistoryIds(mergedForCloud);

  if (!pushResult.ok) {
    const failureBaseHistory = syncPreferences.suppressAutoPull
      ? latestHistory
      : combineHistory(latestHistory, remoteHistory);
    const failedHistory = markHistoryEntriesFailed(attemptedIds, failureBaseHistory);
    const nextAccountState = updateAccountSnapshot({
      ...buildErrorState("云端记录读到了，但这次回写失败。本机记录还在，可以稍后再试。", {
        ...buildCloudMetaPatch(remoteHistory, pullResult.syncedAt, syncPreferences, failedHistory),
      }),
    });

    return buildResult(nextAccountState, failedHistory, {
      ok: false,
    });
  }

  const syncedAt = pushResult.syncedAt || Date.now();
  const displayHistory = syncPreferences.suppressAutoPull
    ? latestHistory
    : combineHistory(latestHistory, mergedForCloud);
  const syncedHistory = markHistoryEntriesSynced(attemptedIds, syncedAt, displayHistory);
  const latestWasChanged = hasHistoryChanged(snapshot.fingerprint);
  const hiddenRemoteCount = mergedForCloud.length - syncedHistory.length;
  let statusCopy = "最新记录已经和云端对齐，换设备后也更容易接回自己的历史。";

  if (syncPreferences.suppressAutoPull && hiddenRemoteCount > 0) {
    statusCopy = `本机保持当前记录视图，云端还保留 ${mergedForCloud.length} 条。需要时可手动拉回。`;
  } else if (latestWasChanged) {
    statusCopy = "同步过程中本机又新增了记录，这一轮先保住新内容，后续排队同步会继续把它们补上云端。";
  } else if (allowUploadRestore) {
    statusCopy = "云端备份已恢复，现在本机记录会重新自动同步到云端。";
  } else if (options.reason === "profile-open") {
    statusCopy = `已静默识别当前微信身份，并同步了 ${syncedHistory.length} 条记录。`;
  }

  const nextAccountState = updateAccountSnapshot({
    ...buildCloudReadyState({
      ...buildCloudMetaPatch(mergedForCloud, syncedAt, syncPreferences, syncedHistory),
      actionLabel: syncPreferences.suppressAutoPull && hiddenRemoteCount > 0 ? "从云端拉回" : "立即同步",
      lastSyncedAt: syncedAt,
      lastSyncedLabel: formatTimeLabel(syncedAt),
      statusCopy,
    }),
  });

  return buildResult(nextAccountState, syncedHistory, {
    ok: true,
    remoteCount: mergedForCloud.length,
    syncedAt,
  });
}

async function runHistorySync(options = {}) {
  const mode = options.mode || "sync";
  const accountState = await ensureAccountSnapshot(!!options.forceRefreshAccount);
  const snapshot = getHistorySnapshot();

  if (!accountState.canSync) {
    return buildResult(accountState, snapshot.history, {
      ok: false,
      skipped: true,
    });
  }

  if (mode === "inspect") {
    return inspectCloudState(snapshot, options.reason || "inspect");
  }

  if (mode === "pull") {
    return pullCloudHistoryToDevice(snapshot, {
      replaceLocal: !!options.replaceLocal,
    });
  }

  if (mode === "clear-remote") {
    return clearRemoteHistory(snapshot);
  }

  return syncHistory(snapshot, options);
}

function requestHistorySync(options = {}) {
  const runTask = async () => {
    try {
      return await runHistorySync(options);
    } catch (error) {
      const history = getHistory();
      const accountState = updateAccountSnapshot(
        buildErrorState("同步过程中出现了意外错误，当前本机记录还在，可以稍后再试一次。")
      );

      return buildResult(accountState, history, {
        ok: false,
      });
    }
  };

  const nextPromise = syncQueue.then(runTask, runTask);
  syncQueue = nextPromise.catch(() => {});

  return nextPromise;
}

function clearLocalHistoryOnly() {
  const nextPreferences = updateSyncPreferences({
    lastLocalClearAt: Date.now(),
    suppressAutoPull: true,
  });

  clearHistory();

  const emptyHistory = getHistory();
  const accountState = updateAccountSnapshot({
    actionLabel: "从云端拉回",
    autoPullBlocked: true,
    statusCopy: "本机记录已清空，云端如果还有备份，不会自动回灌，只有你主动点“从云端拉回”才会回来。",
  });

  return buildResult(accountState, emptyHistory, {
    ok: true,
    skipped: true,
    syncPreferences: nextPreferences,
  });
}

module.exports = {
  clearLocalHistoryOnly,
  getAccountSnapshot,
  getSyncPreferences,
  requestHistorySync,
};
