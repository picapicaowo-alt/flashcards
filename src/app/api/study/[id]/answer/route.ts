import { ReviewResult } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { applyReviewResult } from "@/lib/study";

function isReviewResult(value: unknown): value is ReviewResult {
  return value === ReviewResult.correct || value === ReviewResult.wrong || value === ReviewResult.omitted;
}

function serializeCard(card: {
  status: string;
  isMarked: boolean;
  isOmitted: boolean;
  correctCount: number;
  incorrectCount: number;
  reviewCount: number;
  nextReviewAt: Date | null;
}) {
  return {
    ...card,
    nextReviewAt: card.nextReviewAt?.toISOString() ?? null,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id: sessionId } = await params;
  const body = await request.json().catch(() => null);
  const cardId = String(body?.cardId ?? "");
  const result = body?.result;

  if (!cardId || !isReviewResult(result)) {
    return NextResponse.json({ error: "cardId and result are required." }, { status: 400 });
  }

  const prisma = getPrisma();
  const now = new Date();

  const saved = await prisma.$transaction(async (tx) => {
    const session = await tx.studySession.findUnique({ where: { id: sessionId } });
    if (!session || !session.cardIds.includes(cardId)) {
      throw new Error("Card is not part of this session.");
    }

    const currentCard = await tx.card.findUnique({ where: { id: cardId } });
    if (!currentCard) {
      throw new Error("Card not found.");
    }

    const existingLog = await tx.reviewLog.findFirst({
      where: { sessionId, cardId },
      orderBy: { createdAt: "desc" },
    });

    const baseCard = existingLog
      ? {
          ...currentCard,
          status: existingLog.previousStatus,
          isOmitted: existingLog.previousIsOmitted,
          correctCount: existingLog.previousCorrectCount,
          incorrectCount: existingLog.previousIncorrectCount,
          reviewCount: existingLog.previousReviewCount,
          intervalDays: existingLog.previousIntervalDays,
          easeFactor: existingLog.previousEaseFactor,
          nextReviewAt: existingLog.previousNextReviewAt,
          lastReviewedAt: existingLog.previousLastReviewedAt,
        }
      : currentCard;

    const next = applyReviewResult(baseCard, result, now);

    const updatedCard = await tx.card.update({
      where: { id: cardId },
      data: next,
      select: {
        status: true,
        isMarked: true,
        isOmitted: true,
        correctCount: true,
        incorrectCount: true,
        reviewCount: true,
        nextReviewAt: true,
      },
    });

    const logData = {
      result,
      reviewedAt: now,
      previousIntervalDays: baseCard.intervalDays,
      newIntervalDays: next.intervalDays,
      previousEaseFactor: baseCard.easeFactor,
      newEaseFactor: next.easeFactor,
      previousStatus: baseCard.status,
      previousIsOmitted: baseCard.isOmitted,
      previousCorrectCount: baseCard.correctCount,
      previousIncorrectCount: baseCard.incorrectCount,
      previousReviewCount: baseCard.reviewCount,
      previousNextReviewAt: baseCard.nextReviewAt,
      previousLastReviewedAt: baseCard.lastReviewedAt,
    };

    if (existingLog) {
      await tx.reviewLog.update({
        where: { id: existingLog.id },
        data: logData,
      });
    } else {
      await tx.reviewLog.create({
        data: {
          ...logData,
          cardId,
          sessionId,
        },
      });
    }

    const logs = await tx.reviewLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: { cardId: true, result: true },
    });
    const latestResults = new Map(logs.map((log) => [log.cardId, log.result]));
    const results = Array.from(latestResults.values());
    const answeredCount = latestResults.size;
    const correctCount = results.filter((result) => result === ReviewResult.correct).length;
    const wrongCount = results.filter((result) => result === ReviewResult.wrong).length;
    const omittedCount = results.filter((result) => result === ReviewResult.omitted).length;
    const playableCardCount = await tx.card.count({
      where: { id: { in: session.cardIds } },
    });
    const completionTarget = Math.max(1, Math.min(session.cardCount, session.cardIds.length, playableCardCount));

    const updatedSession = await tx.studySession.update({
      where: { id: sessionId },
      data: {
        correctCount,
        wrongCount,
        omittedCount,
        completedAt: answeredCount >= completionTarget ? (session.completedAt ?? now) : null,
      },
      select: {
        id: true,
        cardCount: true,
        correctCount: true,
        wrongCount: true,
        omittedCount: true,
        completedAt: true,
      },
    });

    return {
      card: serializeCard(updatedCard),
      result,
      session: {
        ...updatedSession,
        answeredCount,
        completedAt: updatedSession.completedAt?.toISOString() ?? null,
      },
    };
  });

  return NextResponse.json(saved);
}
