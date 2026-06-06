import { CardStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { endOfToday, startOfToday } from "@/lib/dates";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { shuffleCards } from "@/lib/study";

function matchesStatus(card: {
  status: CardStatus;
  isMarked: boolean;
  isOmitted: boolean;
  incorrectCount: number;
  nextReviewAt: Date | null;
}, key: string) {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  if (key === "unused") return card.status === CardStatus.unused;
  if (key === "incorrect") return card.status === CardStatus.incorrect;
  if (key === "difficult") return card.incorrectCount > 0;
  if (key === "marked") return card.isMarked;
  if (key === "omitted") return card.isOmitted;
  if (key === "correct") return card.status === CardStatus.review || card.status === CardStatus.correct;
  if (key === "due") return card.nextReviewAt ? card.nextReviewAt >= todayStart && card.nextReviewAt <= todayEnd : false;
  if (key === "overdue") return card.nextReviewAt ? card.nextReviewAt < todayStart : false;
  return false;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const mode = "standard";
  const deckIds = Array.isArray(body?.deckIds) ? body.deckIds.map(String) : [];
  const filters = typeof body?.filters === "object" && body.filters ? body.filters : {};
  const filterKeys = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  const allCategorySelected = filterKeys.includes("all");
  const statusKeys = filterKeys.filter((key) => key !== "all");
  const limit = Math.max(0, Math.min(Number(body?.count ?? 20), 300));
  const includeOmitted = allCategorySelected || Boolean(body?.includeOmitted) || Boolean(filters.omitted);
  const includeCorrect = Boolean(body?.includeCorrect);
  const effectiveStatusKeys = includeCorrect && !statusKeys.includes("correct")
    ? [...statusKeys, "correct"]
    : statusKeys;
  const shouldShuffle = body?.shuffle !== false;
  const prioritizesDifficulty = !allCategorySelected && effectiveStatusKeys.includes("difficult");

  const prisma = getPrisma();
  const cards = await prisma.card.findMany({
    where: {
      ...(deckIds.length > 0 ? { deckId: { in: deckIds } } : {}),
    },
    orderBy: prioritizesDifficulty
      ? [{ incorrectCount: "desc" }, { reviewCount: "desc" }, { nextReviewAt: "asc" }, { createdAt: "asc" }]
      : [{ nextReviewAt: "asc" }, { createdAt: "asc" }],
  });

  const selected = cards.filter((card) => {
    if (allCategorySelected) return true;
    if (!includeOmitted && card.isOmitted) return false;
    if (effectiveStatusKeys.length === 0) return false;
    return effectiveStatusKeys.some((key) => matchesStatus(card, key));
  });

  const limitedCards = prioritizesDifficulty ? selected.slice(0, limit) : selected;
  const finalCards = (shouldShuffle ? shuffleCards(limitedCards) : limitedCards).slice(0, limit);

  if (finalCards.length === 0) {
    return NextResponse.json({ error: "No cards match this selection." }, { status: 400 });
  }

  const session = await prisma.studySession.create({
    data: {
      mode,
      deckIds,
      filters: {
        ...filters,
        includeOmitted,
        includeCorrect,
        shuffle: shouldShuffle,
        direction: body?.direction ?? "front-back",
      },
      cardIds: finalCards.map((card) => card.id),
      cardCount: finalCards.length,
    },
  });

  return NextResponse.json({ sessionId: session.id, cardCount: session.cardCount });
}
