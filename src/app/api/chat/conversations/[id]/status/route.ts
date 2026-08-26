import { ConversationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
type UpdateBody = {
  status?: ConversationStatus;
  assignedUserId?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  let body: UpdateBody;

  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  if (
    body.status &&
    !Object.values(ConversationStatus).includes(body.status)
  ) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  if (body.status === undefined && body.assignedUserId === undefined) {
    return NextResponse.json(
      { error: "Informe status ou assignedUserId." },
      { status: 400 },
    );
  }

  if (body.assignedUserId) {
    const userExists = await prisma.user.count({
      where: { id: body.assignedUserId, tenantId: session.tenantId },
    });

    if (!userExists) {
      return NextResponse.json({ error: "Atendente nao encontrado." }, { status: 404 });
    }
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.conversation.updateMany({
      where: { id, tenantId: session.tenantId },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.assignedUserId !== undefined
          ? { assignedUserId: body.assignedUserId }
          : {}),
      },
    });

    if (result.count && body.assignedUserId !== undefined) {
      await transaction.conversationAssignment.create({
        data: {
          tenantId: session.tenantId,
          conversationId: id,
          assignedUserId: body.assignedUserId,
          assignedByUserId: session.userId,
        },
      });
    }

    return result;
  });

  if (!updated.count) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  await publishChatEvent({
    type: "CONVERSATION_UPDATED",
    tenantId: session.tenantId,
    occurredAt: new Date().toISOString(),
    data: { conversationId: id },
  });

  return NextResponse.json({ status: body.status, assignedUserId: body.assignedUserId });
}
