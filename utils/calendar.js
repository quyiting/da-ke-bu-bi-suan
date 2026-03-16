const heavenlyStems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const earthlyBranches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const solarTermNames = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至",
];
const solarTermMinutes = [
  0,
  21208,
  42467,
  63836,
  85337,
  107014,
  128867,
  150921,
  173149,
  195551,
  218072,
  240693,
  263343,
  285989,
  308563,
  331033,
  353350,
  375494,
  397447,
  419210,
  440795,
  462224,
  483532,
  504758,
];
const monthStartTerms = [
  { branch: "丑", order: 11, termIndex: 0 },
  { branch: "寅", order: 0, termIndex: 2 },
  { branch: "卯", order: 1, termIndex: 4 },
  { branch: "辰", order: 2, termIndex: 6 },
  { branch: "巳", order: 3, termIndex: 8 },
  { branch: "午", order: 4, termIndex: 10 },
  { branch: "未", order: 5, termIndex: 12 },
  { branch: "申", order: 6, termIndex: 14 },
  { branch: "酉", order: 7, termIndex: 16 },
  { branch: "戌", order: 8, termIndex: 18 },
  { branch: "亥", order: 9, termIndex: 20 },
  { branch: "子", order: 10, termIndex: 22 },
];
const solarTermBaseUtc = Date.UTC(1900, 0, 6, 2, 5);

const stemElements = {
  "甲": "木",
  "乙": "木",
  "丙": "火",
  "丁": "火",
  "戊": "土",
  "己": "土",
  "庚": "金",
  "辛": "金",
  "壬": "水",
  "癸": "水",
};

const branchElements = {
  "子": "水",
  "丑": "土",
  "寅": "木",
  "卯": "木",
  "辰": "土",
  "巳": "火",
  "午": "火",
  "未": "土",
  "申": "金",
  "酉": "金",
  "戌": "土",
  "亥": "水",
};

const branchClashMap = {
  "子": "午",
  "丑": "未",
  "寅": "申",
  "卯": "酉",
  "辰": "戌",
  "巳": "亥",
  "午": "子",
  "未": "丑",
  "申": "寅",
  "酉": "卯",
  "戌": "辰",
  "亥": "巳",
};

const xunStarts = ["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"];
const xunEmptyPairs = [
  ["戌", "亥"],
  ["申", "酉"],
  ["午", "未"],
  ["辰", "巳"],
  ["寅", "卯"],
  ["子", "丑"],
];

const sixSpiritStartMap = {
  "甲": "青龙",
  "乙": "青龙",
  "丙": "朱雀",
  "丁": "朱雀",
  "戊": "勾陈",
  "己": "腾蛇",
  "庚": "白虎",
  "辛": "白虎",
  "壬": "玄武",
  "癸": "玄武",
};

const generateMap = {
  "木": "火",
  "火": "土",
  "土": "金",
  "金": "水",
  "水": "木",
};

const controlMap = {
  "木": "土",
  "土": "水",
  "水": "火",
  "火": "金",
  "金": "木",
};

const strengthMap = {
  "旺": {
    label: "旺",
    score: 2,
    tone: "当令而旺，这一爻在时气里更容易发声。",
  },
  "相": {
    label: "相",
    score: 1,
    tone: "受月令相生，事情容易被看见或被推着往前。",
  },
  "休": {
    label: "休",
    score: 0,
    tone: "气机偏缓，更适合观察和等待外力承接。",
  },
  "囚": {
    label: "囚",
    score: -1,
    tone: "自身有力却受场域束住，容易卡在推进方式上。",
  },
  "死": {
    label: "死",
    score: -2,
    tone: "受月令压制，这一爻的现实承接偏弱。",
  },
};

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function atMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatTermDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function generates(fromElement, toElement) {
  return generateMap[fromElement] === toElement;
}

function controls(fromElement, toElement) {
  return controlMap[fromElement] === toElement;
}

function getSexagenaryByIndex(index) {
  const safeIndex = mod(index, 60);
  const stem = heavenlyStems[safeIndex % heavenlyStems.length];
  const branch = earthlyBranches[safeIndex % earthlyBranches.length];

  return {
    index: safeIndex,
    stem,
    branch,
    label: `${stem}${branch}`,
  };
}

function getSolarTermDate(year, termIndex) {
  return new Date(31556925974.7 * (year - 1900) + solarTermMinutes[termIndex] * 60000 + solarTermBaseUtc);
}

function buildSolarTerms(date = new Date(), termIndexes = solarTermNames.map((_, index) => index)) {
  const year = date.getFullYear();
  const years = [year - 1, year, year + 1];

  return years
    .flatMap((itemYear) =>
      termIndexes.map((termIndex) => ({
        index: termIndex,
        label: solarTermNames[termIndex],
        time: getSolarTermDate(itemYear, termIndex),
        year: itemYear,
      }))
    )
    .sort((left, right) => left.time - right.time);
}

function getAroundSolarTerms(date = new Date()) {
  const terms = buildSolarTerms(date);
  let current = terms[0];
  let next = terms[terms.length - 1];

  for (let index = 0; index < terms.length; index += 1) {
    if (terms[index].time <= date) {
      current = terms[index];
      next = terms[index + 1] || next;
    }
  }

  return {
    current,
    next,
  };
}

function getYearPillar(date = new Date()) {
  const safeDate = new Date(date);
  let solarYear = safeDate.getFullYear();
  let liChun = getSolarTermDate(solarYear, 2);

  if (safeDate < liChun) {
    solarYear -= 1;
    liChun = getSolarTermDate(solarYear, 2);
  }

  const pillar = getSexagenaryByIndex(solarYear - 1984);

  return {
    ...pillar,
    liChun,
    solarYear,
  };
}

function getMonthPillar(date = new Date()) {
  const yearPillar = getYearPillar(date);
  const safeDate = new Date(date);
  const monthTerms = buildSolarTerms(safeDate, monthStartTerms.map((item) => item.termIndex));
  const currentStart = monthTerms.reduce((latest, term) => (term.time <= safeDate ? term : latest), monthTerms[0]);
  const nextStart =
    monthTerms.find((term) => term.time > safeDate && term.time > currentStart.time) ||
    monthTerms[monthTerms.length - 1];
  const matchedConfig = monthStartTerms.find((item) => item.termIndex === currentStart.index) || monthStartTerms[1];
  const order = matchedConfig.order;
  const branch = matchedConfig.branch;
  const yearStemIndex = heavenlyStems.indexOf(yearPillar.stem);
  const yinMonthStemIndex = mod((yearStemIndex % 5) * 2 + 2, heavenlyStems.length);
  const stem = heavenlyStems[mod(yinMonthStemIndex + order, heavenlyStems.length)];

  return {
    endLabel: nextStart ? formatTermDate(nextStart.time) : "",
    nextTermLabel: nextStart ? nextStart.label : "",
    order,
    branch,
    startLabel: formatTermDate(currentStart.time),
    startTermLabel: currentStart.label,
    stem,
    label: `${stem}${branch}`,
  };
}

function getDayPillar(date = new Date()) {
  const baseDate = new Date(2001, 0, 1);
  const safeDate = atMidnight(date);
  const diffDays = Math.round((safeDate - baseDate) / 86400000);

  return getSexagenaryByIndex(diffDays);
}

function getEmptyBranches(dayIndex) {
  return xunEmptyPairs[Math.floor(mod(dayIndex, 60) / 10)];
}

function getXunLabel(dayIndex) {
  return xunStarts[Math.floor(mod(dayIndex, 60) / 10)];
}

function getSeasonStrength(lineElement, monthElement) {
  if (lineElement === monthElement) {
    return strengthMap["旺"];
  }

  if (generates(monthElement, lineElement)) {
    return strengthMap["相"];
  }

  if (generates(lineElement, monthElement)) {
    return strengthMap["休"];
  }

  if (controls(lineElement, monthElement)) {
    return strengthMap["囚"];
  }

  return strengthMap["死"];
}

function getBranchEffect(lineBranch, lineElement, referenceBranch, referenceElement, scope) {
  const isMonth = scope === "month";
  const prefix = isMonth ? "月" : "日";

  if (lineBranch === referenceBranch) {
    return {
      label: isMonth ? "临月" : "临日",
      score: 2,
      tone: `${prefix}辰同临，本爻现实感更强。`,
    };
  }

  if (branchClashMap[lineBranch] === referenceBranch) {
    return {
      label: isMonth ? "月破" : "日冲",
      score: -2,
      tone: `${prefix}辰相冲，这一爻容易起波动或被冲散。`,
    };
  }

  if (lineElement === referenceElement) {
    return {
      label: isMonth ? "月比" : "日比",
      score: 1,
      tone: `${prefix}辰同气，这一爻更容易得到同类支持。`,
    };
  }

  if (generates(referenceElement, lineElement)) {
    return {
      label: isMonth ? "月生" : "日生",
      score: 1,
      tone: `${prefix}辰来生，本爻更有承接。`,
    };
  }

  if (generates(lineElement, referenceElement)) {
    return {
      label: isMonth ? "泄月" : "泄日",
      score: -1,
      tone: `${prefix}辰被泄，本爻更多是在输出与消耗。`,
    };
  }

  if (controls(referenceElement, lineElement)) {
    return {
      label: isMonth ? "月克" : "日克",
      score: -2,
      tone: `${prefix}辰来克，本爻受制较明显。`,
    };
  }

  return {
    label: isMonth ? "制月" : "制日",
    score: -1,
    tone: `${prefix}辰被制，这一爻有主观能动性，但不算轻松。`,
  };
}

function getCalendarContext(date = new Date()) {
  const safeDate = new Date(date);
  const dateOnly = atMidnight(safeDate);
  const yearPillar = getYearPillar(safeDate);
  const monthPillar = getMonthPillar(safeDate);
  const dayPillar = getDayPillar(dateOnly);
  const emptyBranches = getEmptyBranches(dayPillar.index);
  const solarTerms = getAroundSolarTerms(safeDate);

  return {
    currentDateLabel: `${dateOnly.getFullYear()}年${dateOnly.getMonth() + 1}月${dateOnly.getDate()}日`,
    currentSolarTerm: solarTerms.current.label,
    currentSolarTermLabel: `${solarTerms.current.label} ${formatTermDate(solarTerms.current.time)}`,
    dayBranch: dayPillar.branch,
    dayElement: branchElements[dayPillar.branch],
    dayPillar: dayPillar.label,
    dayStem: dayPillar.stem,
    dayBreak: branchClashMap[dayPillar.branch],
    emptyBranches,
    emptyLabel: `${emptyBranches.join("")}空`,
    monthBranch: monthPillar.branch,
    monthElement: branchElements[monthPillar.branch],
    monthPillar: monthPillar.label,
    monthBreak: branchClashMap[monthPillar.branch],
    monthWindowLabel: `${monthPillar.startTermLabel}起${monthPillar.branch}月`,
    nextSolarTerm: solarTerms.next.label,
    nextSolarTermLabel: `${solarTerms.next.label} ${formatTermDate(solarTerms.next.time)}`,
    nextTermLabel: monthPillar.nextTermLabel ? `${monthPillar.nextTermLabel} ${monthPillar.endLabel}` : "",
    yearBoundaryLabel: `立春 ${formatTermDate(yearPillar.liChun)}`,
    xunLabel: `${getXunLabel(dayPillar.index)}旬`,
    yearPillar: yearPillar.label,
  };
}

function getSixSpiritOrder(dayStem, baseSequence) {
  const startSpirit = sixSpiritStartMap[dayStem] || baseSequence[0];
  const startIndex = baseSequence.indexOf(startSpirit);

  return Array.from({ length: 6 }, (_, index) => baseSequence[(startIndex + index) % baseSequence.length]);
}

module.exports = {
  branchClashMap,
  branchElements,
  controls,
  earthlyBranches,
  generates,
  getBranchEffect,
  getCalendarContext,
  getMonthPillar,
  getSeasonStrength,
  getSolarTermDate,
  getSixSpiritOrder,
  heavenlyStems,
  stemElements,
};
