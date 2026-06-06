import { ReviewResult } from "@prisma/client";

type ReviewLogSummary = {
  cardId: string;
  result: ReviewResult;
};

const filterLabels: Record<string, string> = {
  all: "All",
  unused: "Unused",
  incorrect: "Incorrect",
  difficult: "Most difficult",
  marked: "Marked",
  omitted: "Omitted",
  correct: "Correct",
  due: "Due",
  overdue: "Overdue",
};

const modeLabels: Record<string, string> = {
  standard: "Standard",
  due: "Due Cards",
  wrong: "Wrong Bank",
  marked: "Marked",
  random: "Random Mix",
};

export function summarizeReviewLogs(logs: ReviewLogSummary[]) {
  const latestResults = new Map(logs.map((log) => [log.cardId, log.result]));
  const results = Array.from(latestResults.values());

  return {
    answeredCount: latestResults.size,
    correctCount: results.filter((result) => result === ReviewResult.correct).length,
    wrongCount: results.filter((result) => result === ReviewResult.wrong).length,
    omittedCount: results.filter((result) => result === ReviewResult.omitted).length,
    latestResults,
  };
}

export function scorePercent(correctCount: number, wrongCount: number) {
  const gradedCount = correctCount + wrongCount;
  return gradedCount === 0 ? 0 : Math.round((correctCount / gradedCount) * 100);
}

export function formatScore(correctCount: number, wrongCount: number) {
  return `${scorePercent(correctCount, wrongCount)}%`;
}

export function formatStudyMode(mode: string) {
  return modeLabels[mode] ?? mode;
}

export function formatQuestionPool(filters: unknown) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return "Default";
  }

  const values = filters as Record<string, unknown>;
  const activeFilters = Object.entries(values)
    .filter(([key, value]) => Boolean(value) && key in filterLabels)
    .map(([key]) => filterLabels[key]);

  if (activeFilters.length > 0) return activeFilters.join(", ");
  if (values.includeCorrect) return "All";
  return "Default";
}

export function formatDeckLabel(deckIds: string[], deckNames: Map<string, string>) {
  if (deckIds.length === 0) return "All";
  const names = deckIds.map((id) => deckNames.get(id)).filter(Boolean);
  if (names.length === 0) return "Unknown";
  if (names.length === 1) return names[0]!;
  return "Multiple";
}

export function formatDeckList(deckIds: string[], deckNames: Map<string, string>) {
  if (deckIds.length === 0) return "All";
  const names = deckIds.map((id) => deckNames.get(id)).filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Unknown";
}
