import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const colorPattern = /^#[0-9A-F]{6}$/i;
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { name?: string; color?: string } | null;
  const name = body?.name?.trim();
  const color = body?.color?.trim().toUpperCase();
  if ((!name && !color) || (name && name.length > 50) || (color && !colorPattern.test(color))) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  try {
    const result = await prisma.tag.updateMany({ where: { id, tenantId: session.tenantId }, data: { ...(name ? { name } : {}), ...(color ? { color } : {}) } });
    if (!result.count) return NextResponse.json({ error: "Etiqueta nao encontrada." }, { status: 404 });
    const tag = await prisma.tag.findUnique({ where: { id } });
    return NextResponse.json({ tag });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Nome de etiqueta ja utilizado." }, { status: 409 });
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const deleted = await prisma.tag.deleteMany({ where: { id, tenantId: session.tenantId } });
  if (!deleted.count) return NextResponse.json({ error: "Etiqueta nao encontrada." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
