import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { PastTestResultsViewer, type PastTestQuestionRow } from "@/components/PastTestResultsViewer";
import { RedoTestButton } from "@/components/RedoTestButton";
import { formatDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import {
  formatDeckList,
  formatQuestionPool,
  formatScore,
  formatStudyMode,
  scorePercent,
  summarizeReviewLogs,
} from "@/lib/study-history";

export const dynamic = "force-dynamic";

export default async function PastTestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = getPrisma();
  const session = await prisma.studySession.findUnique({
    where: { id },
    include: {
      reviewLogs: {
        orderBy: { createdAt: "asc" },
        select: { cardId: true, result: true, reviewedAt: true },
      },
    },
  });

  if (!session) notFound();

  const [cards, decks] = await Promise.all([
    prisma.card.findMany({
      where: { id: { in: session.cardIds } },
      include: {
        deck: true,
        tags: { include: { tag: true } },
      },
    }),
    prisma.deck.findMany({ select: { id: true, name: true } }),
  ]);

  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const deckNames = new Map(decks.map((deck) => [deck.id, deck.name]));
  const summary = summarizeReviewLogs(session.reviewLogs);
  const rows: PastTestQuestionRow[] = session.cardIds
    .map((cardId, index) => {
      const card = cardsById.get(cardId);
      if (!card) return null;

      return {
        id: card.id,
        number: index + 1,
        front: card.front,
        back: card.back,
        deck: card.deck.name,
        tags: card.tags.map((tag) => tag.tag.name).join(", ") || "None",
        result: summary.latestResults.get(card.id) ?? null,
      };
    })
    .filter((row): row is PastTestQuestionRow => Boolean(row));
  const score = scorePercent(summary.correctCount, summary.wrongCount);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/study/history" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
            <ArrowLeft size={16} />
            Previous Tests
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Test Results</h1>
          <p className="mt-2 text-sm text-slate-500">Custom test id: {session.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RedoTestButton sessionId={session.id} className="btn btn-primary" label="Redo test" />
          {!session.completedAt ? (
            <Link href={`/study/${session.id}`} className="btn">
              <PlayCircle size={17} />
              Resume
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="panel rounded-3xl p-5">
          <p className="text-sm font-semibold text-slate-500">Your Score</p>
          <div className="mt-5 max-w-xl">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-green-700">{formatScore(summary.correctCount, summary.wrongCount)}</span>
              <span className="text-slate-500">{summary.answeredCount} / {session.cardCount} answered</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${score}%` }} />
            </div>
          </div>
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-4">
            <span className="badge justify-center">Correct: {summary.correctCount}</span>
            <span className="badge justify-center">Wrong: {summary.wrongCount}</span>
            <span className="badge justify-center">Omitted: {summary.omittedCount}</span>
            <span className="badge justify-center">Date: {formatDate(session.startedAt)}</span>
          </div>
        </div>

        <div className="panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Test Settings</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-slate-500">Mode</dt>
              <dd className="font-medium text-slate-900">{formatStudyMode(session.mode)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-slate-500">Question Pool</dt>
              <dd className="text-right font-medium text-slate-900">{formatQuestionPool(session.filters)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Decks</dt>
              <dd className="text-right font-medium text-slate-900">{formatDeckList(session.deckIds, deckNames)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <PastTestResultsViewer rows={rows} />
    </div>
  );
}
