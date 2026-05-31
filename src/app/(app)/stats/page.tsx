import { CardStatus, ReviewResult } from "@prisma/client";
import { StatCard } from "@/components/StatCard";
import { addDays, endOfToday, formatDate, startOfToday } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { stripMarkdownLite } from "@/lib/markdown-table";

export const dynamic = "force-dynamic";

type DeltaTone = "green" | "red" | "slate";

function accuracyValue(correct: number, wrong: number) {
  const total = correct + wrong;
  return total === 0 ? 0 : (correct / total) * 100;
}

function accuracy(correct: number, wrong: number) {
  return `${accuracyValue(correct, wrong).toFixed(1)}%`;
}

function signed(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function deltaTone(delta: number, positiveTone: "green" | "red" = "green"): DeltaTone {
  if (delta === 0) return "slate";
  if (positiveTone === "red") return delta > 0 ? "red" : "green";
  return delta > 0 ? "green" : "red";
}

function DeltaBadge({
  delta,
  positiveTone = "green",
}: {
  delta: number;
  positiveTone?: "green" | "red";
}) {
  const tones = {
    green: "border-green-100 bg-green-50 text-green-700",
    red: "border-red-100 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-500",
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tones[deltaTone(delta, positiveTone)]}`}>
      today {signed(delta)}
    </span>
  );
}

function CountWithDelta({
  value,
  delta,
  valueClassName,
  positiveTone = "green",
}: {
  value: number;
  delta: number;
  valueClassName?: string;
  positiveTone?: "green" | "red";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={valueClassName}>{value}</span>
      <DeltaBadge delta={delta} positiveTone={positiveTone} />
    </div>
  );
}

function statusBucket(status: CardStatus) {
  if (status === CardStatus.review || status === CardStatus.correct) return "correct";
  if (status === CardStatus.incorrect) return "incorrect";
  return null;
}

export default async function StatsPage() {
  const prisma = getPrisma();
  const todayStart = startOfToday();
  const [
    totalCards,
    totalReviews,
    cardTotals,
    cardsForDeckStats,
    difficultCards,
    recentCards,
    dueCards,
    todaysReviewLogs,
    todaysNewCards,
  ] = await Promise.all([
    prisma.card.count(),
    prisma.reviewLog.count(),
    prisma.card.aggregate({ _sum: { correctCount: true, incorrectCount: true } }),
    prisma.card.findMany({
      select: {
        id: true,
        deckId: true,
        status: true,
      },
    }),
    prisma.card.findMany({
      where: { incorrectCount: { gt: 0 } },
      orderBy: [{ incorrectCount: "desc" }, { reviewCount: "desc" }],
      take: 10,
      include: { deck: true },
    }),
    prisma.card.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { deck: true },
    }),
    prisma.card.findMany({
      where: { nextReviewAt: { lte: addDays(endOfToday(), 6) } },
      orderBy: { nextReviewAt: "asc" },
      select: { nextReviewAt: true },
    }),
    prisma.reviewLog.findMany({
      where: { reviewedAt: { gte: todayStart } },
      orderBy: [{ reviewedAt: "asc" }, { createdAt: "asc" }],
      select: {
        cardId: true,
        result: true,
        previousStatus: true,
      },
    }),
    prisma.card.count({ where: { createdAt: { gte: todayStart } } }),
  ]);

  const decks = await prisma.deck.findMany({ select: { id: true, name: true } });
  const deckName = new Map(decks.map((deck) => [deck.id, deck.name]));
  const correct = cardTotals._sum.correctCount ?? 0;
  const wrong = cardTotals._sum.incorrectCount ?? 0;
  const todaysCorrect = todaysReviewLogs.filter((log) => log.result === ReviewResult.correct).length;
  const todaysWrong = todaysReviewLogs.filter((log) => log.result === ReviewResult.wrong).length;
  const previousAccuracy = accuracyValue(Math.max(0, correct - todaysCorrect), Math.max(0, wrong - todaysWrong));
  const accuracyDelta = Number((accuracyValue(correct, wrong) - previousAccuracy).toFixed(1));
  const previousStatusByCard = new Map<string, CardStatus>();
  const deckRowsById = new Map<string, { cards: number; correct: number; incorrect: number; previousCorrect: number; previousIncorrect: number }>();

  for (const log of todaysReviewLogs) {
    if (!previousStatusByCard.has(log.cardId)) {
      previousStatusByCard.set(log.cardId, log.previousStatus);
    }
  }

  for (const card of cardsForDeckStats) {
    const row = deckRowsById.get(card.deckId) ?? { cards: 0, correct: 0, incorrect: 0, previousCorrect: 0, previousIncorrect: 0 };
    const currentBucket = statusBucket(card.status);
    const previousBucket = statusBucket(previousStatusByCard.get(card.id) ?? card.status);

    row.cards += 1;
    if (currentBucket === "correct") row.correct += 1;
    if (currentBucket === "incorrect") row.incorrect += 1;
    if (previousBucket === "correct") row.previousCorrect += 1;
    if (previousBucket === "incorrect") row.previousIncorrect += 1;
    deckRowsById.set(card.deckId, row);
  }

  const deckRows = Array.from(deckRowsById.entries())
    .map(([deckId, row]) => ({
      deckId,
      name: deckName.get(deckId) ?? "Unknown",
      ...row,
      correctDelta: row.correct - row.previousCorrect,
      incorrectDelta: row.incorrect - row.previousIncorrect,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const dueByDate = dueCards.reduce<Record<string, number>>((acc, card) => {
    if (!card.nextReviewAt) return acc;
    const key = card.nextReviewAt.toISOString().slice(0, 10);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-blue-600">Stats</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Memory system health</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total cards" value={totalCards} tone="blue" delta={{ label: `today ${signed(todaysNewCards)}`, tone: deltaTone(todaysNewCards) }} />
        <StatCard label="Total reviews" value={totalReviews} tone="slate" delta={{ label: `today ${signed(todaysReviewLogs.length)}`, tone: deltaTone(todaysReviewLogs.length) }} />
        <StatCard label="Overall correct rate" value={accuracy(correct, wrong)} tone="green" delta={{ label: `today ${signed(accuracyDelta, " pts")}`, tone: deltaTone(accuracyDelta) }} />
        <StatCard label="Wrong answers" value={wrong} tone="red" delta={{ label: `today ${signed(todaysWrong)}`, tone: deltaTone(todaysWrong, "red") }} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Correct / incorrect by deck</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Deck</th>
                  <th className="px-4 py-3">Cards</th>
                  <th className="px-4 py-3">Correct</th>
                  <th className="px-4 py-3">Incorrect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deckRows.map((row) => (
                  <tr key={row.deckId}>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.cards}</td>
                    <td className="px-4 py-3">
                      <CountWithDelta value={row.correct} delta={row.correctDelta} valueClassName="text-green-600" />
                    </td>
                    <td className="px-4 py-3">
                      <CountWithDelta value={row.incorrect} delta={row.incorrectDelta} valueClassName="text-red-600" positiveTone="red" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Cards due over next 7 days</h2>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 7 }).map((_, offset) => {
              const date = addDays(new Date(), offset);
              const key = date.toISOString().slice(0, 10);
              return (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span>{formatDate(date)}</span>
                  <span className="badge">{dueByDate[key] ?? 0}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Most difficult cards</h2>
          <div className="mt-4 space-y-2">
            {difficultCards.length === 0 ? (
              <p className="text-sm text-slate-500">No wrong answers yet.</p>
            ) : (
              difficultCards.map((card) => (
                <div key={card.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{stripMarkdownLite(card.front)}</p>
                    <span className="badge">{card.incorrectCount} wrong</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{card.deck.name}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Recently added cards</h2>
          <div className="mt-4 space-y-2">
            {recentCards.length === 0 ? (
              <p className="text-sm text-slate-500">No cards yet.</p>
            ) : (
              recentCards.map((card) => (
                <div key={card.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="font-medium">{stripMarkdownLite(card.front)}</p>
                  <p className="mt-1 text-sm text-slate-500">{card.deck.name}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
