import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireCurrentUser();
  return NextResponse.json({
    replies: await prisma.quickReply.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { shortcut: "asc" },
    }),
  });
}
export async function POST(request: Request) {
  const session = await requireCurrentUser();
  const body = (await request.json().catch(() => null)) as {
    shortcut?: string;
    title?: string;
    content?: string;
    mediaUrl?: string;
  } | null;
  const shortcut = body?.shortcut
    ?.trim()
    .toLowerCase()
    .replace(/^\//, "")
    .replace(/[^a-z0-9_-]/g, "");
  const title = body?.title?.trim();
  const content = body?.content?.trim();
  if (!shortcut || !title || !content)
    return NextResponse.json(
      { error: "Atalho, título e conteúdo são obrigatórios." },
      { status: 400 },
    );
  try {
    const reply = await prisma.quickReply.create({
      data: {
        tenantId: session.tenantId,
        shortcut,
        title,
        content,
        mediaUrl: body?.mediaUrl?.trim() || null,
      },
    });
    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        { error: "Este atalho já existe." },
        { status: 409 },
      );
    throw error;
  }
}
