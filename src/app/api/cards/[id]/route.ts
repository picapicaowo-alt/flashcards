import { CardStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function serializeCard(card: {
  front: string;
  back: string;
  status: CardStatus;
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const prisma = getPrisma();

  const data: Record<string, unknown> = {};

  if (typeof body?.front === "string") data.front = body.front.trim();
  if (typeof body?.back === "string") data.back = body.back.trim();
  if (typeof body?.isMarked === "boolean") data.isMarked = body.isMarked;
  if (typeof body?.isOmitted === "boolean") data.isOmitted = body.isOmitted;

  if (body?.resetProgress === true) {
    Object.assign(data, {
      status: CardStatus.unused,
      correctCount: 0,
      incorrectCount: 0,
      reviewCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      intervalDays: 0,
      easeFactor: 2.5,
    });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid changes supplied." }, { status: 400 });
  }

  const card = await prisma.card.update({
    where: { id },
    data,
    select: {
      front: true,
      back: true,
      status: true,
      isMarked: true,
      isOmitted: true,
      correctCount: true,
      incorrectCount: true,
      reviewCount: true,
      nextReviewAt: true,
    },
  });

  return NextResponse.json({ card: serializeCard(card) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const prisma = getPrisma();
  await prisma.card.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
