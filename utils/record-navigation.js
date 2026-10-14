const { getHistoryEntry } = require("./history");

const PENDING_RECORD_KEY = "fortune-pending-record-id";

function openRecord(recordId) {
  const entry = getHistoryEntry(recordId);

  if (!entry) {
    wx.showToast({ title: "这条记录已不在本机", icon: "none" });
    return;
  }

  if (!entry.result || (entry.type !== "draw" && entry.type !== "yao")) {
    wx.showToast({ title: "这条旧记录仅保存了摘要", icon: "none" });
    return;
  }

  if (entry.type === "draw") {
    wx.navigateTo({ url: `/pages/draw/draw?recordId=${encodeURIComponent(entry.id)}` });
    return;
  }

  wx.removeStorageSync("fortune-pending-yao-intent");
  wx.setStorageSync(PENDING_RECORD_KEY, entry.id);
  wx.switchTab({
    url: "/pages/yao/yao",
    fail: () => wx.removeStorageSync(PENDING_RECORD_KEY),
  });
}

module.exports = { openRecord, PENDING_RECORD_KEY };
