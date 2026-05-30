import { Card, CardStatus, ReviewResult } from "@prisma/client";
import { addDays, startOfToday } from "@/lib/dates";

type SchedulingInput = Pick<
  Card,
  | "status"
  | "isOmitted"
  | "correctCount"
  | "incorrectCount"
  | "reviewCount"
  | "intervalDays"
  | "easeFactor"
  | "lastReviewedAt"
  | "nextReviewAt"
>;

export function applyReviewResult(card: SchedulingInput, result: ReviewResult, now = new Date()) {
  if (result === "omitted") {
    return {
      status: card.status,
      isOmitted: true,
      correctCount: card.correctCount,
      incorrectCount: card.incorrectCount,
      reviewCount: card.reviewCount,
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      lastReviewedAt: card.lastReviewedAt,
      nextReviewAt: card.nextReviewAt,
    };
  }

  if (result === "wrong") {
    return {
      status: CardStatus.incorrect,
      isOmitted: card.isOmitted,
      correctCount: card.correctCount,
      incorrectCount: card.incorrectCount + 1,
      reviewCount: card.reviewCount + 1,
      intervalDays: 0,
      easeFactor: Math.max(card.easeFactor - 0.2, 1.3),
      lastReviewedAt: now,
      nextReviewAt: addDays(startOfToday(now), 1),
    };
  }

  const nextInterval =
    card.reviewCount === 0
      ? 1
      : card.correctCount === 1
        ? 3
        : Math.max(1, Math.round(card.intervalDays * card.easeFactor));

  return {
    status: CardStatus.review,
    isOmitted: card.isOmitted,
    correctCount: card.correctCount + 1,
    incorrectCount: card.incorrectCount,
    reviewCount: card.reviewCount + 1,
    intervalDays: nextInterval,
    easeFactor: Math.min(card.easeFactor + 0.05, 3.0),
    lastReviewedAt: now,
    nextReviewAt: addDays(startOfToday(now), nextInterval),
  };
}

export function shuffleCards<T>(cards: T[]) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
