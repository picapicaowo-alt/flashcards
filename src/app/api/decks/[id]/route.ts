import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function prismaErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Deck name is required." }, { status: 400 });
  }

  const prisma = getPrisma();

  try {
    const deck = await prisma.deck.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        name: true,
        lessonDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      deck: {
        ...deck,
        lessonDate: deck.lessonDate?.toISOString() ?? null,
        createdAt: deck.createdAt.toISOString(),
        updatedAt: deck.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const code = prismaErrorCode(error);
    if (code === "P2002") {
      return NextResponse.json({ error: "A deck with that name already exists." }, { status: 409 });
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "Deck was not found." }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const prisma = getPrisma();

  try {
    await prisma.deck.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (prismaErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Deck was not found." }, { status: 404 });
    }
    throw error;
  }
}
