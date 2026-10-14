const {
  blessings,
  drawModes,
  drawTopics,
  energyWords,
  focusThemes,
  homeQuotes,
  lotPool,
  luckyColors,
  luckyDirections,
} = require("./content");

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hashString(input) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
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
    const token = typeof candidate === "string" ? candidate : JSON.stringify(candidate);

    if (!used.has(token)) {
      used.add(token);
      result.push(candidate);
    }

    cursor += 1;
  }

  return result;
}

function numberFromSeed(seed, min, max, offset = 0) {
  const size = max - min + 1;

  return min + ((seed + offset * 101) % size);
}

function createHomeHighlight(date = new Date()) {
  const seed = hashString(`home-${getDateKey(date)}`);
  const quote = pick(homeQuotes, seed);

  return {
    quote: quote.quote,
    source: quote.source,
    focus: pick(focusThemes, seed, 1),
    color: pick(luckyColors, seed, 2),
    luckyTime: `${numberFromSeed(seed, 7, 11, 3)}:${numberFromSeed(seed, 0, 1, 4) ? "18" : "48"}`,
    energy: pick(energyWords, seed, 5),
  };
}

function drawLot(topicId = "love", modeId = "observe", date = new Date()) {
  const topic = drawTopics.find((item) => item.id === topicId) || drawTopics[0];
  const mode = drawModes.find((item) => item.id === modeId) || drawModes[0];
  const randomKey = `${getDateKey(date)}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${Math.floor(Math.random() * 1000)}`;
  const seed = hashString(`lot-${topic.id}-${mode.id}-${randomKey}`);
  return buildLot(topic, mode, seed);
}

function drawDailyLot(date = new Date()) {
  const dailyDate = getDateKey(date);
  const topic = drawTopics.find((item) => item.id === "self");
  const mode = drawModes.find((item) => item.id === "observe");
  return { ...buildLot(topic, mode, hashString(`daily-${dailyDate}`)), dailyDate };
}

function buildLot(topic, mode, seed) {
  const selectedLot = pick(lotPool, seed);
  const actionHints = pickUnique(topic.actions, seed, 2, 7);
  const resultTags = Array.from(new Set(selectedLot.keywords.concat(topic.keywords))).slice(0, 4);

  return {
    ...selectedLot,
    blessing: pick(blessings, seed, 1),
    luckyMoment: `${numberFromSeed(seed, 13, 21, 2)}:${numberFromSeed(seed, 0, 1, 3) ? "16" : "42"}`,
    intensity: numberFromSeed(seed, 68, 96, 4),
    insight: pick(topic.insights, seed, 5),
    avoid: `${pick(topic.avoids, seed, 6)} ${mode.caution}`,
    ritual: `${pick(topic.rituals, seed, 7)} ${mode.ritual}`,
    supportColor: pick(luckyColors, seed, 8),
    supportDirection: pick(luckyDirections, seed, 9),
    resonance: numberFromSeed(seed, 72, 98, 10),
    resultTags,
    nextActions: [actionHints[0], mode.guidance, actionHints[1]],
    topic: {
      cue: topic.cue,
      id: topic.id,
      label: topic.label,
      prompt: topic.prompt,
    },
    mode: {
      desc: mode.desc,
      id: mode.id,
      label: mode.label,
    },
    meters: topic.meterLabels.map((label, index) => ({
      label,
      score: numberFromSeed(seed, 63, 97, 11 + index),
    })),
  };
}

module.exports = {
  createHomeHighlight,
  drawDailyLot,
  drawLot,
  getDateKey,
};
