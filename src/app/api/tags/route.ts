import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const colorPattern = /^#[0-9A-F]{6}$/i;

export async function GET() {
  const session = await requireCurrentUser();
  const tags = await prisma.tag.findMany({
    where: { tenantId: session.tenantId },
    include: { _count: { select: { contactTags: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      contactCount: tag._count.contactTags,
      _count: { contacts: tag._count.contactTags },
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  const body = (await request.json().catch(() => null)) as { name?: string; color?: string } | null;
  const name = body?.name?.trim();
  const color = body?.color?.trim().toUpperCase();
  if (!name || name.length > 50 || !color || !colorPattern.test(color)) {
    return NextResponse.json({ error: "Informe nome e cor hexadecimal valida (#RRGGBB)." }, { status: 400 });
  }
  try {
    const tag = await prisma.tag.create({ data: { tenantId: session.tenantId, name, color } });
    return NextResponse.json({ tag: { ...tag, contactCount: 0 } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Etiqueta ja cadastrada." }, { status: 409 });
    throw error;
  }
}
