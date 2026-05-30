export type ParsedMarkdownCard = {
  front: string;
  back: string;
};

export type ParseMarkdownTableResult = {
  cards: ParsedMarkdownCard[];
  error?: string;
};

function splitMarkdownRow(line: string) {
  const trimmed = line.trim();
  const body = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutEnd = body.endsWith("|") ? body.slice(0, -1) : body;
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of withoutEnd) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isSeparatorRow(cells: string[]) {
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

export function parseMarkdownTable(input: string): ParseMarkdownTableResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));

  if (lines.length < 3) {
    return { cards: [], error: "Paste a Markdown table with a header, separator row, and at least one card row." };
  }

  const rows = lines.map(splitMarkdownRow).filter((cells) => cells.length >= 2);
  const separatorIndex = rows.findIndex(isSeparatorRow);

  if (separatorIndex === -1) {
    return { cards: [], error: "Could not find the Markdown table separator row, for example: | --- | --- |." };
  }

  const header = rows[separatorIndex - 1] ?? rows[0];
  if (header.length < 2) {
    return { cards: [], error: "The table must have at least two columns." };
  }

  const cards = rows
    .slice(separatorIndex + 1)
    .map((cells) => ({
      front: cells[0]?.trim() ?? "",
      back: cells[1]?.trim() ?? "",
    }))
    .filter((card) => card.front.length > 0 && card.back.length > 0);

  if (cards.length === 0) {
    return { cards: [], error: "No valid card rows were found. Each row needs a front and a back value." };
  }

  return { cards };
}

export function stripMarkdownLite(input: string) {
  return input
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .trim();
}
