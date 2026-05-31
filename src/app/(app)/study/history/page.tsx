import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PastTestsManager, type PastTestRow } from "@/components/PastTestsManager";
import { getPrisma } from "@/lib/prisma";
import {
  formatDeckLabel,
  formatQuestionPool,
  formatScore,
  formatStudyMode,
  summarizeReviewLogs,
} from "@/lib/study-history";

export const dynamic = "force-dynamic";

export default async function PastTestsPage() {
  const prisma = getPrisma();
  const [sessions, decks] = await Promise.all([
    prisma.studySession.findMany({
      orderBy: { startedAt: "desc" },
      include: {
        reviewLogs: {
          orderBy: { createdAt: "asc" },
          select: { cardId: true, result: true },
        },
      },
    }),
    prisma.deck.findMany({ select: { id: true, name: true } }),
  ]);

  const deckNames = new Map(decks.map((deck) => [deck.id, deck.name]));
  const total = sessions.length;
  const rows: PastTestRow[] = sessions.map((session, index) => {
    const summary = summarizeReviewLogs(session.reviewLogs);

    return {
      id: session.id,
      name: `Test ${total - index}`,
      mode: formatStudyMode(session.mode),
      questionPool: formatQuestionPool(session.filters),
      decks: formatDeckLabel(session.deckIds, deckNames),
      cardCount: session.cardCount,
      answeredCount: summary.answeredCount,
      correctCount: summary.correctCount,
      wrongCount: summary.wrongCount,
      omittedCount: summary.omittedCount,
      score: formatScore(summary.correctCount, summary.wrongCount),
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/study" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
            <ArrowLeft size={16} />
            Study setup
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Previous Tests</h1>
        </div>
      </section>

      <PastTestsManager sessions={rows} />
    </div>
  );
}
