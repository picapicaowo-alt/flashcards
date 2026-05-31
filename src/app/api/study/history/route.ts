import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const sessionIds = Array.isArray(body?.sessionIds)
    ? Array.from(new Set(body.sessionIds.map(String).filter(Boolean))).slice(0, 500)
    : [];
  const olderThanMonths = Number(body?.olderThanMonths ?? 0);

  if (sessionIds.length === 0 && (!Number.isFinite(olderThanMonths) || olderThanMonths <= 0)) {
    return NextResponse.json({ error: "Select tests or choose an age to delete." }, { status: 400 });
  }

  const prisma = getPrisma();
  const clauses: Array<Record<string, unknown>> = [];

  if (sessionIds.length > 0) {
    clauses.push({ id: { in: sessionIds } });
  }

  if (Number.isFinite(olderThanMonths) && olderThanMonths > 0) {
    const safeMonths = Math.min(Math.max(Math.floor(olderThanMonths), 1), 120);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - safeMonths);
    clauses.push({ completedAt: { lt: cutoff } });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const sessions = await tx.studySession.findMany({
      where: { OR: clauses },
      select: { id: true },
    });
    const ids = sessions.map((session) => session.id);

    if (ids.length === 0) {
      return { ids, deletedReviewLogs: 0, deletedSessions: 0 };
    }

    const reviewLogs = await tx.reviewLog.deleteMany({
      where: { sessionId: { in: ids } },
    });
    const studySessions = await tx.studySession.deleteMany({
      where: { id: { in: ids } },
    });

    return {
      ids,
      deletedReviewLogs: reviewLogs.count,
      deletedSessions: studySessions.count,
    };
  });

  return NextResponse.json({
    deletedSessionIds: deleted.ids,
    deletedReviewLogs: deleted.deletedReviewLogs,
    deletedSessions: deleted.deletedSessions,
  });
}
