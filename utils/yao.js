const {
  branchClashMap,
  branchElements,
  earthlyBranches,
  getBranchEffect,
  getCalendarContext,
  getMonthPillar,
  getSeasonStrength,
  getSixSpiritOrder,
  generates,
  controls,
} = require("./calendar");
const {
  hexagramMap,
  lineMeanings,
  lineTypeMap,
  sixRelationMeanings,
  sixSpiritMeanings,
  sixSpiritSequence,
  trigramMap,
  yaoTopics,
} = require("./yao-data");

const relationOrder = ["兄弟", "子孙", "妻财", "官鬼", "父母"];
const progressMap = {
  "亥": "子",
  "寅": "卯",
  "巳": "午",
  "申": "酉",
  "丑": "辰",
  "辰": "未",
  "未": "戌",
  "戌": "丑",
};
const retreatMap = {
  "子": "亥",
  "卯": "寅",
  "午": "巳",
  "酉": "申",
  "辰": "丑",
  "未": "辰",
  "戌": "未",
  "丑": "戌",
};
const lifeStageLabels = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"];
const lifeStageStarts = {
  "土": "申",
  "木": "亥",
  "水": "申",
  "火": "寅",
  "金": "巳",
};

function hashString(input) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatDateTime(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAbsoluteDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function atNoon(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function buildTimingWindows(date = new Date()) {
  const baseDate = atNoon(date);
  const days = [];
  const months = [];
  const currentMonth = getMonthPillar(baseDate);
  const seenMonths = new Set([`${currentMonth.label}-${currentMonth.startLabel}`]);

  for (let offset = 1; offset <= 90; offset += 1) {
    const candidate = addDays(baseDate, offset);
    const calendar = getCalendarContext(candidate);

    days.push({
      branch: calendar.dayBranch,
      dateValue: candidate.getTime(),
      label: `${formatAbsoluteDate(candidate)} ${calendar.dayPillar}日`,
      pillar: calendar.dayPillar,
    });
  }

  for (let offset = 1; offset <= 420 && months.length < 14; offset += 1) {
    const candidate = addDays(baseDate, offset);
    const month = getMonthPillar(candidate);
    const key = `${month.label}-${month.startLabel}`;

    if (seenMonths.has(key)) {
      continue;
    }

    seenMonths.add(key);
    months.push({
      branch: month.branch,
      dateValue: candidate.getTime(),
      label: `${candidate.getFullYear()}年${month.startLabel} 起${month.label}月`,
      pillar: month.label,
    });
  }

  return {
    days,
    months,
  };
}

function pick(list, seed, offset = 0) {
  return list[(seed + offset * 17) % list.length];
}

function pickUnique(list, seed, count, offset = 0) {
  const result = [];
  const used = new Set();
  let cursor = offset;

  while (result.length < Math.min(count, list.length)) {
    const candidate = pick(list, seed, cursor);

    if (!used.has(candidate)) {
      used.add(candidate);
      result.push(candidate);
    }

    cursor += 1;
  }

  return result;
}

function simulateLine() {
  const coins = Array.from({ length: 3 }, () => (Math.random() < 0.5 ? 2 : 3));
  const sum = coins.reduce((total, value) => total + value, 0);

  return {
    coins,
    value: sum,
  };
}

function valueToBinary(value) {
  return value === 7 || value === 9 ? 1 : 0;
}

function valueToChangedBinary(value) {
  if (value === 6) {
    return 1;
  }

  if (value === 9) {
    return 0;
  }

  return valueToBinary(value);
}

function getTrigram(bits) {
  return trigramMap[bits.join("")] || trigramMap["111"];
}

function getTrigramById(trigramId) {
  return Object.keys(trigramMap)
    .map((key) => trigramMap[key])
    .find((item) => item.id === trigramId);
}

function getSixRelation(coreElement, lineElement) {
  if (coreElement === lineElement) {
    return "兄弟";
  }

  if (generates(coreElement, lineElement)) {
    return "子孙";
  }

  if (generates(lineElement, coreElement)) {
    return "父母";
  }

  if (controls(coreElement, lineElement)) {
    return "妻财";
  }

  return "官鬼";
}

function getBranchTransitionProfile(line, originalBranch, changedBranch) {
  if (!line.isMoving) {
    return {
      labels: [],
      primaryLabel: "",
      score: 0,
      tone: "此爻静守，以原支为主。",
      type: "",
    };
  }

  const items = [];

  if (originalBranch === changedBranch) {
    items.push({
      label: "伏吟",
      score: -0.8,
      tone: "动而仍伏原支，多主迟滞、压住、想动难动。",
      type: "fuYin",
    });
  }

  if (branchClashMap[originalBranch] === changedBranch) {
    items.push({
      label: "反吟",
      score: -0.4,
      tone: "动而相冲，多主来回折返、成败反复、去而复来。",
      type: "fanYin",
    });
  }

  if (progressMap[originalBranch] === changedBranch) {
    items.push({
      label: "化进神",
      score: 1,
      tone: "动而化进，事势仍有后劲，容易继续向前伸展。",
      type: "progress",
    });
  }

  if (retreatMap[originalBranch] === changedBranch) {
    items.push({
      label: "化退神",
      score: -1,
      tone: "动而化退，事势有回缩之象，后续容易降温或退让。",
      type: "retreat",
    });
  }

  if (!items.length) {
    return {
      labels: [],
      primaryLabel: "",
      score: 0,
      tone: "本爻虽动，但不成进退反伏之格，重看生克扶抑。",
      type: "",
    };
  }

  const priority = ["反吟", "伏吟", "化退神", "化进神"];
  const primary = items.sort(
    (left, right) => priority.indexOf(left.label) - priority.indexOf(right.label)
  )[0];

  return {
    labels: items.map((item) => item.label),
    primaryLabel: primary.label,
    score: items.reduce((total, item) => total + item.score, 0),
    tone: items.map((item) => item.tone).join(" "),
    type: primary.type,
  };
}

function getLifeStageMap(element) {
  const startBranch = lifeStageStarts[element] || lifeStageStarts["土"];
  const startIndex = earthlyBranches.indexOf(startBranch);

  return lifeStageLabels.reduce((result, label, index) => {
    const nextResult = result;
    nextResult[label] = earthlyBranches[(startIndex + index) % earthlyBranches.length];
    return nextResult;
  }, {});
}

function getLifeStageInfo(element, branch) {
  const stageMap = getLifeStageMap(element);
  const label = lifeStageLabels.find((item) => stageMap[item] === branch) || "";

  return {
    branch,
    label,
  };
}

function findTimingWindow(windows, scope, branch) {
  if (!branch || !windows[scope]) {
    return null;
  }

  return windows[scope].find((item) => item.branch === branch) || null;
}

function buildTimingWindowLabels(windows, config = {}) {
  const nearParts = [];
  const farParts = [];
  const nearPoints = [];
  const farPoints = [];
  const seenNear = new Set();
  const seenFar = new Set();
  const nearRules = config.nearRules || [];
  const farRules = config.farRules || [];

  nearRules.forEach((rule) => {
    const window = findTimingWindow(windows, "days", rule.branch);
    const key = window ? `${window.label}-${rule.note}` : "";

    if (!window || seenNear.has(key)) {
      return;
    }

    seenNear.add(key);
    nearParts.push(`${window.label}${rule.note ? `（${rule.note}）` : ""}`);
    nearPoints.push({
      dateValue: window.dateValue || 0,
      label: window.label,
      note: rule.note || "",
    });
  });

  farRules.forEach((rule) => {
    const window = findTimingWindow(windows, "months", rule.branch);
    const key = window ? `${window.label}-${rule.note}` : "";

    if (!window || seenFar.has(key)) {
      return;
    }

    seenFar.add(key);
    farParts.push(`${window.label}${rule.note ? `（${rule.note}）` : ""}`);
    farPoints.push({
      dateValue: window.dateValue || 0,
      label: window.label,
      note: rule.note || "",
    });
  });

  return {
    farLabel: farParts.join("；"),
    farPoints,
    nearLabel: nearParts.join("；"),
    nearPoints,
  };
}

function buildTimingTimeline(items) {
  const seen = new Set();

  return items
    .flatMap((item) =>
      []
        .concat(
          (item.nearPoints || []).map((point) => ({
            ...point,
            scope: "near",
            scopeLabel: "近应日",
            sourceLabel: item.label,
          }))
        )
        .concat(
          (item.farPoints || []).map((point) => ({
            ...point,
            scope: "far",
            scopeLabel: "远应月",
            sourceLabel: item.label,
          }))
        )
    )
    .sort((left, right) => left.dateValue - right.dateValue)
    .filter((point) => {
      const key = `${point.scope}-${point.label}-${point.note}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((point, index) => ({
      ...point,
      id: `${point.scope}-${point.dateValue}-${index}`,
      title: point.note || point.sourceLabel,
    }));
}

function buildGraveVoidProfile(line, element, originalBranch, changedBranch, isVoid, monthEffectLabel) {
  const originalStage = getLifeStageInfo(element, originalBranch);
  const changedStage = line.isMoving ? getLifeStageInfo(element, changedBranch) : { branch: changedBranch, label: "" };
  const items = [];
  let score = 0;
  const isBroken = monthEffectLabel === "月破";

  if (originalStage.label === "墓") {
    items.push({
      label: "临墓",
      score: -0.8,
      tone: "本爻临墓，多主先收、先藏、先入库，事情不容易立刻明朗。",
      type: "grave",
    });
    score -= 0.8;
  }

  if (originalStage.label === "绝") {
    items.push({
      label: "临绝",
      score: -1.2,
      tone: "本爻临绝，气机偏断，靠当前这一口气很难硬续到底。",
      type: "extinct",
    });
    score -= 1.2;
  }

  if (line.isMoving && changedStage.label === "墓") {
    items.push({
      label: "化墓",
      score: -1,
      tone: "发动化墓，多主先动后收，往往还要再等冲开、开库或旧条件松动。",
      type: "grave",
    });
    score -= 1;
  }

  if (line.isMoving && changedStage.label === "绝") {
    items.push({
      label: "化绝",
      score: -1.4,
      tone: "发动化绝，多主后劲转弱，眼前这波动静之后容易泄到底。",
      type: "extinct",
    });
    score -= 1.4;
  }

  if (isBroken) {
    items.push({
      label: "月破",
      score: 0,
      tone: "月破主眼下难稳，先有象也未必能立刻站住。",
      type: "broken",
    });
  }

  if (isVoid) {
    items.push({
      label: "旬空",
      score: 0,
      tone: "旬空主有象未实，常要等填实、出空或外部条件补齐。",
      type: "void",
    });
  }

  if (isVoid && isBroken) {
    items.unshift({
      label: "空破",
      score: -0.6,
      tone: "又空又破，眼前多象少实，常要等填实、换月或重新起势后才见真章。",
      type: "voidBroken",
    });
    score -= 0.6;
  }

  const uniqueLabels = items.filter((item, index) => items.findIndex((candidate) => candidate.label === item.label) === index);
  const priority = ["空破", "化绝", "临绝", "化墓", "临墓", "月破", "旬空"];
  const primary = uniqueLabels.length
    ? uniqueLabels.slice().sort((left, right) => priority.indexOf(left.label) - priority.indexOf(right.label))[0]
    : null;

  return {
    changedLifeStageLabel: changedStage.label,
    isBroken,
    items: uniqueLabels,
    labels: uniqueLabels.map((item) => item.label),
    lifeStageLabel: originalStage.label,
    primaryLabel: primary ? primary.label : "",
    score,
    tone: uniqueLabels.map((item) => item.tone).join(" "),
  };
}

function buildHexagramFromIds(upperId, lowerId) {
  const lower = getTrigramById(lowerId) || trigramMap["111"];
  const upper = getTrigramById(upperId) || trigramMap["111"];
  const meta = hexagramMap[`${upper.id}-${lower.id}`];
  const palaceId = meta ? meta.palace : upper.id;
  const palaceTrigram = getTrigramById(palaceId) || upper;

  return {
    id: `${upper.id}-${lower.id}`,
    image: `${upper.natural}${lower.natural}之象`,
    lower,
    meta,
    overview: meta
      ? `此卦落在${meta.palaceLabel}${meta.stageLabel}。外卦见${upper.name}${upper.natural}，表示${upper.outward}；内卦见${lower.name}${lower.natural}，说明${lower.inward}。`
      : `外卦见${upper.name}${upper.natural}，表示${upper.outward}；内卦见${lower.name}${lower.natural}，说明${lower.inward}。`,
    palaceElement: palaceTrigram.element,
    title: meta ? meta.title : `${upper.name}上${lower.name}下`,
    upper,
  };
}

function buildHexagram(lines, changed = false) {
  const lowerBits = lines.slice(0, 3).map((line) => (changed ? line.changedBinary : line.binary));
  const upperBits = lines.slice(3, 6).map((line) => (changed ? line.changedBinary : line.binary));
  const lower = getTrigram(lowerBits);
  const upper = getTrigram(upperBits);

  return buildHexagramFromIds(upper.id, lower.id);
}

function getPhase(movingCount) {
  if (movingCount === 0) {
    return {
      body: "此卦为静卦，事情短期内不会一下子翻面，关键在于你怎么读懂已有信号。",
      label: "静卦",
    };
  }

  if (movingCount <= 2) {
    return {
      body: "动爻不多，表示局面已有变化苗头，但还不到完全翻盘的时候，更适合小步试探。",
      label: "微动卦",
    };
  }

  if (movingCount <= 4) {
    return {
      body: "动爻过半，说明这件事已经处在变局之中，不宜死守旧判断，顺势调整比硬撑更有效。",
      label: "变局卦",
    };
  }

  return {
    body: "动爻很多，说明这件事已经接近翻篇或重组，眼下最重要的不是求稳，而是认清旧节奏已经撑不住了。",
    label: "大变卦",
  };
}

function getPowerProfile(score) {
  if (score >= 5) {
    return {
      label: "得令得扶",
      tone: "这一爻得令得扶，是盘里最有气的落点之一。",
    };
  }

  if (score >= 3) {
    return {
      label: "气足可用",
      tone: "这一爻有承接，现实里能找到对应抓手。",
    };
  }

  if (score >= 1) {
    return {
      label: "平稳可看",
      tone: "这一爻不算特别强，但可以作为判断里的稳定参照。",
    };
  }

  if (score >= -1) {
    return {
      label: "偏弱待扶",
      tone: "这一爻有意向但承接一般，宜再等支持条件补齐。",
    };
  }

  return {
    label: "受制偏弱",
    tone: "这一爻受制较明显，不宜把全部判断押在这里。",
  };
}

function buildLineAssignments(hexagram) {
  const lowerLines = hexagram.lower.branchesInner.map((branch, index) => ({
    branch,
    element: branchElements[branch],
    naJia: `${hexagram.lower.stemInner}${branch}`,
    position: index + 1,
    stem: hexagram.lower.stemInner,
  }));
  const upperLines = hexagram.upper.branchesOuter.map((branch, index) => ({
    branch,
    element: branchElements[branch],
    naJia: `${hexagram.upper.stemOuter}${branch}`,
    position: index + 4,
    stem: hexagram.upper.stemOuter,
  }));

  return lowerLines.concat(upperLines);
}

function buildVisualLines(rows) {
  return {
    changed: rows.map((row) => ({
      id: `${row.id}-changed`,
      isMoving: row.isMoving,
      isYang: row.changedIsYang,
    })),
    original: rows.map((row) => ({
      id: `${row.id}-original`,
      isMoving: row.isMoving,
      isYang: row.isYang,
    })),
  };
}

function getTransformEffect(line, rowElement, changedElement, relation, changedRelation) {
  if (!line.isMoving) {
    return {
      label: "",
      score: 0,
      tone: "此爻静守，以原象为主。",
    };
  }

  if (generates(changedElement, rowElement)) {
    return {
      label: "化回头生",
      score: 1.5,
      tone: "变爻回头来生原神，后续更容易补到承接。",
    };
  }

  if (controls(changedElement, rowElement)) {
    return {
      label: "化回头克",
      score: -1.5,
      tone: "变爻回头来克，后续容易自己打自己或出现反噬。",
    };
  }

  if (relation === changedRelation) {
    return {
      label: "同类续气",
      score: 0.5,
      tone: "本爻虽动，但仍沿着同类之气延续。",
    };
  }

  if (generates(rowElement, changedElement)) {
    return {
      label: "化泄气",
      score: -0.5,
      tone: "本爻发动后多半先输出，力量会被分走一截。",
    };
  }

  if (controls(rowElement, changedElement)) {
    return {
      label: "化制约",
      score: 0.3,
      tone: "本爻变后仍有一定主动性，但会转向控制或消耗。",
    };
  }

  return {
    label: "动而有变",
    score: 0.2,
    tone: "本爻已动，后续重心会沿着变爻慢慢转向。",
  };
}

function buildFormalLines(lines, originalHexagram, changedHexagram, calendarContext) {
  const originalAssignments = buildLineAssignments(originalHexagram);
  const changedAssignments = buildLineAssignments(changedHexagram);
  const spiritOrder = getSixSpiritOrder(calendarContext.dayStem, sixSpiritSequence);
  const shiPosition = originalHexagram.meta ? originalHexagram.meta.shiPosition : 6;
  const yingPosition = originalHexagram.meta ? originalHexagram.meta.yingPosition : 3;

  const rows = lines
    .map((line, index) => {
      const origin = originalAssignments[index];
      const changed = changedAssignments[index];
      const relation = getSixRelation(originalHexagram.palaceElement, origin.element);
      const changedRelation = getSixRelation(changedHexagram.palaceElement, changed.element);
      const spirit = spiritOrder[line.position - 1];
      const role = line.position === shiPosition ? "世" : line.position === yingPosition ? "应" : "";
      const monthState = getSeasonStrength(origin.element, calendarContext.monthElement);
      const monthEffect = getBranchEffect(
        origin.branch,
        origin.element,
        calendarContext.monthBranch,
        calendarContext.monthElement,
        "month"
      );
      const dayEffect = getBranchEffect(
        origin.branch,
        origin.element,
        calendarContext.dayBranch,
        calendarContext.dayElement,
        "day"
      );
      const isVoid = calendarContext.emptyBranches.includes(origin.branch);
      const branchTransition = getBranchTransitionProfile(line, origin.branch, changed.branch);
      const graveVoidProfile = buildGraveVoidProfile(
        line,
        origin.element,
        origin.branch,
        changed.branch,
        isVoid,
        monthEffect.label
      );
      const transformEffect = getTransformEffect(
        line,
        origin.element,
        changed.element,
        relation,
        changedRelation
      );
      const powerScore =
        monthState.score +
        monthEffect.score +
        dayEffect.score +
        (line.isMoving ? 1 : 0) +
        (role === "世" ? 1 : 0) +
        (role === "应" ? 0.5 : 0) +
        (isVoid ? -2 : 0) +
        branchTransition.score +
        graveVoidProfile.score +
        transformEffect.score;
      const powerProfile = getPowerProfile(powerScore);

      return {
        branch: origin.branch,
        branchTransitionLabel: branchTransition.primaryLabel,
        branchTransitionTone: branchTransition.tone,
        branchTransitionType: branchTransition.type,
        changedBranch: changed.branch,
        changedElement: changed.element,
        changedIsYang: line.changedBinary === 1,
        changedNaJia: changed.naJia,
        changedRelation,
        changedRelationMeaning: sixRelationMeanings[changedRelation],
        dayEffectLabel: dayEffect.label,
        dayEffectTone: dayEffect.tone,
        element: origin.element,
        graveVoidDetails: graveVoidProfile.items,
        graveVoidLabel: graveVoidProfile.labels.join(" · "),
        graveVoidPrimaryLabel: graveVoidProfile.primaryLabel,
        graveVoidTone: graveVoidProfile.tone,
        hasRole: Boolean(role),
        id: `${line.position}-${line.value}`,
        isMoving: line.isMoving,
        isBroken: graveVoidProfile.isBroken,
        isVoid,
        isYang: line.isYang,
        lifeStageLabel: graveVoidProfile.lifeStageLabel,
        marker: line.marker,
        monthEffectLabel: monthEffect.label,
        monthEffectTone: monthEffect.tone,
        monthStateLabel: monthState.label,
        monthStateTone: monthState.tone,
        naJia: origin.naJia,
        position: line.position,
        positionLabel: line.positionLabel,
        powerLabel: powerProfile.label,
        powerScore,
        powerTone: powerProfile.tone,
        relation,
        relationMeaning: sixRelationMeanings[relation],
        role,
        roleDisplay: role || "—",
        spirit,
        spiritMeaning: sixSpiritMeanings[spirit],
        statusTags: [
          monthState.label,
          monthEffect.label,
          dayEffect.label,
          branchTransition.primaryLabel,
          ...graveVoidProfile.labels,
          transformEffect.label,
          line.isMoving ? "发动" : "静守",
        ].filter(Boolean),
        transitionLabel: [branchTransition.primaryLabel, transformEffect.label].filter(Boolean).join(" · "),
        transitionTone: [branchTransition.tone, transformEffect.tone].filter(Boolean).join(" "),
        transformEffectLabel: transformEffect.label,
        transformEffectTone: transformEffect.tone,
        transformEffectScore: transformEffect.score,
        typeLabel: line.typeLabel,
        typeTone: line.typeTone,
        changedLifeStageLabel: graveVoidProfile.changedLifeStageLabel,
      };
    })
    .reverse();

  return {
    changedPalaceElement: changedHexagram.palaceElement,
    palaceId: originalHexagram.meta ? originalHexagram.meta.palace : originalHexagram.upper.id,
    palaceElement: originalHexagram.palaceElement,
    palaceLabel: originalHexagram.meta ? originalHexagram.meta.palaceLabel : "",
    palaceStage: originalHexagram.meta ? originalHexagram.meta.stageLabel : "",
    rows,
    shiPosition,
    visualLines: buildVisualLines(rows),
    yingPosition,
  };
}

function buildPatternProfile(formalLines) {
  const classifySegment = (rows, scopeLabel) => {
    const segmentRows = formalLines.rows.filter((row) => rows.includes(row.position));
    const hasMotion = segmentRows.some((row) => row.isMoving);

    if (!hasMotion) {
      return null;
    }

    const allFuYin = segmentRows.every((row) => row.branch === row.changedBranch);
    const allFanYin = segmentRows.every((row) => branchClashMap[row.branch] === row.changedBranch);

    if (allFuYin) {
      return {
        label: `${scopeLabel}伏吟`,
        summary:
          scopeLabel === "内卦"
            ? "内卦伏吟，自己这边容易心里拧着、想动却难动。"
            : "外卦伏吟，对方或外部条件多半迟滞压着不松。",
        type: "fuYin",
      };
    }

    if (allFanYin) {
      return {
        label: `${scopeLabel}反吟`,
        summary:
          scopeLabel === "内卦"
            ? "内卦反吟，我方思路与节奏容易反复，做了又想改。"
            : "外卦反吟，外部条件来回折返，对方态度也更容易反复。",
        type: "fanYin",
      };
    }

    return null;
  };

  const inner = classifySegment([1, 2, 3], "内卦");
  const outer = classifySegment([4, 5, 6], "外卦");
  const items = [inner, outer].filter(Boolean);

  if (!items.length) {
    return {
      items: [],
      primaryLabel: "",
      summary: "这盘没有形成明显的反吟或伏吟格局，重点仍看用神与世应生克。",
      type: "",
    };
  }

  if (items.length === 2 && items[0].type === items[1].type) {
    return {
      items,
      primaryLabel: `内外${items[0].type === "fuYin" ? "伏吟" : "反吟"}`,
      summary:
        items[0].type === "fuYin"
          ? "内外伏吟，多主内外都压着不松，事情拖着走、想推进也不利索。"
          : "内外反吟，多主内外都不安，事情反复来回，常见去而复来、得而复失。",
      type: items[0].type,
    };
  }

  return {
    items,
    primaryLabel: items[0].label,
    summary: items.map((item) => item.summary).join(" "),
    type: items[0].type,
  };
}

function buildHiddenLines(formalLines, originalHexagram, calendarContext) {
  const visibleRelations = new Set(formalLines.rows.map((row) => row.relation));
  const missingRelations = relationOrder.filter((relation) => !visibleRelations.has(relation));

  if (!missingRelations.length) {
    return {
      hiddenLines: [],
      rows: formalLines.rows.map((row) => ({
        ...row,
        hiddenItems: [],
        hiddenLabel: "",
      })),
    };
  }

  const palaceHexagram = buildHexagramFromIds(formalLines.palaceId, formalLines.palaceId);
  const palaceAssignments = buildLineAssignments(palaceHexagram);
  const hiddenByPosition = {};
  const hiddenLines = [];

  palaceAssignments.forEach((assignment, index) => {
    const relation = getSixRelation(originalHexagram.palaceElement, assignment.element);

    if (!missingRelations.includes(relation)) {
      return;
    }

    const position = index + 1;
    const hostRow = formalLines.rows.find((row) => row.position === position);
    const monthState = getSeasonStrength(assignment.element, calendarContext.monthElement);
    const monthEffect = getBranchEffect(
      assignment.branch,
      assignment.element,
      calendarContext.monthBranch,
      calendarContext.monthElement,
      "month"
    );
    const dayEffect = getBranchEffect(
      assignment.branch,
      assignment.element,
      calendarContext.dayBranch,
      calendarContext.dayElement,
      "day"
    );
    const isVoid = calendarContext.emptyBranches.includes(assignment.branch);
    const graveVoidProfile = buildGraveVoidProfile(
      { isMoving: false },
      assignment.element,
      assignment.branch,
      assignment.branch,
      isVoid,
      monthEffect.label
    );
    const hostSupport = hostRow ? (hostRow.powerScore >= 3 ? 1 : hostRow.powerScore >= 1 ? 0.5 : -0.5) : 0;
    const hiddenScore =
      monthState.score +
      monthEffect.score +
      dayEffect.score -
      1 +
      hostSupport +
      (isVoid ? -2 : 0) +
      graveVoidProfile.score;
    const powerProfile = getPowerProfile(hiddenScore);
    const hidden = {
      branch: assignment.branch,
      graveVoidDetails: graveVoidProfile.items,
      graveVoidLabel: graveVoidProfile.labels.join(" · "),
      element: assignment.element,
      hostPositionLabel: hostRow ? hostRow.positionLabel : lineMeanings[position - 1].label,
      hostRole: hostRow ? hostRow.role : "",
      hostTitle: hostRow ? `${hostRow.positionLabel} · ${hostRow.naJia}${hostRow.relation}` : "",
      id: `hidden-${position}-${assignment.naJia}-${relation}`,
      isBroken: graveVoidProfile.isBroken,
      isVoid,
      lifeStageLabel: graveVoidProfile.lifeStageLabel,
      monthEffectLabel: monthEffect.label,
      monthStateLabel: monthState.label,
      naJia: assignment.naJia,
      dayEffectLabel: dayEffect.label,
      position,
      positionLabel: lineMeanings[position - 1].label,
      powerLabel: powerProfile.label,
      powerScore: hiddenScore,
      powerTone: powerProfile.tone,
      relation,
      relationMeaning: sixRelationMeanings[relation],
      statusTags: [
        monthState.label,
        monthEffect.label,
        dayEffect.label,
        ...graveVoidProfile.labels,
        "伏神",
      ].filter(Boolean),
      summary: `${powerProfile.label}，${[monthState.label, monthEffect.label, dayEffect.label]
        .concat(graveVoidProfile.labels)
        .join(" · ")}`,
      title: `${lineMeanings[position - 1].label} · 伏${assignment.naJia}${relation}`,
    };

    hiddenByPosition[position] = (hiddenByPosition[position] || []).concat(hidden);
    hiddenLines.push(hidden);
  });

  return {
    hiddenLines: hiddenLines.sort((left, right) => right.position - left.position),
    rows: formalLines.rows.map((row) => ({
      ...row,
      hiddenItems: hiddenByPosition[row.position] || [],
      hiddenLabel: (hiddenByPosition[row.position] || []).map((item) => `伏${item.naJia}${item.relation}`).join(" / "),
    })),
  };
}

function buildMovingLines(lines, topic, formalLines, seed) {
  const rowMap = formalLines.rows.reduce((result, row) => {
    const nextResult = result;
    nextResult[row.position] = row;
    return nextResult;
  }, {});

  return lines
    .filter((line) => line.isMoving)
    .map((line, index) => {
      const row = rowMap[line.position];

      return {
        body: `${line.stage}这一层在动。${row.powerTone}${row.graveVoidTone ? ` ${row.graveVoidTone}` : ""}${row.transitionLabel ? ` ${row.transitionTone}` : ""} ${pick(topic.avoidHints, seed, index)}`,
        label: `${line.positionLabel} · ${row.naJia}${row.relation}`,
        prompt: `${line.prompt} 此爻见${row.monthStateLabel}、${row.monthEffectLabel}、${row.dayEffectLabel}${row.graveVoidLabel ? `，并带${row.graveVoidLabel}` : ""}${row.branchTransitionLabel ? `，又成${row.branchTransitionLabel}` : ""}。`,
      };
    });
}

function buildQuestionOverview(topic, question, originalHexagram, changedHexagram, phase, calendarContext) {
  const questionText = question || topic.prompt;
  const stageLabel = originalHexagram.meta ? originalHexagram.meta.stageLabel : "本卦";

  return `你问的是“${questionText}”。得${originalHexagram.title}之${changedHexagram.title}，属${stageLabel}，起于${calendarContext.monthPillar}月${calendarContext.dayPillar}日，旬空${calendarContext.emptyLabel}，当前节气在${calendarContext.currentSolarTerm}。${phase.body}`;
}

function buildRelationProfile(formalLines, topic, originalHexagram) {
  const relationCounts = formalLines.rows.reduce((result, row) => {
    const nextResult = result;
    nextResult[row.relation] = (nextResult[row.relation] || 0) + 1;
    return nextResult;
  }, {});
  const dominantRelation =
    Object.keys(relationCounts).sort((left, right) => relationCounts[right] - relationCounts[left])[0] ||
    "兄弟";

  return {
    dominantRelation,
    dominantRelationMeaning: sixRelationMeanings[dominantRelation],
    focusHint: topic.formalFocus,
    palaceElement: formalLines.palaceElement,
    palaceLabel: formalLines.palaceLabel,
    palaceStage: formalLines.palaceStage,
    shiLabel: lineMeanings[formalLines.shiPosition - 1].label,
    title: originalHexagram.title,
    yingLabel: lineMeanings[formalLines.yingPosition - 1].label,
  };
}

function buildShiYingProfile(formalLines) {
  const shiRow = formalLines.rows.find((row) => row.role === "世");
  const yingRow = formalLines.rows.find((row) => row.role === "应");

  if (!shiRow || !yingRow) {
    return {
      balanceLabel: "未成世应",
      balanceTone: "当前结果里没有稳定取到世应落点。",
      motionLabel: "先看用神",
      motionTone: "先以用神和动爻为主。",
      relationLabel: "未成世应",
      relationTone: "当前排盘无法给出世应细断。",
      summary: "这盘先回到用神、动爻和月日扶抑来读。",
    };
  }

  let relationLabel = "世应平看";
  let relationTone = "世应之间没有特别鲜明的生克关系，要更多回到旺衰与动变上细读。";

  if (branchClashMap[shiRow.branch] === yingRow.branch) {
    relationLabel = "世应相冲";
    relationTone = "世应相冲，多主立场对顶、节奏不一，事情容易反复来回。";
  } else if (shiRow.element === yingRow.element) {
    relationLabel = "世应比和";
    relationTone = "世应同气，比和则彼此节奏相近，较容易站到同一侧说话。";
  } else if (generates(shiRow.element, yingRow.element)) {
    relationLabel = "世生应";
    relationTone = "世生应，多主我方更主动、更投入，也常意味着自己先去给对面条件。";
  } else if (generates(yingRow.element, shiRow.element)) {
    relationLabel = "应生世";
    relationTone = "应生世，多主外部条件、对方态度或结果回声更愿意来托住我方。";
  } else if (controls(shiRow.element, yingRow.element)) {
    relationLabel = "世克应";
    relationTone = "世克应，多主我方更想控局、压节奏，容易变成自己在使劲推着走。";
  } else if (controls(yingRow.element, shiRow.element)) {
    relationLabel = "应克世";
    relationTone = "应克世，多主外部压力更强，对方或现实条件会反过来压住我方。";
  }

  let motionLabel = "双方静看";
  let motionTone = "世应皆静，眼下更像观望局，先别急着追一个立刻翻面的结果。";

  if (shiRow.isMoving && yingRow.isMoving) {
    motionLabel = "双方都动";
    motionTone = "世应同动，说明两边都在动念或动手，局势推进会更快，但也更容易互相牵动。";
  } else if (shiRow.isMoving) {
    motionLabel = "世先应后";
    motionTone = "世爻发动，我方是先动的一边，很多变化先从自己这边起头。";
  } else if (yingRow.isMoving) {
    motionLabel = "应先世后";
    motionTone = "应爻发动，对方或外部条件先给出动作，局势主动权更偏向外侧。";
  }

  let balanceLabel = "势均力敌";
  let balanceTone = "世应旺衰差距不大，更多是看谁先动、谁更得时。";

  if (shiRow.powerScore - yingRow.powerScore >= 2) {
    balanceLabel = "世强应弱";
    balanceTone = "世强应弱，我方主观意志更重，但也容易把事情看成自己说了算。";
  } else if (yingRow.powerScore - shiRow.powerScore >= 2) {
    balanceLabel = "应强世弱";
    balanceTone = "应强世弱，外部条件更硬，很多时候不是不想动，而是现实不让。";
  }

  const changeNotes = [shiRow, yingRow]
    .filter((row) => row.branchTransitionLabel || row.transformEffectLabel)
    .map((row) => `${row.role}爻${row.transitionLabel || row.transformEffectLabel}`);

  const summary = `${relationTone} ${motionTone} ${balanceTone}${changeNotes.length ? ` ${changeNotes.join("，")}。` : ""}`;

  return {
    balanceLabel,
    balanceTone,
    motionLabel,
    motionTone,
    relationLabel,
    relationTone,
    shiRow,
    summary,
    yingRow,
  };
}

function buildCalendarPanels(calendarContext, relationProfile) {
  return [
    {
      copy: `${calendarContext.monthWindowLabel} · 下次换月 ${calendarContext.nextTermLabel}`,
      label: "月建",
      value: calendarContext.monthPillar,
    },
    {
      copy: `当前 ${calendarContext.currentSolarTermLabel}`,
      label: "节气",
      value: calendarContext.nextSolarTermLabel,
    },
    {
      copy: `日冲 ${calendarContext.dayBreak}`,
      label: "日辰",
      value: calendarContext.dayPillar,
    },
    {
      copy: calendarContext.emptyLabel,
      label: "旬空",
      value: calendarContext.xunLabel,
    },
    {
      copy: calendarContext.yearBoundaryLabel,
      label: "年柱",
      value: calendarContext.yearPillar,
    },
    {
      copy: `${relationProfile.palaceLabel} · ${relationProfile.palaceStage}`,
      label: "宫位",
      value: `${relationProfile.palaceElement}宫`,
    },
  ];
}

function summarizeRow(row) {
  const states = [row.monthStateLabel, row.monthEffectLabel, row.dayEffectLabel]
    .concat(row.graveVoidDetails ? row.graveVoidDetails.map((item) => item.label) : [])
    .concat(row.role ? [`${row.role}爻`] : [])
    .join(" · ");

  return `${row.powerLabel}，${states}`;
}

function buildYongShenProfile(formalLines, topic) {
  const visibleCandidates = formalLines.rows
    .filter(
      (row) =>
        topic.primaryRelations.includes(row.relation) || (row.role && topic.watchRoles.includes(row.role))
    )
    .map((row) => {
      const signalScore =
        row.powerScore +
        (topic.primaryRelations.includes(row.relation) ? 2 : 0) +
        (row.role && topic.watchRoles.includes(row.role) ? 1 : 0) +
        row.transformEffectScore +
        (row.isMoving ? 0.5 : 0);

      return {
        id: row.id,
        isVoid: row.isVoid,
        naJia: row.naJia,
        positionLabel: row.positionLabel,
        powerLabel: row.powerLabel,
        relation: row.relation,
        role: row.role,
        signalScore,
        source: "visible",
        summary: `${summarizeRow(row)}${row.transformEffectLabel ? ` · ${row.transformEffectLabel}` : ""}`,
        tags: row.statusTags,
        title: `${row.positionLabel} · ${row.naJia}${row.relation}`,
      };
    });
  const visiblePrimaryCandidates = visibleCandidates.filter((item) =>
    topic.primaryRelations.includes(item.relation)
  );
  const visibleRoleCandidates = visibleCandidates.filter(
    (item) => !topic.primaryRelations.includes(item.relation)
  );
  const visiblePrimaryRelations = new Set(
    visiblePrimaryCandidates.map((item) => item.relation)
  );
  const hiddenCandidates = formalLines.hiddenLines
    .filter((row) => topic.primaryRelations.includes(row.relation))
    .map((row) => {
      const signalScore =
        row.powerScore +
        2 +
        (!visiblePrimaryRelations.has(row.relation) ? 1 : 0) +
        (row.hostRole && topic.watchRoles.includes(row.hostRole) ? 0.5 : 0);

      return {
        hostTitle: row.hostTitle,
        id: row.id,
        isVoid: row.isVoid,
        naJia: row.naJia,
        positionLabel: row.positionLabel,
        powerLabel: row.powerLabel,
        relation: row.relation,
        role: "",
        signalScore,
        source: "hidden",
        summary: `伏神${row.summary}`,
        tags: row.statusTags,
        title: `${row.positionLabel} · 伏${row.naJia}${row.relation}`,
      };
    });
  const primaryPool = visiblePrimaryCandidates
    .concat(hiddenCandidates)
    .sort((left, right) => right.signalScore - left.signalScore);
  const supportPool = visibleRoleCandidates.sort((left, right) => right.signalScore - left.signalScore);
  const candidates = primaryPool
    .concat(supportPool)
    .sort((left, right) => right.signalScore - left.signalScore);

  const primary = primaryPool[0] || supportPool[0];

  if (!primary) {
    return {
      candidates: [],
      intro: topic.yongShenText,
      label: topic.yongShenLabel,
      primary: null,
      verdictBody: "这题先回到世应与动爻本身，盘里暂时没有特别突出的用神落点。",
      verdictLabel: "先看世应",
    };
  }

  if (primary.source === "hidden") {
    if (primary.signalScore >= 2 && !primary.isVoid) {
      return {
        candidates: candidates.slice(0, 4),
        intro: topic.yongShenText,
        label: topic.yongShenLabel,
        primary,
        verdictBody: `这题的关键用神没有明透在盘面上，而是伏在 ${primary.title}。${primary.summary}，说明真正的转机还压在暗线里，要等它上面的那层现实先松动。`,
        verdictLabel: "伏神待发",
      };
    }

    return {
      candidates: candidates.slice(0, 4),
      intro: topic.yongShenText,
      label: topic.yongShenLabel,
      primary,
      verdictBody: `当前用神不上卦，伏在 ${primary.title}。${primary.summary}，这说明眼下关键条件仍偏隐，先别把希望全压在表面反馈上。`,
      verdictLabel: "伏神偏隐",
    };
  }

  let verdictLabel = "用神得力";
  let verdictBody = `当前最值得盯住的是 ${primary.title}。${primary.summary}，这一处更像是整盘里真正能落到现实的抓手。`;

  if (primary.signalScore < 5) {
    verdictLabel = "用神可用";
    verdictBody = `当前先看 ${primary.title}。${primary.summary}，这处有信息也有现实影子，适合拿来做第一层验证。`;
  }

  if (primary.signalScore < 2) {
    verdictLabel = "用神平平";
    verdictBody = `当前先看 ${primary.title}。${primary.summary}，它不是没有信息，但承接还不够满，宜先拿现实反馈来补证。`;
  }

  if (primary.signalScore < 0 || primary.isVoid) {
    verdictLabel = "用神偏弱";
    verdictBody = `当前用神落在 ${primary.title}。${primary.summary}，这说明关键条件还偏虚，先别急着把结论下死。`;
  }

  return {
    candidates: candidates.slice(0, 4),
    intro: topic.yongShenText,
    label: topic.yongShenLabel,
    primary,
    verdictBody,
    verdictLabel,
  };
}

function buildBaseTimingHint(changedHexagram, movingCount, yongShenProfile) {
  if (yongShenProfile.primary && yongShenProfile.primary.source === "hidden") {
    return "用神伏藏，事情往往慢半拍，应期更容易通过暗线消息、补资料或幕后条件变化体现出来。";
  }

  if (yongShenProfile.primary && yongShenProfile.primary.isVoid) {
    return "用神带旬空，事情更像要再拖一拍，等人、等消息或等现实条件补齐。";
  }

  if (movingCount === 0) {
    return "静卦更重后续显形，不必逼一个立刻落地的结果。";
  }

  if (["zhen", "li", "qian"].includes(changedHexagram.upper.id)) {
    return "应期偏快，常常先出现消息、动作或态度变化，再逐步看清结果。";
  }

  if (["dui", "xun"].includes(changedHexagram.upper.id)) {
    return "应期更多通过沟通与反馈显现，通常不是一瞬间落定。";
  }

  return changedHexagram.upper.timing;
}

function buildTimingProfile(
  formalLines,
  yongShenProfile,
  patternProfile,
  shiYingProfile,
  changedHexagram,
  movingCount,
  date = new Date()
) {
  const defaultHint = buildBaseTimingHint(changedHexagram, movingCount, yongShenProfile);
  const timingWindows = buildTimingWindows(date);
  const items = [];
  const seen = new Set();
  const primary = yongShenProfile.primary;
  const focusRow = primary
    ? primary.source === "hidden"
      ? formalLines.hiddenLines.find((row) => row.id === primary.id)
      : formalLines.rows.find((row) => row.id === primary.id)
    : null;

  const pushItem = (label, body, timingLabels = {}) => {
    if (!label || !body || seen.has(label)) {
      return;
    }

    seen.add(label);
    items.push({
      body,
      farLabel: timingLabels.farLabel || "",
      farPoints: timingLabels.farPoints || [],
      label,
      nearLabel: timingLabels.nearLabel || "",
      nearPoints: timingLabels.nearPoints || [],
    });
  };

  if (primary && primary.source === "hidden") {
    pushItem(
      "伏神未透",
      "用神伏藏，应期多先应在暗线消息、补资料、幕后条件松动，再看表面局势真正推进。"
    );
  }

  if (focusRow) {
    const graveVoidLabels = focusRow.graveVoidDetails.map((item) => item.label);
    const clashBranch = branchClashMap[focusRow.branch];
    const longShengBranch = getLifeStageMap(focusRow.element)["长生"];

    if (graveVoidLabels.includes("空破")) {
      pushItem(
        "空破并见",
        "用神又空又破，眼前多象少实。短事先看出空、填实，长事多看换月后能否重新立住。",
        buildTimingWindowLabels(timingWindows, {
          nearRules: [
            { branch: focusRow.branch, note: "填实" },
            { branch: clashBranch, note: "冲空" },
          ],
          farRules: [
            { branch: focusRow.branch, note: "填实月" },
            { branch: clashBranch, note: "冲空月" },
          ],
        })
      );
    } else {
      if (graveVoidLabels.includes("旬空")) {
        pushItem(
          "旬空待实",
          "用神旬空，事情常先有话头或意向，再等填实、出空，或者关键人物真正到位。",
          buildTimingWindowLabels(timingWindows, {
            nearRules: [
              { branch: focusRow.branch, note: "填实" },
              { branch: clashBranch, note: "冲空" },
            ],
            farRules: [
              { branch: focusRow.branch, note: "填实月" },
              { branch: clashBranch, note: "冲空月" },
            ],
          })
        );
      }

      if (graveVoidLabels.includes("月破")) {
        pushItem(
          "月破待复",
          "用神月破，眼下容易先散。短事先看逢值能否起色，长事多看后面回到当令之月是否重新站稳。",
          buildTimingWindowLabels(timingWindows, {
            nearRules: [{ branch: focusRow.branch, note: "逢值" }],
            farRules: [{ branch: focusRow.branch, note: "当令月" }],
          })
        );
      }
    }

    if (graveVoidLabels.includes("化墓")) {
      const graveBranch = focusRow.changedBranch;

      pushItem(
        "化墓待冲",
        "用神化墓，多主先动后收，结果常要等冲墓、开库、旧条件松动后才真正见数。",
        buildTimingWindowLabels(timingWindows, {
          nearRules: [{ branch: branchClashMap[graveBranch], note: "冲墓" }],
          farRules: [{ branch: branchClashMap[graveBranch], note: "冲墓月" }],
        })
      );
    }

    if (graveVoidLabels.includes("临墓")) {
      pushItem(
        "临墓偏迟",
        "用神临墓，多见暂存、压后、先收不出。应期不在当下硬催，更看后面有人推动或现实松口。",
        buildTimingWindowLabels(timingWindows, {
          nearRules: [{ branch: branchClashMap[focusRow.branch], note: "冲墓" }],
          farRules: [{ branch: branchClashMap[focusRow.branch], note: "冲墓月" }],
        })
      );
    }

    if (graveVoidLabels.includes("化绝")) {
      pushItem(
        "化绝待扶",
        "用神化绝，后劲容易断在途中。眼前这波动静之后先别急着定局，更看后续再得生扶、重新起势。",
        buildTimingWindowLabels(timingWindows, {
          nearRules: [{ branch: longShengBranch, note: "长生扶起" }],
          farRules: [{ branch: longShengBranch, note: "长生月" }],
        })
      );
    }

    if (graveVoidLabels.includes("临绝")) {
      pushItem(
        "临绝偏弱",
        "用神临绝，当前这一口气偏弱，硬催往往难成，应期更容易落在后面得日月扶起的时候。",
        buildTimingWindowLabels(timingWindows, {
          nearRules: [{ branch: longShengBranch, note: "长生扶起" }],
          farRules: [{ branch: longShengBranch, note: "长生月" }],
        })
      );
    }

    if (focusRow.branchTransitionLabel === "化进神") {
      pushItem(
        "化进神",
        "用神化进，后劲在后。应期常不是一下到头，而是先见近处动静，再看后续持续推进。"
      );
    }

    if (focusRow.branchTransitionLabel === "化退神") {
      pushItem(
        "化退神",
        "用神化退，常是先热后冷。若问成败，多看第一波动作后还能不能续上。"
      );
    }

    if (focusRow.branchTransitionLabel === "伏吟") {
      pushItem(
        "爻上伏吟",
        "用神爻自己伏吟，应期偏迟，多待冲开、值起或外力催动，眼前更像压着不发。"
      );
    }

    if (focusRow.branchTransitionLabel === "反吟") {
      pushItem(
        "爻上反吟",
        "用神爻自己反吟，应期多反复，常先见消息来回，再定真正去留。"
      );
    }
  }

  if (patternProfile.type === "fuYin") {
    pushItem(
      "全局伏吟",
      "卦势伏吟，应期偏迟，先有压住感，常待冲开后才顺，越急越容易觉得事情不走。"
    );
  }

  if (patternProfile.type === "fanYin") {
    pushItem(
      "全局反吟",
      "卦势反吟，应期带回折，先看近处往复，再看第二次反馈往往更准。"
    );
  }

  if (shiYingProfile.motionLabel === "世先应后") {
    pushItem(
      "先动后应",
      "世先应后，应期更像先由你这边动作、表态或推进，再等外侧给回应。"
    );
  } else if (shiYingProfile.motionLabel === "应先世后") {
    pushItem(
      "先应后动",
      "应先世后，应期多先看对方或外部条件起变化，再轮到你这边接招或跟进。"
    );
  } else if (shiYingProfile.motionLabel === "双方都动") {
    pushItem(
      "双方并动",
      "世应同动，应期偏快，但也容易互相牵动反复，先有消息不等于马上定局。"
    );
  } else {
    pushItem(
      "静局显期",
      "世应皆静，事情更像慢慢显形，先别追立刻翻面的时间点。"
    );
  }

  if (movingCount >= 4) {
    pushItem(
      "多动先乱后清",
      "动爻偏多，应期常先有连续波动，再慢慢筛出真正能留下的结果。"
    );
  }

  const buildHintText = (item) => {
    if (!item) {
      return defaultHint;
    }

    const nearText = item.nearLabel ? ` 近应日先看 ${item.nearLabel}。` : "";
    const farText = item.farLabel ? ` 远应月再看 ${item.farLabel}。` : "";

    return `${item.body}${nearText}${farText}`;
  };
  const summary = items.length
    ? items
        .slice(0, 3)
        .map((item, index) => (index === 0 ? buildHintText(item) : item.body))
        .join(" ")
    : defaultHint;

  return {
    hint: buildHintText(items[0]),
    items,
    primaryLabel: items[0] ? items[0].label : "常规显期",
    summary,
    timeline: buildTimingTimeline(items),
  };
}

function buildDecision(yongShenProfile, phase, movingCount) {
  if (!yongShenProfile.primary) {
    return {
      desc: "盘里暂时没有很亮的抓手，先回到世应和动爻本身，别急着要一个终局判断。",
      label: "先看再定",
    };
  }

  if (yongShenProfile.primary.source === "hidden") {
    return {
      desc: "用神伏而未透，事情不是完全没有机会，而是更依赖暗线成熟、消息落地或被压住的条件先浮出来。",
      label: yongShenProfile.primary.signalScore >= 2 ? "暗线待发" : "先等暗线",
    };
  }

  if (yongShenProfile.primary.signalScore >= 5) {
    return {
      desc: `用神落点偏强，${phase.label === "静卦" ? "可先稳步推进" : "可以顺势动，但别把节奏一次推满"}。`,
      label: "顺势而为",
    };
  }

  if (yongShenProfile.primary.signalScore >= 2) {
    return {
      desc: "关键条件可用，但还不到闭眼加码的时候，先做一轮小步验证最稳。",
      label: movingCount >= 3 ? "边动边看" : "小步试探",
    };
  }

  if (yongShenProfile.primary.isVoid || yongShenProfile.primary.signalScore < 0) {
    return {
      desc: "关键落点偏虚或受制，这时候更适合等信息补齐，而不是靠情绪硬推进。",
      label: "宜缓不宜急",
    };
  }

  return {
    desc: "事情不是完全不能动，而是先要把真正的承接条件找清楚。",
    label: "先稳后动",
  };
}

function buildTimingHint(changedHexagram, movingCount, yongShenProfile, timingProfile) {
  if (timingProfile && timingProfile.hint) {
    return timingProfile.hint;
  }

  return buildBaseTimingHint(changedHexagram, movingCount, yongShenProfile);
}

function buildReportSections(
  topic,
  originalHexagram,
  changedHexagram,
  phase,
  decision,
  timingHint,
  relationProfile,
  shiYingProfile,
  yongShenProfile,
  calendarContext,
  patternProfile,
  timingProfile
) {
  const sections = [
    {
      title: "卦身总看",
      body: `${originalHexagram.overview} 这题落在${relationProfile.palaceLabel}${relationProfile.palaceStage}，说明判断时要先按这个宫位的节奏来读，不宜只看一两句直觉反馈。`,
    },
    {
      title: "月日旬空",
      body: `起卦时在${calendarContext.monthPillar}月、${calendarContext.dayPillar}日，${calendarContext.xunLabel}${calendarContext.emptyLabel}，当前节气为${calendarContext.currentSolarTerm}。月建已按节气时刻切换，日辰看当天触发点，旬空则提醒你哪里看着有象，实际还没真正落地。`,
    },
    {
      title: "世应与六亲",
      body: `世爻落${relationProfile.shiLabel}，应爻落${relationProfile.yingLabel}。${shiYingProfile.summary} 当前盘里${relationProfile.dominantRelation}之气更显眼，表示事情会更容易卡在这类现实条件上。`,
    },
    {
      title: "用神提要",
      body: `${yongShenProfile.intro} ${yongShenProfile.verdictBody}`,
    },
    {
      title: "变卦去向",
      body: `${changedHexagram.overview} ${phase.body} ${decision.label}。${decision.desc} ${timingHint}`,
    },
  ];

  if (patternProfile.primaryLabel) {
    sections.splice(4, 0, {
      title: "反伏与进退",
      body: `${patternProfile.primaryLabel}。${patternProfile.summary} 动爻里的进退、反伏主要提醒你：事情不只看能不能动，还要看它是往前推、往回缩，还是一边走一边反复。`,
    });
  }

  if (timingProfile.items.length) {
    sections.splice(4, 0, {
      title: "应期细断",
      body: timingProfile.summary,
    });
  }

  return sections;
}

function buildPlateHighlights(
  formalLines,
  relationProfile,
  movingCount,
  calendarContext,
  patternProfile,
  shiYingProfile,
  timingProfile
) {
  return [
    `${relationProfile.palaceLabel}${relationProfile.palaceStage}`,
    `世在${relationProfile.shiLabel}`,
    shiYingProfile.relationLabel,
    `月建${calendarContext.monthPillar}`,
    `日辰${calendarContext.dayPillar}`,
    `旬空${calendarContext.emptyLabel}`,
    patternProfile.primaryLabel,
    timingProfile.primaryLabel !== "常规显期" ? timingProfile.primaryLabel : "",
    `动爻${movingCount}`,
  ].filter(Boolean);
}

function buildNextActions(topic, seed, yongShenProfile) {
  const nextActions = pickUnique(topic.actionHints, seed, 2, 10);

  if (yongShenProfile.primary) {
    if (yongShenProfile.primary.source === "hidden") {
      nextActions.unshift(`先围绕 ${yongShenProfile.primary.title} 对应的暗线去找证据，不要只看表面回应。`);
    } else {
      nextActions.unshift(`先围绕 ${yongShenProfile.primary.title} 去确认最关键的一条现实条件。`);
    }
  }

  return nextActions.slice(0, 3);
}

function buildSixYaoReading(topicId, question = "") {
  const topic = yaoTopics.find((item) => item.id === topicId) || yaoTopics[0];
  const now = new Date();
  const calendarContext = getCalendarContext(now);
  const lines = Array.from({ length: 6 }, (_, index) => {
    const toss = simulateLine();
    const meaning = lineMeanings[index];
    const type = lineTypeMap[toss.value];

    return {
      binary: valueToBinary(toss.value),
      changedBinary: valueToChangedBinary(toss.value),
      coins: toss.coins,
      isMoving: type.isMoving,
      isYang: type.isYang,
      marker: type.marker,
      position: index + 1,
      positionLabel: meaning.label,
      prompt: meaning.prompt,
      stage: meaning.stage,
      typeLabel: type.label,
      typeTone: type.tone,
      value: toss.value,
    };
  });
  const movingCount = lines.filter((line) => line.isMoving).length;
  const phase = getPhase(movingCount);
  const originalHexagram = buildHexagram(lines, false);
  const changedHexagram = buildHexagram(lines, true);
  const baseFormalLines = buildFormalLines(lines, originalHexagram, changedHexagram, calendarContext);
  const hiddenProfile = buildHiddenLines(baseFormalLines, originalHexagram, calendarContext);
  const formalLines = {
    ...baseFormalLines,
    hiddenLines: hiddenProfile.hiddenLines,
    rows: hiddenProfile.rows,
  };
  const relationProfile = buildRelationProfile(formalLines, topic, originalHexagram);
  const shiYingProfile = buildShiYingProfile(formalLines);
  const patternProfile = buildPatternProfile(formalLines);
  const yongShenProfile = buildYongShenProfile(formalLines, topic);
  const timingProfile = buildTimingProfile(
    formalLines,
    yongShenProfile,
    patternProfile,
    shiYingProfile,
    changedHexagram,
    movingCount,
    now
  );
  const decision = buildDecision(yongShenProfile, phase, movingCount);
  const timingHint = buildTimingHint(changedHexagram, movingCount, yongShenProfile, timingProfile);
  const seed = hashString(
    `${topic.id}-${question}-${calendarContext.dayPillar}-${lines.map((line) => line.value).join("")}-${movingCount}`
  );
  const movingLines = buildMovingLines(lines, topic, formalLines, seed);
  const reportSections = buildReportSections(
    topic,
    originalHexagram,
    changedHexagram,
    phase,
    decision,
    timingHint,
    relationProfile,
    shiYingProfile,
    yongShenProfile,
    calendarContext,
    patternProfile,
    timingProfile
  );

  return {
    calendar: calendarContext,
    calendarPanels: buildCalendarPanels(calendarContext, relationProfile),
    castLines: lines,
    changedHexagram,
    decision,
    formalLines,
    generatedAtLabel: formatDateTime(now),
    hasMovingLines: movingLines.length > 0,
    movingCount,
    movingLines,
    nextActions: buildNextActions(topic, seed, yongShenProfile),
    originalHexagram,
    overview: buildQuestionOverview(
      topic,
      question,
      originalHexagram,
      changedHexagram,
      phase,
      calendarContext
    ),
    patternProfile,
    phase,
    plateHighlights: buildPlateHighlights(
      formalLines,
      relationProfile,
      movingCount,
      calendarContext,
      patternProfile,
      shiYingProfile,
      timingProfile
    ),
    question: question || topic.prompt,
    relationProfile,
    reportSections,
    shiYingProfile,
    timingHint,
    timingProfile,
    topic,
    visualLines: formalLines.visualLines,
    yongShenProfile,
  };
}

module.exports = {
  buildSixYaoReading,
};
