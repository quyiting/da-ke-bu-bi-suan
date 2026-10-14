const { getHistoryCapacity } = require("./history");

function confirmHistoryCapacity(page, onContinue) {
  if (page.isConfirmingCapacity) return;
  const capacity = getHistoryCapacity();
  if (!capacity.isFull) {
    onContinue();
    return;
  }

  page.isConfirmingCapacity = true;
  wx.showModal({
    title: "本机记录已满",
    content: `已保存${capacity.limit}条记录。继续生成将替换最久未更新的“${capacity.oldestEntry.title}”。也可以先去记录页删除不需要的记录。`,
    confirmText: "继续生成",
    cancelText: "先整理",
    success: ({ confirm }) => {
      page.isConfirmingCapacity = false;
      if (confirm) onContinue();
    },
    fail: () => {
      page.isConfirmingCapacity = false;
      wx.showToast({ title: "容量确认失败，请重试", icon: "none" });
    },
  });
}

module.exports = { confirmHistoryCapacity };
