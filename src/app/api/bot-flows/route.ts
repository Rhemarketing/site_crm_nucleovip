import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { createInitialBotGraph } from "@/lib/bot-flow-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireCurrentUser();
  const [flows, tags, users] = await prisma.$transaction([
    prisma.botFlow.findMany({
      where: { tenantId: session.tenantId },
      include: { _count: { select: { conversations: true } } },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.tag.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({ flows, resources: { tags, users } });
}

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    triggerKeyword?: string;
  } | null;
  const name = body?.name?.trim() || "Novo fluxo";
  if (name.length > 120) {
    return NextResponse.json({ error: "O nome deve ter até 120 caracteres." }, { status: 400 });
  }
  const graph = createInitialBotGraph();
  const flow = await prisma.botFlow.create({
    data: {
      tenantId: session.tenantId,
      name,
      triggerKeyword: body?.triggerKeyword?.trim().toLowerCase() || null,
      isActive: false,
      nodes: graph.nodes as unknown as Prisma.InputJsonValue,
      edges: graph.edges as unknown as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ flow }, { status: 201 });
}
