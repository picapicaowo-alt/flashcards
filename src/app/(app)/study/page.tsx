import { StudySetupForm } from "@/components/StudySetupForm";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const prisma = getPrisma();
  const [decks, cards] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-blue-600">Study Session</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Build a focused review block</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Choose status filters, decks, and card count in a UWorld-style setup screen.
        </p>
      </div>
      <StudySetupForm
        initialMode={params.mode ?? "standard"}
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
