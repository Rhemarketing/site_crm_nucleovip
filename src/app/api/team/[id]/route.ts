import { NextResponse } from "next/server";

import { hashPassword, requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 },
    );
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    role?: "ADMIN" | "AGENT";
    isActive?: boolean;
    password?: string;
  } | null;
  const current = await prisma.user.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!current)
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  if (id === session.userId && body?.isActive === false)
    return NextResponse.json(
      { error: "Você não pode desativar seu próprio acesso." },
      { status: 400 },
    );
  if (body?.password && body.password.length < 8)
    return NextResponse.json(
      { error: "A senha deve ter ao menos 8 caracteres." },
      { status: 400 },
    );
  if (
    current.role === "ADMIN" &&
    (body?.role === "AGENT" || body?.isActive === false)
  ) {
    const admins = await prisma.user.count({
      where: { tenantId: session.tenantId, role: "ADMIN", isActive: true },
    });
    if (admins <= 1)
      return NextResponse.json(
        { error: "A empresa precisa manter ao menos um administrador ativo." },
        { status: 400 },
      );
  }
  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body?.name?.trim() || undefined,
      role: body?.role,
      isActive: body?.isActive,
      passwordHash: body?.password
        ? await hashPassword(body.password)
        : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ user });
}

export async function DELETE(_: Request, context: Context) {
  return PATCH(
    new Request("http://local", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    }),
    context,
  );
}
