import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const prisma = getPrisma();

  const session = await prisma.studySession.findUnique({
    where: { id },
    select: {
      mode: true,
      deckIds: true,
      filters: true,
      cardIds: true,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Study session not found." }, { status: 404 });
  }

  const existingCards = await prisma.card.findMany({
    where: { id: { in: session.cardIds } },
    select: { id: true },
  });
  const existingCardIds = new Set(existingCards.map((card) => card.id));
  const cardIds = session.cardIds.filter((cardId) => existingCardIds.has(cardId));

  if (cardIds.length === 0) {
    return NextResponse.json({ error: "No cards from this test are still available." }, { status: 400 });
  }

  const newSession = await prisma.studySession.create({
    data: {
      mode: session.mode,
      deckIds: session.deckIds,
      filters: (session.filters ?? {}) as Prisma.InputJsonValue,
      cardIds,
      cardCount: cardIds.length,
    },
    select: {
      id: true,
      cardCount: true,
    },
  });

  return NextResponse.json({
    sessionId: newSession.id,
    cardCount: newSession.cardCount,
  });
}
