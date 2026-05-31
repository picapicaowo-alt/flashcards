import { ReviewResult } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const prisma = getPrisma();
  const now = new Date();

  const session = await prisma.$transaction(async (tx) => {
    const current = await tx.studySession.findUnique({
      where: { id },
      include: {
        reviewLogs: {
          orderBy: { createdAt: "asc" },
          select: { cardId: true, result: true },
        },
      },
    });

    if (!current) return null;

    const latestResults = new Map(current.reviewLogs.map((log) => [log.cardId, log.result]));
    const results = Array.from(latestResults.values());
    const answeredCount = latestResults.size;
    const correctCount = results.filter((result) => result === ReviewResult.correct).length;
    const wrongCount = results.filter((result) => result === ReviewResult.wrong).length;
    const omittedCount = results.filter((result) => result === ReviewResult.omitted).length;

    const updatedSession = await tx.studySession.update({
      where: { id },
      data: {
        correctCount,
        wrongCount,
        omittedCount,
        completedAt: current.completedAt ?? now,
      },
      select: {
        id: true,
        completedAt: true,
        correctCount: true,
        wrongCount: true,
        omittedCount: true,
      },
    });

    return { ...updatedSession, answeredCount };
  });

  if (!session) {
    return NextResponse.json({ error: "Study session not found." }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      ...session,
      completedAt: session.completedAt?.toISOString() ?? null,
    },
  });
}
