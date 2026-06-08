import { NextResponse } from "next/server";
import { parseMarkdownTable } from "@/lib/markdown-table";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function parseTags(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const deckId = String(body?.deckId ?? "").trim();
  const deckName = String(body?.deckName ?? "").trim();
  const markdown = String(body?.markdown ?? "");
  const lessonDateValue = String(body?.lessonDate ?? "");
  const parsed = parseMarkdownTable(markdown);

  if (!deckId && !deckName) {
    return NextResponse.json({ error: "Deck name is required." }, { status: 400 });
  }

  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const prisma = getPrisma();
  const tagNames = parseTags(body?.tags);
  const lessonDate = lessonDateValue ? new Date(`${lessonDateValue}T00:00:00`) : null;
  const existingDeck = deckId ? await prisma.deck.findUnique({ where: { id: deckId } }) : null;

  if (deckId && !existingDeck) {
    return NextResponse.json({ error: "Selected deck was not found." }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const deck =
      existingDeck ??
      (await tx.deck.upsert({
        where: { name: deckName },
        update: { lessonDate: lessonDate ?? undefined },
        create: { name: deckName, lessonDate },
      }));

    const tags = await Promise.all(
      tagNames.map((name) =>
        tx.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );

    let imported = 0;
    let skipped = 0;

    for (const card of parsed.cards) {
      const duplicate = await tx.card.findUnique({
        where: {
          deckId_front_back: {
            deckId: deck.id,
            front: card.front,
            back: card.back,
          },
        },
      });

      if (duplicate) {
        skipped += 1;
        continue;
      }

      await tx.card.create({
        data: {
          front: card.front,
          back: card.back,
          deckId: deck.id,
          tags: {
            create: tags.map((tag) => ({ tagId: tag.id })),
          },
        },
      });
      imported += 1;
    }

    return { imported, skipped, deckId: deck.id, deckName: deck.name };
  });

  return NextResponse.json(result);
}
