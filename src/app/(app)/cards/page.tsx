import Link from "next/link";
import { CardBank } from "@/components/CardBank";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const prisma = getPrisma();
  const [cards, decks, tags] = await Promise.all([
    prisma.card.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        deck: true,
        tags: { include: { tag: true } },
      },
    }),
    prisma.deck.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Card Bank</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">Vocabulary memory database</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Search, filter, edit, omit, mark, reset progress, and manage backups.
          </p>
        </div>
        <Link href="/backup" className="btn">
          Backup / restore
        </Link>
      </div>
      <CardBank
        initialCards={cards.map((card) => ({
          id: card.id,
          front: card.front,
          back: card.back,
          deckId: card.deckId,
          deckName: card.deck.name,
          status: card.status,
          isMarked: card.isMarked,
          isOmitted: card.isOmitted,
          correctCount: card.correctCount,
          incorrectCount: card.incorrectCount,
          reviewCount: card.reviewCount,
          nextReviewAt: card.nextReviewAt?.toISOString() ?? null,
          createdAt: card.createdAt.toISOString(),
          tags: card.tags.map((tag) => tag.tag.name),
        }))}
        decks={decks.map((deck) => ({ id: deck.id, name: deck.name }))}
        tags={tags.map((tag) => tag.name)}
      />
    </div>
  );
}
