const { getDateKey } = require("./fortune");
const { getHistory } = require("./history");

const DAILY_LOT_KEY = "fortune-daily-lot";

function getDailyLot(date = new Date()) {
  const dailyDate = getDateKey(date);
  const entry = getHistory().find((item) => item.type === "draw" && item.result && item.result.dailyDate === dailyDate);
  const cached = wx.getStorageSync(DAILY_LOT_KEY);
  const result = cached && cached.dailyDate === dailyDate ? cached : entry && entry.result;
  return result ? { result, recordSaved: Boolean(entry) } : null;
}

module.exports = { DAILY_LOT_KEY, getDailyLot };
