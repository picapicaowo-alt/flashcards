import { StatCard } from "@/components/StatCard";
import { addDays, endOfToday, formatDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { stripMarkdownLite } from "@/lib/markdown-table";

export const dynamic = "force-dynamic";

function accuracy(correct: number, wrong: number) {
  const total = correct + wrong;
  return total === 0 ? "0%" : `${((correct / total) * 100).toFixed(1)}%`;
}

export default async function StatsPage() {
  const prisma = getPrisma();
  const [
    totalCards,
    totalReviews,
    cardTotals,
    byDeck,
    difficultCards,
    recentCards,
    dueCards,
  ] = await Promise.all([
    prisma.card.count(),
    prisma.reviewLog.count(),
    prisma.card.aggregate({ _sum: { correctCount: true, incorrectCount: true } }),
    prisma.card.groupBy({
      by: ["deckId"],
      _sum: { correctCount: true, incorrectCount: true },
      _count: { _all: true },
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
  ]);

  const decks = await prisma.deck.findMany({ select: { id: true, name: true } });
  const deckName = new Map(decks.map((deck) => [deck.id, deck.name]));
  const correct = cardTotals._sum.correctCount ?? 0;
  const wrong = cardTotals._sum.incorrectCount ?? 0;

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
        <StatCard label="Total cards" value={totalCards} tone="blue" />
        <StatCard label="Total reviews" value={totalReviews} tone="slate" />
        <StatCard label="Overall correct rate" value={accuracy(correct, wrong)} tone="green" />
        <StatCard label="Wrong answers" value={wrong} tone="red" />
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
                {byDeck.map((row) => (
                  <tr key={row.deckId}>
                    <td className="px-4 py-3 font-medium">{deckName.get(row.deckId) ?? "Unknown"}</td>
                    <td className="px-4 py-3">{row._count._all}</td>
                    <td className="px-4 py-3 text-green-600">{row._sum.correctCount ?? 0}</td>
                    <td className="px-4 py-3 text-red-600">{row._sum.incorrectCount ?? 0}</td>
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
