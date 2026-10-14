const knowledgeData = require("./hexagram-knowledge-data");
const { hexagramMap } = require("./yao-data");

function getHexagramKnowledge(hexagramId) {
  const knowledge = knowledgeData[hexagramId];
  const meta = hexagramMap[hexagramId];
  return knowledge && meta ? { ...knowledge, title: meta.title } : null;
}

module.exports = { getHexagramKnowledge };
