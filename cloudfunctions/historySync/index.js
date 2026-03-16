const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const SNAPSHOT_COLLECTION = "fortune_history_snapshots";
const MAX_HISTORY_COUNT = 40;

function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((item) => item && item.id && item.type)
    .map((item) => ({
      badge: item.badge || "",
      createdAt: item.createdAt || 0,
      id: item.id,
      question: item.question || "",
      questionGuideLabel: item.questionGuideLabel || "",
      reviewStatus: item.reviewStatus || "",
      reviewUpdatedAt: item.reviewUpdatedAt || 0,
      subtitle: item.subtitle || "",
      summary: item.summary || "",
      syncedAt: item.syncedAt || 0,
      syncStatus: item.syncStatus || "local",
      timingPreview: item.timingPreview || "",
      title: item.title || "",
      topicLabel: item.topicLabel || "",
      type: item.type,
      typeLabel: item.typeLabel || "",
      updatedAt: item.updatedAt || item.createdAt || 0,
    }))
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .slice(0, MAX_HISTORY_COUNT);
}

async function pullSnapshot(openid) {
  try {
    const snapshot = await db.collection(SNAPSHOT_COLLECTION).doc(openid).get();
    const history = sanitizeHistory(snapshot.data && snapshot.data.history);

    return {
      count: history.length,
      history,
      ok: true,
      syncedAt: (snapshot.data && snapshot.data.syncedAt) || 0,
    };
  } catch (error) {
    if (error && error.errCode === -502005) {
      return {
        count: 0,
        history: [],
        ok: true,
        syncedAt: 0,
      };
    }

    throw error;
  }
}

async function pushSnapshot(openid, history) {
  const now = Date.now();
  const safeHistory = sanitizeHistory(history).map((entry) => ({
    ...entry,
    syncedAt: now,
    syncStatus: "synced",
  }));

  await db.collection(SNAPSHOT_COLLECTION).doc(openid).set({
    data: {
      count: safeHistory.length,
      history: safeHistory,
      syncedAt: now,
      updatedAt: now,
    },
  });

  return {
    count: safeHistory.length,
    ok: true,
    syncedAt: now,
  };
}

async function clearSnapshot(openid) {
  const now = Date.now();

  await db.collection(SNAPSHOT_COLLECTION).doc(openid).set({
    data: {
      clearedAt: now,
      count: 0,
      history: [],
      syncedAt: now,
      updatedAt: now,
    },
  });

  return {
    count: 0,
    ok: true,
    syncedAt: now,
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event && event.action ? event.action : "pull";

  if (action === "pull") {
    return pullSnapshot(OPENID);
  }

  if (action === "push") {
    return pushSnapshot(OPENID, event.history);
  }

  if (action === "clear") {
    return clearSnapshot(OPENID);
  }

  return {
    errorMessage: "unsupported action",
    ok: false,
  };
};
