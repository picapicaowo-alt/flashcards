import Link from "next/link";
import { CardStatus } from "@prisma/client";
import { ClipboardList, Database, FileInput, PlayCircle, Star } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { endOfToday, startOfToday } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function percent(correct: number, total: number) {
  if (total === 0) return "0%";
  return `${((correct / total) * 100).toFixed(1)}%`;
}

export default async function DashboardPage() {
  const prisma = getPrisma();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    dueToday,
    overdue,
    unused,
    wrongBank,
    marked,
    totalCards,
    reviewTotals,
    recentDecks,
  ] = await Promise.all([
    prisma.card.count({ where: { isOmitted: false, nextReviewAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.card.count({ where: { isOmitted: false, nextReviewAt: { lt: todayStart } } }),
    prisma.card.count({ where: { isOmitted: false, status: CardStatus.unused } }),
    prisma.card.count({ where: { isOmitted: false, status: CardStatus.incorrect } }),
    prisma.card.count({ where: { isMarked: true } }),
    prisma.card.count(),
    prisma.card.aggregate({ _sum: { correctCount: true, incorrectCount: true } }),
    prisma.deck.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { cards: true } } },
    }),
  ]);

  const correct = reviewTotals._sum.correctCount ?? 0;
  const wrong = reviewTotals._sum.incorrectCount ?? 0;

  const actions = [
    { href: "/study", label: "Build Study Block", icon: PlayCircle },
    { href: "/cards", label: "Open Card Bank", icon: Database },
    { href: "/stats", label: "View Stats", icon: Star },
    { href: "/study/history", label: "Past Tests", icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal sm:text-4xl">What should I study next?</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Prioritizing due cards, wrong answers, and new vocabulary so the next step is obvious.
          </p>
        </div>
        <Link href="/import" className="btn btn-primary w-full sm:w-auto">
          <FileInput size={17} />
          Import New Lesson
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cards due today" value={dueToday} tone="blue" />
        <StatCard label="Overdue cards" value={overdue} tone="red" />
        <StatCard label="New unused cards" value={unused} tone="green" />
        <StatCard label="Wrong bank count" value={wrongBank} tone="red" />
        <StatCard label="Marked cards" value={marked} tone="slate" />
        <StatCard label="Total cards" value={totalCards} tone="slate" />
        <StatCard label="Overall accuracy" value={percent(correct, correct + wrong)} tone="green" />
        <StatCard label="Total reviews" value={correct + wrong} tone="blue" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} className="btn justify-start rounded-2xl">
                  <Icon size={17} />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Recent decks</h2>
          <div className="mt-4 space-y-3">
            {recentDecks.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No decks yet. Import your first Markdown table to start the memory loop.
              </p>
            ) : (
              recentDecks.map((deck) => (
                <div key={deck.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="font-medium">{deck.name}</span>
                  <span className="badge">{deck._count.cards}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
