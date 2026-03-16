const CLOUD_ENV_ID = "dkbbs-3gpzzqsrd4d2b8e2";
const CLOUD_ENV_PLACEHOLDER = "replace-with-your-cloud-env-id";

const DEFAULT_ACCOUNT_STATE = {
  actionLabel: "等待配置",
  autoPullBlocked: false,
  autoPushBlocked: false,
  canSync: false,
  cloudEnvLabel: "云环境未配置",
  cloudHistoryCount: 0,
  cloudHistoryLabel: "云端 0 条",
  cloudUpdatedAt: 0,
  cloudUpdatedLabel: "暂无云端备份",
  isConfigured: false,
  lastSyncedAt: 0,
  lastSyncedLabel: "尚未同步",
  mode: "local",
  modeLabel: "本地模式",
  statusCopy: "当前只保存在本机。填好云开发环境后，就能静默识别并自动同步历史记录。",
  statusTag: "本地",
  tone: "local",
  userLabel: "未识别",
};

let hasInitialized = false;

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatTimeLabel(timestamp) {
  if (!timestamp) {
    return "尚未同步";
  }

  const date = new Date(timestamp);

  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function maskOpenId(openid = "") {
  if (!openid) {
    return "未识别";
  }

  if (openid.length <= 10) {
    return openid;
  }

  return `${openid.slice(0, 6)}...${openid.slice(-4)}`;
}

function maskEnvId(envId = "") {
  if (!envId) {
    return "云环境未配置";
  }

  if (envId.length <= 12) {
    return envId;
  }

  return `${envId.slice(0, 8)}...${envId.slice(-4)}`;
}

function getCloudEnvId() {
  return `${CLOUD_ENV_ID || ""}`.trim();
}

function isCloudConfigured() {
  const envId = getCloudEnvId();

  return !!envId && envId !== CLOUD_ENV_PLACEHOLDER;
}

function canUseCloudSdk() {
  return typeof wx !== "undefined" && !!wx.cloud;
}

function buildAccountState(overrides = {}) {
  const hasCloudUpdatedAt = Object.prototype.hasOwnProperty.call(overrides, "cloudUpdatedAt");
  const hasLastSyncedAt = Object.prototype.hasOwnProperty.call(overrides, "lastSyncedAt");

  return {
    ...DEFAULT_ACCOUNT_STATE,
    ...overrides,
    cloudEnvLabel: overrides.cloudEnvLabel || DEFAULT_ACCOUNT_STATE.cloudEnvLabel,
    cloudHistoryLabel:
      overrides.cloudHistoryLabel ||
      (typeof overrides.cloudHistoryCount === "number"
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
      (hasLastSyncedAt ? formatTimeLabel(overrides.lastSyncedAt || 0) : DEFAULT_ACCOUNT_STATE.lastSyncedLabel),
  };
}

function buildLocalAccountState(statusCopy) {
  if (!canUseCloudSdk()) {
    return buildAccountState({
      statusCopy: statusCopy || "当前环境还没有可用的云开发能力，先继续使用本机记录。",
    });
  }

  if (!isCloudConfigured()) {
    return buildAccountState({
      cloudEnvLabel: "云环境未配置",
      cloudHistoryLabel: "云端 0 条",
      cloudUpdatedLabel: "暂无云端备份",
      statusCopy:
        statusCopy || "还没填写云开发环境 ID，当前继续使用本地模式。配好后会自动启用静默识别和云端同步。",
    });
  }

  return buildAccountState({
    actionLabel: "重试同步",
    autoPullBlocked: false,
    autoPushBlocked: false,
    canSync: true,
    cloudEnvLabel: `云环境 ${maskEnvId(getCloudEnvId())}`,
    cloudHistoryLabel: "云端状态待确认",
    cloudUpdatedLabel: "等待拉取云端信息",
    isConfigured: true,
    mode: "error",
    modeLabel: "云端待重连",
    statusCopy: statusCopy || "云开发已配置，但这次初始化没有成功。稍后可以再试一次同步。",
    statusTag: "异常",
    tone: "error",
  });
}

function initCloud() {
  if (!canUseCloudSdk()) {
    return {
      ok: false,
      accountState: buildLocalAccountState(),
    };
  }

  if (!isCloudConfigured()) {
    return {
      ok: false,
      accountState: buildLocalAccountState(),
    };
  }

  if (!hasInitialized) {
    wx.cloud.init({
      env: getCloudEnvId(),
      traceUser: true,
    });
    hasInitialized = true;
  }

  return {
    ok: true,
    envId: getCloudEnvId(),
  };
}

function callCloudFunction(name, data = {}) {
  const initResult = initCloud();

  if (!initResult.ok) {
    return Promise.resolve({
      ok: false,
      accountState: initResult.accountState,
      reason: "cloud-unavailable",
    });
  }

  return new Promise((resolve) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (response) => {
        resolve({
          ok: true,
          result: response.result || {},
        });
      },
      fail: (error) => {
        resolve({
          ok: false,
          accountState: buildLocalAccountState("云端服务暂时不可用，先继续使用本机记录。"),
          error,
          reason: "cloud-call-failed",
        });
      },
    });
  });
}

async function bootstrapCloudAccount() {
  const initResult = initCloud();

  if (!initResult.ok) {
    return initResult.accountState;
  }

  const response = await callCloudFunction("account", {
    action: "bootstrap",
    appName: "大可不必算",
  });

  if (!response.ok) {
    return response.accountState || buildLocalAccountState("静默识别没有完成，当前先保留在本机模式。");
  }

  const result = response.result || {};
  const lastSyncedAt = result.lastSyncedAt || 0;

  return buildAccountState({
    actionLabel: "立即同步",
    autoPullBlocked: false,
    autoPushBlocked: false,
    canSync: true,
    cloudEnvLabel: `云环境 ${maskEnvId(initResult.envId)}`,
    cloudHistoryCount: 0,
    cloudHistoryLabel: "云端 0 条",
    cloudUpdatedAt: lastSyncedAt,
    cloudUpdatedLabel: lastSyncedAt ? formatTimeLabel(lastSyncedAt) : "暂无云端备份",
    isConfigured: true,
    lastSyncedAt,
    lastSyncedLabel: formatTimeLabel(lastSyncedAt),
    mode: "cloud",
    modeLabel: "云端同步已开启",
    statusCopy: "已静默识别当前微信身份，新的记录会优先保存在本机，再尝试同步到云端。",
    statusTag: "已识别",
    tone: "cloud",
    userLabel: maskOpenId(result.openid),
  });
}

async function pullCloudHistorySnapshot() {
  const response = await callCloudFunction("historySync", {
    action: "pull",
  });

  if (!response.ok) {
    return response;
  }

  return {
    count: response.result.count || 0,
    history: Array.isArray(response.result.history) ? response.result.history : [],
    ok: true,
    syncedAt: response.result.syncedAt || 0,
  };
}

async function pushCloudHistorySnapshot(history) {
  const response = await callCloudFunction("historySync", {
    action: "push",
    history,
  });

  if (!response.ok) {
    return response;
  }

  return {
    count: response.result.count || 0,
    ok: true,
    syncedAt: response.result.syncedAt || Date.now(),
  };
}

async function clearCloudHistorySnapshot() {
  const response = await callCloudFunction("historySync", {
    action: "clear",
  });

  if (!response.ok) {
    return response;
  }

  return {
    count: response.result.count || 0,
    ok: true,
    syncedAt: response.result.syncedAt || Date.now(),
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
