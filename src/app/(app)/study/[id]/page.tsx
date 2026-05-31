import Link from "next/link";
import { notFound } from "next/navigation";
import { StudySessionPlayer } from "@/components/StudySessionPlayer";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = getPrisma();
  const session = await prisma.studySession.findUnique({
    where: { id },
    include: { reviewLogs: true },
  });

  if (!session) notFound();

  const cards = await prisma.card.findMany({
    where: { id: { in: session.cardIds } },
    include: {
      deck: true,
      tags: { include: { tag: true } },
    },
  });

  const orderedCards = session.cardIds
    .map((cardId) => cards.find((card) => card.id === cardId))
    .filter(Boolean)
    .map((card) => ({
      id: card!.id,
      front: card!.front,
      back: card!.back,
      deckName: card!.deck.name,
      tags: card!.tags.map((tag) => tag.tag.name),
      status: card!.status,
      isMarked: card!.isMarked,
      isOmitted: card!.isOmitted,
      correctCount: card!.correctCount,
      incorrectCount: card!.incorrectCount,
      reviewCount: card!.reviewCount,
      nextReviewAt: card!.nextReviewAt?.toISOString() ?? null,
    }));

  if (orderedCards.length === 0) {
    return (
      <div className="panel rounded-3xl p-6">
        <h1 className="text-2xl font-semibold">This session has no cards.</h1>
        <Link href="/study" className="btn btn-primary mt-4">
          Build a new session
        </Link>
      </div>
    );
  }

  return (
    <StudySessionPlayer
      session={{
        id: session.id,
        mode: session.mode,
        cardCount: session.cardCount,
        correctCount: session.correctCount,
        wrongCount: session.wrongCount,
        omittedCount: session.omittedCount,
        completedAt: session.completedAt?.toISOString() ?? null,
      }}
      initialCards={orderedCards}
      initialAnswers={Object.fromEntries(session.reviewLogs.map((log) => [log.cardId, log.result]))}
    />
  );
}
