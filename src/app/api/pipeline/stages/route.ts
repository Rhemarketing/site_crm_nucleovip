import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const defaults = [
  ["Lead Novo", "#0EA5E9"],
  ["Qualificação", "#8B5CF6"],
  ["Proposta", "#F59E0B"],
  ["Fechado", "#10B981"],
  ["Perdido", "#EF4444"],
] as const;

export async function GET() {
  const session = await requireCurrentUser();
  let stages = await prisma.pipelineStage.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { order: "asc" },
  });
  if (!stages.length) {
    await prisma.pipelineStage.createMany({
      data: defaults.map(([name, color], order) => ({
        tenantId: session.tenantId,
        name,
        color,
        order,
      })),
    });
    stages = await prisma.pipelineStage.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { order: "asc" },
    });
  }
  const firstStage = stages[0];
  if (firstStage) {
    await prisma.conversation.updateMany({
      where: { tenantId: session.tenantId, pipelineStageId: null },
      data: { pipelineStageId: firstStage.id },
    });
  }
  const result = await prisma.pipelineStage.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { order: "asc" },
    include: {
      conversations: {
        orderBy: [{ pipelineOrder: "asc" }, { lastMessageAt: "desc" }],
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              avatarUrl: true,
              customFields: true,
              contactTags: {
                select: {
                  tag: { select: { id: true, name: true, color: true } },
                },
              },
            },
          },
          assignedUser: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  return NextResponse.json({ stages: result });
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
    color?: string;
    order?: number;
    stages?: Array<{ id: string; order: number }>;
  } | null;
  if (body?.stages) {
    await prisma.$transaction(
      body.stages.map((stage) =>
        prisma.pipelineStage.updateMany({
          where: { id: stage.id, tenantId: session.tenantId },
          data: { order: stage.order },
        }),
      ),
    );
    return NextResponse.json({ success: true });
  }
  const name = body?.name?.trim();
  const color = body?.color?.toUpperCase();
  if (!name || !color || !/^#[0-9A-F]{6}$/.test(color))
    return NextResponse.json(
      { error: "Informe nome e cor hexadecimal." },
      { status: 400 },
    );
  const order =
    body?.order ??
    (await prisma.pipelineStage.count({
      where: { tenantId: session.tenantId },
    }));
  const stage = await prisma.pipelineStage.create({
    data: { tenantId: session.tenantId, name, color, order },
  });
  return NextResponse.json({ stage }, { status: 201 });
}
