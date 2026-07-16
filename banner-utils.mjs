export function normalizeHex(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(raw)) return raw;
  if (/^[0-9A-F]{6}$/.test(raw)) return `#${raw}`;
  if (/^#[0-9A-F]{3}$/.test(raw)) {
    return `#${raw
      .slice(1)
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`;
  }
  if (/^[0-9A-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`;
  }
  return null;
}

export function cleanEditableText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function wrapLine(line, measure, maxWidth) {
  if (!line) return [""];
  if (measure(line) <= maxWidth) return [line];

  const words = line.split(/\s+/);
  const wrapped = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) wrapped.push(current);

    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }

    let fragment = "";
    for (const character of word) {
      const candidateFragment = fragment + character;
      if (fragment && measure(candidateFragment) > maxWidth) {
        wrapped.push(fragment);
        fragment = character;
      } else {
        fragment = candidateFragment;
      }
    }
    current = fragment;
  }

  if (current || wrapped.length === 0) wrapped.push(current);
  return wrapped;
}

export function wrapText(text, measure, maxWidth) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((line) => wrapLine(line, measure, maxWidth));
}
