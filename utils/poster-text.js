function splitText(text, maxChars = 18, maxLines = 3) {
  const safeText = `${text || ""}`.trim();

  if (!safeText) {
    return [];
  }

  const result = [];
  let currentLine = "";

  for (let index = 0; index < safeText.length; index += 1) {
    const char = safeText[index];

    if (char === "\n") {
      if (currentLine) {
        result.push(currentLine);
        currentLine = "";
      }
    } else {
      currentLine += char;
    }

    if (currentLine.length >= maxChars) {
      result.push(currentLine);
      currentLine = "";
    }

    if (result.length >= maxLines) {
      break;
    }
  }

  if (currentLine && result.length < maxLines) {
    result.push(currentLine);
  }

  if (result.length === maxLines && safeText.length > result.join("").length) {
    result[maxLines - 1] = `${result[maxLines - 1].slice(0, Math.max(maxChars - 1, 1))}…`;
  }

  return result;
}

function fillParagraph(ctx, text, x, y, options = {}) {
  const {
    color = "#503528",
    fontSize = 24,
    lineHeight = 34,
    maxChars = 18,
    maxLines = 3,
  } = options;
  const lines = splitText(text, maxChars, maxLines);

  ctx.setFillStyle(color);
  ctx.setFontSize(fontSize);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return y + lines.length * lineHeight;
}

module.exports = { fillParagraph };
