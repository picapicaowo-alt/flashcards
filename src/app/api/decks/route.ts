import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0) : [];
  const uniqueIds = Array.from(new Set(ids));

  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: "No decks selected." }, { status: 400 });
  }

  const prisma = getPrisma();
  const result = await prisma.deck.deleteMany({
    where: {
      id: { in: uniqueIds },
    },
  });

  return NextResponse.json({ ok: true, deletedCount: result.count });
}
