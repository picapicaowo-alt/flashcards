import { DeckManager } from "@/components/DeckManager";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const prisma = getPrisma();
  const decks = await prisma.deck.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      lessonDate: true,
      createdAt: true,
      updatedAt: true,
      cards: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          front: true,
          back: true,
          status: true,
          isMarked: true,
          isOmitted: true,
          correctCount: true,
          incorrectCount: true,
          reviewCount: true,
          createdAt: true,
          tags: {
            select: {
              tag: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-blue-600">Deck Manager</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Edit and organize decks</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          View deck details, rename lessons, and remove one or more decks when you want to clean up the study set.
        </p>
      </div>
      <DeckManager
        initialDecks={decks.map((deck) => ({
          id: deck.id,
          name: deck.name,
          lessonDate: deck.lessonDate?.toISOString() ?? null,
          createdAt: deck.createdAt.toISOString(),
          updatedAt: deck.updatedAt.toISOString(),
          cards: deck.cards.map((card) => ({
            id: card.id,
            front: card.front,
            back: card.back,
            status: card.status,
            isMarked: card.isMarked,
            isOmitted: card.isOmitted,
            correctCount: card.correctCount,
            incorrectCount: card.incorrectCount,
            reviewCount: card.reviewCount,
            createdAt: card.createdAt.toISOString(),
            tags: card.tags.map((tag) => tag.tag.name),
          })),
        }))}
      />
    </div>
  );
}
