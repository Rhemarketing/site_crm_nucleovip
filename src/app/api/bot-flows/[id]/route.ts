import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import {
  BotFlowValidationError,
  parseBotGraph,
} from "@/lib/bot-flow-validation";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const [flow, tags, users] = await Promise.all([
    prisma.botFlow.findFirst({ where: { id, tenantId: session.tenantId } }),
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
  if (!flow) {
    return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ flow, resources: { tags, users } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const { id } = await context.params;
  const current = await prisma.botFlow.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!current) {
    return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    triggerKeyword?: string | null;
    isActive?: boolean;
    isDefault?: boolean;
    nodes?: unknown;
    edges?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const name = body.name?.trim() ?? current.name;
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "O nome deve ter entre 2 e 120 caracteres." }, { status: 400 });
  }

  try {
    const graph =
      body.nodes !== undefined || body.edges !== undefined
        ? parseBotGraph(body.nodes ?? current.nodes, body.edges ?? current.edges)
        : null;
    const flow = await prisma.$transaction(async (transaction) => {
      if (body.isDefault) {
        await transaction.botFlow.updateMany({
          where: { tenantId: session.tenantId, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return transaction.botFlow.update({
        where: { id },
        data: {
          name,
          ...(body.triggerKeyword !== undefined
            ? { triggerKeyword: body.triggerKeyword?.trim().toLowerCase() || null }
            : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          ...(graph
            ? {
                nodes: graph.nodes as unknown as Prisma.InputJsonValue,
                edges: graph.edges as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
    });
    return NextResponse.json({ flow });
  } catch (error) {
    if (error instanceof BotFlowValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const { id } = await context.params;
  const deleted = await prisma.$transaction(async (transaction) => {
    await transaction.conversation.updateMany({
      where: { tenantId: session.tenantId, currentBotFlowId: id },
      data: {
        currentBotFlowId: null,
        currentNodeId: null,
        botContext: Prisma.JsonNull,
        botActive: false,
      },
    });
    return transaction.botFlow.deleteMany({
      where: { id, tenantId: session.tenantId },
    });
  });
  if (!deleted.count) {
    return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
