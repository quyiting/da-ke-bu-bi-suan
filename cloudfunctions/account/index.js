const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const USERS_COLLECTION = "fortune_users";

exports.main = async (event) => {
  const { OPENID, APPID } = cloud.getWXContext();
  const now = Date.now();
  const action = event && event.action ? event.action : "bootstrap";

  if (action !== "bootstrap") {
    return {
      errorMessage: "unsupported action",
      ok: false,
    };
  }

  const userRecord = {
    appId: APPID,
    appName: event && event.appName ? event.appName : "大可不必算",
    lastLoginAt: now,
    updatedAt: now,
  };

  try {
    await db.collection(USERS_COLLECTION).doc(OPENID).set({
      data: {
        ...userRecord,
        createdAt: now,
      },
    });
  } catch (error) {
    if (error && error.errCode === -502005) {
      await db.collection(USERS_COLLECTION).doc(OPENID).update({
        data: userRecord,
      });
    } else {
      throw error;
    }
  }

  return {
    lastLoginAt: now,
    ok: true,
    openid: OPENID,
    serverTime: now,
  };
};
