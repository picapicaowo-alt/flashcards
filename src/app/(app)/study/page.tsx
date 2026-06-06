import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { StudySetupForm } from "@/components/StudySetupForm";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const prisma = getPrisma();
  const [decks, cards, activeSession] = await Promise.all([
    prisma.deck.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { cards: true } } } }),
    prisma.card.findMany({
      select: {
        id: true,
        deckId: true,
        status: true,
        isMarked: true,
        isOmitted: true,
        incorrectCount: true,
        correctCount: true,
        nextReviewAt: true,
        createdAt: true,
      },
    }),
    prisma.studySession.findFirst({
      where: { completedAt: null },
      orderBy: { startedAt: "desc" },
      include: {
        reviewLogs: {
          select: {
            cardId: true,
          },
        },
      },
    }),
  ]);

  const activeAnsweredCount = activeSession
    ? new Set(activeSession.reviewLogs.map((log) => log.cardId)).size
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Study Session</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">Build a focused review block</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Choose status filters, decks, and card count in a UWorld-style setup screen.
          </p>
        </div>
        <Link href="/study/history" className="btn w-full sm:w-auto">
          <ClipboardList size={17} />
          Past Tests
        </Link>
      </div>
      <StudySetupForm
        activeSession={activeSession ? {
          id: activeSession.id,
          mode: activeSession.mode,
          cardCount: activeSession.cardCount,
          answeredCount: activeAnsweredCount,
          correctCount: activeSession.correctCount,
          wrongCount: activeSession.wrongCount,
          omittedCount: activeSession.omittedCount,
          startedAt: activeSession.startedAt.toISOString(),
        } : null}
        decks={decks.map((deck) => ({ id: deck.id, name: deck.name, total: deck._count.cards }))}
        cards={cards.map((card) => ({
          ...card,
          nextReviewAt: card.nextReviewAt?.toISOString() ?? null,
          createdAt: card.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
