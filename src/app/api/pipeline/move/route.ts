import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await requireCurrentUser();
  const body = (await request.json().catch(() => null)) as {
    conversationId?: string;
    targetStageId?: string;
    newOrder?: number;
  } | null;
  if (!body?.conversationId || !body.targetStageId)
    return NextResponse.json(
      { error: "Conversa e etapa são obrigatórias." },
      { status: 400 },
    );
  const [conversation, stage] = await Promise.all([
    prisma.conversation.findFirst({
      where: { id: body.conversationId, tenantId: session.tenantId },
    }),
    prisma.pipelineStage.findFirst({
      where: { id: body.targetStageId, tenantId: session.tenantId },
    }),
  ]);
  if (!conversation || !stage)
    return NextResponse.json(
      { error: "Conversa ou etapa não encontrada." },
      { status: 404 },
    );
  const targetItems = await prisma.conversation.findMany({
    where: {
      tenantId: session.tenantId,
      pipelineStageId: stage.id,
      id: { not: conversation.id },
    },
    orderBy: [{ pipelineOrder: "asc" }, { lastMessageAt: "desc" }],
    select: { id: true },
  });
  const newOrder = Math.min(
    targetItems.length,
    Math.max(0, body.newOrder ?? 0),
  );
  targetItems.splice(newOrder, 0, { id: conversation.id });
  const sourceItems =
    conversation.pipelineStageId && conversation.pipelineStageId !== stage.id
      ? await prisma.conversation.findMany({
          where: {
            tenantId: session.tenantId,
            pipelineStageId: conversation.pipelineStageId,
            id: { not: conversation.id },
          },
          orderBy: [{ pipelineOrder: "asc" }, { lastMessageAt: "desc" }],
          select: { id: true },
        })
      : [];
  await prisma.$transaction([
    ...targetItems.map((item, index) =>
      prisma.conversation.updateMany({
        where: { id: item.id, tenantId: session.tenantId },
        data: { pipelineStageId: stage.id, pipelineOrder: index },
      }),
    ),
    ...sourceItems.map((item, index) =>
      prisma.conversation.updateMany({
        where: { id: item.id, tenantId: session.tenantId },
        data: { pipelineOrder: index },
      }),
    ),
  ]);
  await publishChatEvent({
    type: "PIPELINE_UPDATED",
    tenantId: session.tenantId,
    occurredAt: new Date().toISOString(),
    data: {
      conversationId: conversation.id,
      sourceStageId: conversation.pipelineStageId,
      targetStageId: stage.id,
      newOrder,
    },
  });
  return NextResponse.json({ success: true });
}
