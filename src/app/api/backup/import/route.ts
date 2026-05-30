import { NextResponse } from "next/server";
import { CardStatus, ReviewResult } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function asArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function dateOrNull(value: unknown) {
  return value ? new Date(String(value)) : null;
}

function cardStatus(value: unknown) {
  return Object.values(CardStatus).includes(value as CardStatus) ? (value as CardStatus) : CardStatus.unused;
}

function reviewResult(value: unknown) {
  return Object.values(ReviewResult).includes(value as ReviewResult) ? (value as ReviewResult) : ReviewResult.wrong;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid backup JSON." }, { status: 400 });
  }

  const prisma = getPrisma();
  const decks = asArray(body.decks);
  const tags = asArray(body.tags);
  const cards = asArray(body.cards);
  const cardTags = asArray(body.cardTags);
  const sessions = asArray(body.studySessions);
  const reviewLogs = asArray(body.reviewLogs);

  const result = await prisma.$transaction(async (tx) => {
    const deckMap = new Map<string, string>();
    const tagMap = new Map<string, string>();
    const cardMap = new Map<string, string>();
    const sessionMap = new Map<string, string>();
    let skippedCards = 0;
    let deckCount = 0;
    let tagCount = 0;
    let cardCount = 0;
    let sessionCount = 0;
    let reviewLogCount = 0;

    for (const deck of decks) {
      const id = String(deck.id ?? "");
      const name = String(deck.name ?? "").trim();
      if (!id || !name) continue;
      const saved = await tx.deck.upsert({
        where: { name },
        update: {
          description: typeof deck.description === "string" ? deck.description : undefined,
          lessonDate: dateOrNull(deck.lessonDate),
        },
        create: {
          id,
          name,
          description: typeof deck.description === "string" ? deck.description : null,
          lessonDate: dateOrNull(deck.lessonDate),
        },
      });
      deckMap.set(id, saved.id);
      deckCount += 1;
    }

    for (const tag of tags) {
      const id = String(tag.id ?? "");
      const name = String(tag.name ?? "").trim();
      if (!id || !name) continue;
      const saved = await tx.tag.upsert({
        where: { name },
        update: {},
        create: { id, name },
      });
      tagMap.set(id, saved.id);
      tagCount += 1;
    }

    for (const card of cards) {
      const id = String(card.id ?? "");
      const deckId = deckMap.get(String(card.deckId ?? ""));
      const front = String(card.front ?? "").trim();
      const back = String(card.back ?? "").trim();
      if (!id || !deckId || !front || !back) continue;

      const duplicate = await tx.card.findUnique({
        where: { deckId_front_back: { deckId, front, back } },
      });

      if (duplicate) {
        cardMap.set(id, duplicate.id);
        skippedCards += 1;
        continue;
      }

      const saved = await tx.card.create({
        data: {
          id,
          deckId,
          front,
          back,
          status: cardStatus(card.status),
          isMarked: Boolean(card.isMarked),
          isOmitted: Boolean(card.isOmitted),
          correctCount: Number(card.correctCount ?? 0),
          incorrectCount: Number(card.incorrectCount ?? 0),
          reviewCount: Number(card.reviewCount ?? 0),
          lastReviewedAt: dateOrNull(card.lastReviewedAt),
          nextReviewAt: dateOrNull(card.nextReviewAt),
          intervalDays: Number(card.intervalDays ?? 0),
          easeFactor: Number(card.easeFactor ?? 2.5),
        },
      });
      cardMap.set(id, saved.id);
      cardCount += 1;
    }

    for (const relation of cardTags) {
      const cardId = cardMap.get(String(relation.cardId ?? ""));
      const tagId = tagMap.get(String(relation.tagId ?? ""));
      if (!cardId || !tagId) continue;
      await tx.cardTag.upsert({
        where: { cardId_tagId: { cardId, tagId } },
        update: {},
        create: { cardId, tagId },
      });
    }

    for (const session of sessions) {
      const id = String(session.id ?? "");
      if (!id) continue;
      const existing = await tx.studySession.findUnique({ where: { id } });
      if (existing) {
        sessionMap.set(id, existing.id);
        continue;
      }
      await tx.studySession.create({
        data: {
          id,
          mode: String(session.mode ?? "imported"),
          deckIds: asArray<string>(session.deckIds).map((deckId) => deckMap.get(String(deckId)) ?? String(deckId)),
          filters: typeof session.filters === "object" && session.filters ? session.filters : {},
          cardIds: asArray<string>(session.cardIds).map((cardId) => cardMap.get(String(cardId)) ?? String(cardId)),
          cardCount: Number(session.cardCount ?? 0),
          correctCount: Number(session.correctCount ?? 0),
          wrongCount: Number(session.wrongCount ?? 0),
          omittedCount: Number(session.omittedCount ?? 0),
          startedAt: dateOrNull(session.startedAt) ?? new Date(),
          completedAt: dateOrNull(session.completedAt),
        },
      });
      sessionMap.set(id, id);
      sessionCount += 1;
    }

    for (const log of reviewLogs) {
      const id = String(log.id ?? "");
      const cardId = cardMap.get(String(log.cardId ?? ""));
      if (!id || !cardId) continue;
      const existing = await tx.reviewLog.findUnique({ where: { id } });
      if (existing) continue;
      await tx.reviewLog.create({
        data: {
          id,
          cardId,
          sessionId: log.sessionId ? (sessionMap.get(String(log.sessionId)) ?? null) : null,
          result: reviewResult(log.result),
          reviewedAt: dateOrNull(log.reviewedAt) ?? new Date(),
          previousIntervalDays: Number(log.previousIntervalDays ?? 0),
          newIntervalDays: Number(log.newIntervalDays ?? 0),
          previousEaseFactor: Number(log.previousEaseFactor ?? 2.5),
          newEaseFactor: Number(log.newEaseFactor ?? 2.5),
          previousStatus: cardStatus(log.previousStatus),
          previousIsOmitted: Boolean(log.previousIsOmitted),
          previousCorrectCount: Number(log.previousCorrectCount ?? 0),
          previousIncorrectCount: Number(log.previousIncorrectCount ?? 0),
          previousReviewCount: Number(log.previousReviewCount ?? 0),
          previousNextReviewAt: dateOrNull(log.previousNextReviewAt),
          previousLastReviewedAt: dateOrNull(log.previousLastReviewedAt),
        },
      });
      reviewLogCount += 1;
    }

    return {
      decks: deckCount,
      tags: tagCount,
      cards: cardCount,
      skippedCards,
      sessions: sessionCount,
      reviewLogs: reviewLogCount,
    };
  });

  return NextResponse.json(result);
}
