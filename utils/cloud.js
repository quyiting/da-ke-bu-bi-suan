const DEFAULT_ACCOUNT_STATE = {
  actionLabel: "仅本地保存",
  autoPullBlocked: false,
  autoPushBlocked: false,
  canSync: false,
  cloudEnvLabel: "未启用",
  cloudHistoryCount: 0,
  cloudHistoryLabel: "未启用",
  cloudUpdatedAt: 0,
  cloudUpdatedLabel: "未启用云端备份",
  isConfigured: false,
  lastSyncedAt: 0,
  lastSyncedLabel: "仅本地保存",
  mode: "local",
  modeLabel: "本地存储",
  statusCopy: "记录只保存在当前设备，不会上传到云端。",
  statusTag: "本地",
  tone: "local",
  userLabel: "当前设备",
};

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatTimeLabel(timestamp) {
  if (!timestamp) {
    return "仅本地保存";
  }

  const date = new Date(timestamp);

  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildAccountState(overrides = {}) {
  const hasCloudUpdatedAt = Object.prototype.hasOwnProperty.call(overrides, "cloudUpdatedAt");
  const hasLastSyncedAt = Object.prototype.hasOwnProperty.call(overrides, "lastSyncedAt");

  return {
    ...DEFAULT_ACCOUNT_STATE,
    ...overrides,
    cloudHistoryLabel:
      overrides.cloudHistoryLabel ||
      (typeof overrides.cloudHistoryCount === "number" && overrides.cloudHistoryCount > 0
        ? `云端 ${overrides.cloudHistoryCount} 条`
        : DEFAULT_ACCOUNT_STATE.cloudHistoryLabel),
    cloudUpdatedLabel:
      overrides.cloudUpdatedLabel ||
      (hasCloudUpdatedAt
        ? overrides.cloudUpdatedAt
          ? formatTimeLabel(overrides.cloudUpdatedAt)
          : DEFAULT_ACCOUNT_STATE.cloudUpdatedLabel
        : DEFAULT_ACCOUNT_STATE.cloudUpdatedLabel),
    lastSyncedLabel:
      overrides.lastSyncedLabel ||
      (hasLastSyncedAt
        ? overrides.lastSyncedAt
          ? formatTimeLabel(overrides.lastSyncedAt)
          : DEFAULT_ACCOUNT_STATE.lastSyncedLabel
        : DEFAULT_ACCOUNT_STATE.lastSyncedLabel),
  };
}

function buildLocalAccountState(statusCopy, overrides = {}) {
  return buildAccountState({
    statusCopy: statusCopy || DEFAULT_ACCOUNT_STATE.statusCopy,
    ...overrides,
  });
}

async function bootstrapCloudAccount() {
  return buildLocalAccountState();
}

function getCloudEnvId() {
  return "";
}

function initCloud() {
  return {
    ok: false,
    accountState: buildLocalAccountState(),
  };
}

function isCloudConfigured() {
  return false;
}

async function pullCloudHistorySnapshot() {
  return {
    count: 0,
    history: [],
    ok: false,
    reason: "local-storage-only",
    syncedAt: 0,
  };
}

async function pushCloudHistorySnapshot() {
  return {
    count: 0,
    ok: false,
    reason: "local-storage-only",
    syncedAt: 0,
  };
}

async function clearCloudHistorySnapshot() {
  return {
    count: 0,
    ok: false,
    reason: "local-storage-only",
    syncedAt: 0,
  };
}

module.exports = {
  bootstrapCloudAccount,
  buildAccountState,
  buildLocalAccountState,
  clearCloudHistorySnapshot,
  formatTimeLabel,
  getCloudEnvId,
  initCloud,
  isCloudConfigured,
  pullCloudHistorySnapshot,
  pushCloudHistorySnapshot,
};
