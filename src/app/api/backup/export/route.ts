import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const prisma = getPrisma();
  const [decks, cards, tags, cardTags, reviewLogs, studySessions] = await Promise.all([
    prisma.deck.findMany(),
    prisma.card.findMany(),
    prisma.tag.findMany(),
    prisma.cardTag.findMany(),
    prisma.reviewLog.findMany(),
    prisma.studySession.findMany(),
  ]);

  return Response.json(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      decks,
      cards,
      tags,
      cardTags,
      reviewLogs,
      studySessions,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="korean-memory-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    },
  );
}
