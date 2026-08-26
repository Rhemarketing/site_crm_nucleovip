import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";
import { MetaWhatsAppError, metaWhatsAppService } from "@/services/meta-whatsapp.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId: session.tenantId },
    select: {
      id: true,
      whatsappAccountId: true,
      messages: {
        where: { direction: "INBOUND", metaMessageId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { metaMessageId: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { unreadCount: 0 },
  });

  const metaMessageId = conversation.messages[0]?.metaMessageId;
  let metaReadConfirmed = false;

  if (metaMessageId) {
    try {
      await metaWhatsAppService.markMessageAsRead(
        conversation.whatsappAccountId,
        metaMessageId,
      );
      metaReadConfirmed = true;
    } catch (error) {
      if (!(error instanceof MetaWhatsAppError)) throw error;
      console.error("Falha ao confirmar leitura na Meta", error.toJSON());
    }
  }

  await publishChatEvent({
    type: "CONVERSATION_UPDATED",
    tenantId: session.tenantId,
    occurredAt: new Date().toISOString(),
    data: { conversationId: conversation.id },
  });

  return NextResponse.json({ unreadCount: 0, metaReadConfirmed });
}
