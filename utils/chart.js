const {
  elementDescriptors,
  houseDefinitions,
  planets,
  zodiacSigns,
} = require("./chart-data");

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function hashString(input) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function numberFromSeed(seed, min, max, offset = 0) {
  const size = max - min + 1;

  return min + ((seed + offset * 97) % size);
}

function normalizeRegion(region) {
  if (Array.isArray(region) && region.length) {
    return [region[0] || "", region[1] || "", region[2] || ""];
  }

  return ["北京市", "北京市", "朝阳区"];
}

function formatRegion(region) {
  return normalizeRegion(region).filter(Boolean).join(" · ");
}

function getSignIndex(signId) {
  return zodiacSigns.findIndex((item) => item.id === signId);
}

function getSignByIndex(index) {
  const normalizedIndex = ((index % zodiacSigns.length) + zodiacSigns.length) % zodiacSigns.length;

  return zodiacSigns[normalizedIndex];
}

function getSignByName(name) {
  return zodiacSigns.find((item) => item.name === name || item.short === name) || zodiacSigns[0];
}

function getSunSign(dateString) {
  const monthDay = dateString.slice(5);

  return (
    zodiacSigns.find((sign) => {
      if (sign.start <= sign.end) {
        return monthDay >= sign.start && monthDay <= sign.end;
      }

      return monthDay >= sign.start || monthDay <= sign.end;
    }) || zodiacSigns[0]
  );
}

function getHouseDefinition(index) {
  return houseDefinitions[index - 1] || houseDefinitions[0];
}

function buildDefaultProfile() {
  return {
    birthDate: "1998-08-18",
    birthTime: "21:30",
    birthRegion: ["北京市", "北京市", "朝阳区"],
  };
}

function buildBirthSummary(profile) {
  return `${profile.birthDate} ${profile.birthTime} · ${formatRegion(profile.birthRegion)}`;
}

function adjacentSign(baseSign, seed, spread, offset) {
  const baseIndex = getSignIndex(baseSign.id);
  const delta = ((seed + offset * 19) % (spread * 2 + 1)) - spread;

  return getSignByIndex(baseIndex + delta);
}

function createWheelPosition(angleDeg, radiusPercent) {
  const rad = (angleDeg * Math.PI) / 180;
  const left = 50 + Math.cos(rad) * radiusPercent;
  const top = 50 + Math.sin(rad) * radiusPercent;

  return `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;`;
}

function buildWheelHouses() {
  return houseDefinitions.map((house, index) => {
    const angle = -90 + index * 30;

    return {
      id: house.id,
      label: `${house.id}`,
      style: `${createWheelPosition(angle, 43)}transform:translate(-50%, -50%);`,
      title: house.title,
    };
  });
}

function buildPlacements(profile, seed) {
  const sun = getSunSign(profile.birthDate);
  const birthHour = Number(profile.birthTime.split(":")[0] || 0);
  const minuteBucket = Number(profile.birthTime.split(":")[1] || 0) >= 30 ? 1 : 0;
  const regionText = formatRegion(profile.birthRegion);
  const regionSeed = hashString(regionText);
  const moon = getSignByIndex((getSignIndex(sun.id) + ((seed + birthHour) % 12)) % 12);
  const rising = getSignByIndex((regionSeed + birthHour * 3 + minuteBucket * 5) % 12);

  const placementBlueprint = [
    { id: "sun", sign: sun },
    { id: "moon", sign: moon },
    { id: "asc", sign: rising },
    { id: "mercury", sign: adjacentSign(sun, seed, 1, 1) },
    { id: "venus", sign: adjacentSign(sun, seed, 2, 2) },
    { id: "mars", sign: getSignByIndex((seed + 5) % 12) },
    { id: "jupiter", sign: getSignByIndex((seed + birthHour + 8) % 12) },
    { id: "saturn", sign: getSignByIndex((regionSeed + 11) % 12) },
  ];

  return placementBlueprint.map((item, index) => {
    const planet = planets.find((planetItem) => planetItem.id === item.id) || planets[0];
    const houseIndex = numberFromSeed(seed, 1, 12, index + 1);
    const house = getHouseDefinition(houseIndex);

    return {
      id: planet.id,
      label: planet.label,
      short: planet.short,
      meaning: planet.meaning,
      sign: item.sign,
      house,
      description: `${planet.label}落在${item.sign.name}的${house.label}，会让你的${planet.meaning}带上“${item.sign.vibe}”的味道，并在${house.title}领域更容易被看见。`,
    };
  });
}

function buildElementSummary(placements) {
  const counts = placements.reduce((result, placement) => {
    const nextResult = result;
    nextResult[placement.sign.element] = (nextResult[placement.sign.element] || 0) + 1;
    return nextResult;
  }, {});

  return Object.keys(elementDescriptors).map((element) => {
    const count = counts[element] || 0;

    return {
      count,
      desc: elementDescriptors[element],
      element,
      percent: Math.round((count / placements.length) * 100),
    };
  });
}

function buildWheelPlanets(placements, seed) {
  const placementOffsets = {};

  return placements.map((placement, index) => {
    const houseKey = placement.house.id;
    const currentOffset = placementOffsets[houseKey] || 0;
    placementOffsets[houseKey] = currentOffset + 1;

    const angle = -90 + (placement.house.id - 1) * 30 + currentOffset * 7 + (seed % 5);
    const radius = 28 + currentOffset * 4;

    return {
      id: placement.id,
      label: placement.short,
      signShort: placement.sign.short,
      style: `${createWheelPosition(angle, radius)}transform:translate(-50%, -50%);`,
      zIndex: placements.length - index,
    };
  });
}

function buildFocusHouses(placements, seed) {
  const scoreMap = houseDefinitions.map((house, index) => ({
    house,
    score: placements.filter((placement) => placement.house.id === house.id).length * 10 + ((seed + index * 13) % 7),
  }));

  return scoreMap
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ house }) => {
      const housePlacements = placements
        .filter((placement) => placement.house.id === house.id)
        .map((placement) => placement.label)
        .join("、");

      return {
        body: housePlacements
          ? `这张盘里 ${housePlacements} 都把能量投向这里，所以 ${house.title} 会是你最近很容易有感觉、也很容易起波动的领域。`
          : `即使没有很多行星集中，这个宫位依然会成为你此阶段需要主动留意的生活主题。`,
        label: house.label,
        title: house.title,
        desc: house.desc,
      };
    });
}

function buildCoreSections(coreMap, dominantElement, focusHouses) {
  const { asc, moon, sun, venus, mars, saturn } = coreMap;

  return [
    {
      title: "人格底色",
      body: `你的太阳在${sun.sign.name}，说明核心驱动力偏向“${sun.sign.vibe}”；上升在${asc.sign.name}，会让别人先感受到你“${asc.sign.vibe}”的一面。整体来看，这张盘的主导元素是${dominantElement.element}，意味着你更容易通过${dominantElement.desc}`,
    },
    {
      title: "情绪与关系",
      body: `月亮在${moon.sign.name}，代表你在情绪上需要被怎样对待；金星在${venus.sign.name}，会让你在关系里更偏向${venus.sign.relation}。如果最近你在亲密关系里容易敏感，那通常不是你想太多，而是你真的需要更清楚的回应。`,
    },
    {
      title: "事业与推进",
      body: `火星在${mars.sign.name}，行动风格偏向“${mars.sign.vibe}”；再加上 ${focusHouses[0].label} ${focusHouses[0].title} 被点亮，你做事时会更在意这件事是不是足够值得、是不是能真正往前推进。`,
    },
    {
      title: "成长课题",
      body: `土星在${saturn.sign.name}，说明你的边界感和责任课题会以“${saturn.sign.vibe}”的方式出现。它不一定轻松，但会逼着你把模糊的部分慢慢长成自己的秩序。`,
    },
  ];
}

function buildNextActions(coreMap, dominantElement, focusHouses) {
  return [
    `最近先把注意力放回 ${focusHouses[0].title}，这里最容易出现真正影响你状态的信号。`,
    `当你犹豫时，优先选择更符合${dominantElement.element}节奏的处理方式，不要强逼自己用完全相反的节拍做决定。`,
    `如果关系或工作里出现卡顿，回看 ${coreMap.moon.sign.name} 月亮和 ${coreMap.mars.sign.name} 火星的组合提示，先处理情绪需求，再处理推进动作。`,
  ];
}

function buildBirthChart(profileInput) {
  const profile = {
    birthDate: profileInput.birthDate || buildDefaultProfile().birthDate,
    birthTime: profileInput.birthTime || buildDefaultProfile().birthTime,
    birthRegion: normalizeRegion(profileInput.birthRegion),
  };
  const seed = hashString(`${profile.birthDate}-${profile.birthTime}-${formatRegion(profile.birthRegion)}`);
  const placements = buildPlacements(profile, seed);
  const coreMap = placements.reduce((result, placement) => {
    const nextResult = result;
    nextResult[placement.id] = placement;
    return nextResult;
  }, {});
  const elementSummary = buildElementSummary(placements);
  const dominantElement =
    elementSummary.sort((left, right) => right.count - left.count)[0] || elementSummary[0];
  const focusHouses = buildFocusHouses(placements, seed);

  return {
    birthSummary: buildBirthSummary(profile),
    corePlacements: [coreMap.sun, coreMap.moon, coreMap.asc].map((placement) => ({
      label: placement.label,
      sign: placement.sign.name,
      short: placement.sign.short,
      vibe: placement.sign.vibe,
    })),
    dominantElement,
    elementSummary,
    focusHouses,
    introLine: `太阳${coreMap.sun.sign.short}、月亮${coreMap.moon.sign.short}、上升${coreMap.asc.sign.short}`,
    nextActions: buildNextActions(coreMap, dominantElement, focusHouses),
    placements,
    profile,
    reportSections: buildCoreSections(coreMap, dominantElement, focusHouses),
    wheelHouses: buildWheelHouses(),
    wheelPlanets: buildWheelPlanets(placements, seed),
  };
}

module.exports = {
  buildBirthChart,
  buildBirthSummary,
  buildDefaultProfile,
  formatRegion,
  getSignByName,
  normalizeRegion,
};
