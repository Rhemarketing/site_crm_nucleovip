import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { hashPassword, requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireCurrentUser();
  const users = await prisma.user.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { assignedConversations: true } },
    },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    role?: "ADMIN" | "AGENT";
    password?: string;
  } | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const role = body?.role === "ADMIN" ? "ADMIN" : "AGENT";
  const temporaryPassword =
    body?.password?.trim() || randomBytes(9).toString("base64url");
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json(
      { error: "Informe nome e e-mail válidos." },
      { status: 400 },
    );
  if (temporaryPassword.length < 8)
    return NextResponse.json(
      { error: "A senha deve ter ao menos 8 caracteres." },
      { status: 400 },
    );
  try {
    const user = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        name,
        email,
        role,
        passwordHash: await hashPassword(temporaryPassword),
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
    return NextResponse.json(
      {
        user,
        temporaryPassword: body?.password ? undefined : temporaryPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado nesta empresa." },
        { status: 409 },
      );
    throw error;
  }
}
