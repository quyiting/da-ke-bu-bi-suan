const STORAGE_KEY = "fortune-history";

const TYPE_LABELS = {
  chart: "星盘",
  draw: "抽签",
  yao: "六爻",
};
const SYNC_STATUS_META = {
  failed: {
    label: "同步失败",
    tone: "failed",
  },
  local: {
    label: "待同步",
    tone: "local",
  },
  synced: {
    label: "已同步",
    tone: "synced",
  },
};
const REVIEW_STATUS_META = {
  matched: {
    label: "已应",
    tone: "matched",
  },
  partial: {
    label: "部分应",
    tone: "partial",
  },
  pending: {
    label: "待回看",
    tone: "pending",
  },
  unmet: {
    label: "暂未应",
    tone: "unmet",
  },
};

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatRecordTime(timestamp) {
  const date = new Date(timestamp);

  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getReviewMeta(status = "pending") {
  return REVIEW_STATUS_META[status] || REVIEW_STATUS_META.pending;
}

function getSyncMeta(status = "local") {
  return SYNC_STATUS_META[status] || SYNC_STATUS_META.local;
}

function decorateEntry(entry) {
  const safeEntry = entry || {};
  const isYao = safeEntry.type === "yao";
  const reviewStatus = isYao ? safeEntry.reviewStatus || "pending" : safeEntry.reviewStatus || "";
  const reviewMeta = isYao ? getReviewMeta(reviewStatus) : null;
  const syncStatus = safeEntry.syncStatus || "local";
  const syncMeta = getSyncMeta(syncStatus);
  const createdAt = safeEntry.createdAt || Date.now();
  const updatedAt = safeEntry.updatedAt || createdAt;
  const syncedAt = safeEntry.syncedAt || 0;

  return {
    ...safeEntry,
    createdAt,
    dateLabel: safeEntry.dateLabel || formatRecordTime(createdAt),
    question: safeEntry.question || "",
    questionGuideLabel: safeEntry.questionGuideLabel || "",
    reviewLabel: reviewMeta ? reviewMeta.label : "",
    reviewStatus,
    reviewTone: reviewMeta ? reviewMeta.tone : "",
    reviewUpdatedLabel: safeEntry.reviewUpdatedAt ? formatRecordTime(safeEntry.reviewUpdatedAt) : "",
    syncLabel: syncMeta.label,
    syncStatus,
    syncTone: syncMeta.tone,
    syncedAt,
    syncedLabel: syncedAt ? formatRecordTime(syncedAt) : "",
    timingPreview: safeEntry.timingPreview || "",
    topicLabel: safeEntry.topicLabel || "",
    updatedAt,
  };
}

function getHistory() {
  const history = wx.getStorageSync(STORAGE_KEY);

  return Array.isArray(history) ? history.map((item) => decorateEntry(item)) : [];
}

function createHistoryEntry(type, payload) {
  const now = Date.now();

  return decorateEntry({
    id: `${now}-${Math.floor(Math.random() * 1000)}`,
    type,
    typeLabel: TYPE_LABELS[type] || "记录",
    title: payload.title,
    subtitle: payload.subtitle || "",
    summary: payload.summary || "",
    badge: payload.badge || "",
    createdAt: now,
    question: payload.question || "",
    questionGuideLabel: payload.questionGuideLabel || "",
    reviewStatus: type === "yao" ? payload.reviewStatus || "pending" : payload.reviewStatus || "",
    reviewUpdatedAt: payload.reviewUpdatedAt || 0,
    syncedAt: payload.syncedAt || 0,
    syncStatus: payload.syncStatus || "local",
    timingPreview: payload.timingPreview || "",
    topicLabel: payload.topicLabel || "",
    updatedAt: payload.updatedAt || now,
  });
}

function replaceHistory(history) {
  const nextHistory = (Array.isArray(history) ? history : [])
    .map((item) => decorateEntry(item))
    .sort((left, right) => {
      const leftTime = left.updatedAt || left.createdAt || 0;
      const rightTime = right.updatedAt || right.createdAt || 0;

      return rightTime - leftTime;
    })
    .slice(0, 20);

  wx.setStorageSync(STORAGE_KEY, nextHistory);

  return nextHistory;
}

function addHistory(entry) {
  const nextEntry = decorateEntry({
    ...entry,
    syncedAt: entry && entry.syncStatus === "synced" ? entry.syncedAt || Date.now() : 0,
    syncStatus: entry && entry.syncStatus ? entry.syncStatus : "local",
    updatedAt: Date.now(),
  });

  return replaceHistory([nextEntry].concat(getHistory()));
}

function updateHistoryEntry(entryId, updates) {
  const history = getHistory();
  let updatedEntry = null;
  const nextHistory = history.map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }

    const patch = typeof updates === "function" ? updates(entry) : updates;
    const nextUpdatedAt = patch && patch.updatedAt ? patch.updatedAt : Date.now();
    const nextSyncStatus = patch && patch.syncStatus ? patch.syncStatus : "local";
    updatedEntry = decorateEntry({
      ...entry,
      ...patch,
      syncedAt:
        patch && Object.prototype.hasOwnProperty.call(patch, "syncedAt")
          ? patch.syncedAt
          : nextSyncStatus === "synced"
            ? entry.syncedAt || Date.now()
            : 0,
      syncStatus: nextSyncStatus,
      updatedAt: nextUpdatedAt,
    });

    return updatedEntry;
  });

  replaceHistory(nextHistory);

  return updatedEntry;
}

function clearHistory() {
  wx.setStorageSync(STORAGE_KEY, []);
}

function pickNewerEntry(currentEntry, candidateEntry) {
  const currentTime = currentEntry.updatedAt || currentEntry.syncedAt || currentEntry.createdAt || 0;
  const candidateTime = candidateEntry.updatedAt || candidateEntry.syncedAt || candidateEntry.createdAt || 0;

  if (candidateTime > currentTime) {
    return candidateEntry;
  }

  if (candidateTime < currentTime) {
    return currentEntry;
  }

  if (candidateEntry.syncStatus === "synced" && currentEntry.syncStatus !== "synced") {
    return candidateEntry;
  }

  if (candidateEntry.reviewUpdatedAt > currentEntry.reviewUpdatedAt) {
    return candidateEntry;
  }

  return currentEntry;
}

function combineHistory(localHistory = getHistory(), remoteHistory = []) {
  const combinedMap = {};
  const combinedEntries = []
    .concat(Array.isArray(localHistory) ? localHistory : [])
    .concat(Array.isArray(remoteHistory) ? remoteHistory : []);

  combinedEntries.forEach((entry) => {
    const decoratedEntry = decorateEntry(entry);

    if (!decoratedEntry.id) {
      return;
    }

    const currentEntry = combinedMap[decoratedEntry.id];
    combinedMap[decoratedEntry.id] = currentEntry
      ? pickNewerEntry(currentEntry, decoratedEntry)
      : decoratedEntry;
  });

  return Object.keys(combinedMap)
    .map((key) => combinedMap[key])
    .sort((left, right) => {
      const leftTime = left.updatedAt || left.createdAt || 0;
      const rightTime = right.updatedAt || right.createdAt || 0;

      return rightTime - leftTime;
    })
    .slice(0, 20);
}

function mergeHistory(localHistory = getHistory(), remoteHistory = []) {
  return replaceHistory(combineHistory(localHistory, remoteHistory));
}

function markHistorySynced(sourceHistory = getHistory(), syncedAt = Date.now()) {
  return replaceHistory(
    sourceHistory.map((entry) => ({
      ...entry,
      syncedAt,
      syncStatus: "synced",
    }))
  );
}

function markHistoryEntriesSynced(entryIds = [], syncedAt = Date.now(), sourceHistory = getHistory()) {
  const entryIdSet = new Set(Array.isArray(entryIds) ? entryIds : []);

  return replaceHistory(
    sourceHistory.map((entry) => {
      if (!entryIdSet.has(entry.id)) {
        return entry;
      }

      return {
        ...entry,
        syncedAt,
        syncStatus: "synced",
      };
    })
  );
}

function markHistorySyncFailed(sourceHistory = getHistory()) {
  return replaceHistory(
    sourceHistory.map((entry) => {
      if (entry.syncStatus === "synced") {
        return entry;
      }

      return {
        ...entry,
        syncStatus: "failed",
      };
    })
  );
}

function markHistoryEntriesFailed(entryIds = [], sourceHistory = getHistory()) {
  const entryIdSet = new Set(Array.isArray(entryIds) ? entryIds : []);

  return replaceHistory(
    sourceHistory.map((entry) => {
      if (!entryIdSet.has(entry.id) || entry.syncStatus === "synced") {
        return entry;
      }

      return {
        ...entry,
        syncStatus: "failed",
      };
    })
  );
}

function markHistoryLocalOnly(sourceHistory = getHistory()) {
  return replaceHistory(
    sourceHistory.map((entry) => ({
      ...entry,
      syncedAt: 0,
      syncStatus: "local",
    }))
  );
}

function summarizeHistory(history = getHistory()) {
  const safeHistory = Array.isArray(history) ? history : [];
  const drawCount = safeHistory.filter((item) => item.type === "draw").length;
  const chartCount = safeHistory.filter((item) => item.type === "chart").length;
  const yaoCount = safeHistory.filter((item) => item.type === "yao").length;
  const pendingReviewCount = safeHistory.filter(
    (item) => item.type === "yao" && item.reviewStatus === "pending"
  ).length;
  const pendingSyncCount = safeHistory.filter((item) => item.syncStatus !== "synced").length;
  const partialReviewCount = safeHistory.filter(
    (item) => item.type === "yao" && item.reviewStatus === "partial"
  ).length;
  const failedSyncCount = safeHistory.filter((item) => item.syncStatus === "failed").length;
  const matchedReviewCount = safeHistory.filter(
    (item) => item.type === "yao" && item.reviewStatus === "matched"
  ).length;
  const syncedCount = safeHistory.filter((item) => item.syncStatus === "synced").length;
  const unmetReviewCount = safeHistory.filter(
    (item) => item.type === "yao" && item.reviewStatus === "unmet"
  ).length;
  const total = safeHistory.length;
  const exploreDays = new Set(
    safeHistory.map((item) => getDateKey(new Date(item.createdAt || Date.now())))
  ).size;
  const todayKey = getDateKey(new Date());
  const todayCount = safeHistory.filter(
    (item) => getDateKey(new Date(item.createdAt || Date.now())) === todayKey
  ).length;
  const lastSyncedAt = safeHistory.reduce((maxValue, item) => Math.max(maxValue, item.syncedAt || 0), 0);

  let favoriteType = "balanced";
  let favoriteTypeLabel = "两边都在看";
  const typedCounts = [
    { type: "draw", label: "更常问签", count: drawCount },
    { type: "yao", label: "更常起六爻", count: yaoCount },
    { type: "chart", label: "更常看星盘", count: chartCount },
  ].sort((left, right) => right.count - left.count);

  if (!total) {
    favoriteType = "none";
    favoriteTypeLabel = "还没形成偏好";
  } else if (typedCounts[0].count > typedCounts[1].count) {
    favoriteType = typedCounts[0].type;
    favoriteTypeLabel = typedCounts[0].label;
  }

  let nextSuggestion = "先从一支主题签开始，最容易得到第一条记录。";

  if (pendingReviewCount) {
    nextSuggestion = `你还有 ${pendingReviewCount} 条六爻在等回访，过几天回来对照“已应 / 部分应 / 暂未应”，产品会更像真的陪你复盘。`;
  } else if (favoriteType === "draw") {
    nextSuggestion = "你最近更偏向问签收提醒，这时候补一卦六爻，会更适合判断“这件事到底该不该动”。";
  } else if (favoriteType === "yao") {
    nextSuggestion = "你最近更偏向起卦做判断，这时候补一支主题签，会让体验多一点情绪安放和分享感。";
  } else if (favoriteType === "chart") {
    nextSuggestion = "你已经开始形成个人报告型使用习惯了，接下来适合把星盘、六爻和抽签串起来做更完整的内容链路。";
  } else if (favoriteType === "balanced" && total) {
    nextSuggestion = "记录已经比较均衡了，下一步适合回看最近在反复问什么，做更深的复盘。";
  }

  return {
    chartCount,
    drawCount,
    exploreDays,
    favoriteType,
    favoriteTypeLabel,
    lastUpdated: safeHistory[0] ? safeHistory[0].dateLabel : "暂无记录",
    lastSyncedAt,
    lastSyncedLabel: lastSyncedAt ? formatRecordTime(lastSyncedAt) : "尚未同步",
    matchedReviewCount,
    nextSuggestion,
    failedSyncCount,
    partialReviewCount,
    pendingReviewCount,
    pendingSyncCount,
    syncedCount,
    todayCount,
    total,
    unmetReviewCount,
    yaoCount,
  };
}

module.exports = {
  addHistory,
  clearHistory,
  combineHistory,
  createHistoryEntry,
  getReviewMeta,
  getSyncMeta,
  getHistory,
  markHistoryEntriesFailed,
  markHistoryEntriesSynced,
  markHistoryLocalOnly,
  markHistorySyncFailed,
  markHistorySynced,
  mergeHistory,
  replaceHistory,
  summarizeHistory,
  updateHistoryEntry,
};
