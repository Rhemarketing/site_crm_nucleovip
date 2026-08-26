import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { publishChatEvent } from "@/lib/chat-events";
import { serializeChatMessage } from "@/lib/chat-serializers";
import { prisma } from "@/lib/prisma";
import { buildTemplateSendComponents, renderTemplateText } from "@/lib/template-utils";
import { MetaWhatsAppError, metaWhatsAppService } from "@/services/meta-whatsapp.service";

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  const body = (await request.json().catch(() => null)) as { conversationId?: string; templateId?: string; variables?: Record<string, string> } | null;
  if (!body?.conversationId || !body.templateId) return NextResponse.json({ error: "conversationId e templateId sao obrigatorios." }, { status: 400 });
  const conversation = await prisma.conversation.findFirst({
    where: { id: body.conversationId, tenantId: session.tenantId },
    include: { contact: { select: { phone: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  const template = await prisma.template.findFirst({
    where: { id: body.templateId, tenantId: session.tenantId, whatsappAccountId: conversation.whatsappAccountId, status: "APPROVED" },
  });
  if (!template) return NextResponse.json({ error: "Template aprovado nao encontrado para esta conta." }, { status: 404 });
  const variables = body.variables ?? {};
  try {
    const result = await metaWhatsAppService.sendTemplateMessage(
      conversation.whatsappAccountId,
      conversation.contact.phone,
      template.name,
      template.language,
      buildTemplateSendComponents(template.components, variables),
    );
    const metaMessageId = result.messages[0]?.id;
    if (!metaMessageId) return NextResponse.json({ error: "A Meta nao retornou o ID da mensagem." }, { status: 502 });
    const message = await prisma.$transaction(async (transaction) => {
      const created = await transaction.message.create({
        data: {
          tenantId: session.tenantId,
          conversationId: conversation.id,
          metaMessageId,
          direction: "OUTBOUND",
          type: "TEMPLATE",
          content: renderTemplateText(template.components, variables),
          status: "SENT",
          metadata: { templateId: template.id, templateName: template.name, variables },
        },
      });
      await transaction.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: created.createdAt } });
      return created;
    });
    const serialized = serializeChatMessage(message);
    const occurredAt = new Date().toISOString();
    await Promise.all([
      publishChatEvent({ type: "NEW_MESSAGE", tenantId: session.tenantId, occurredAt, data: { conversationId: conversation.id, message: serialized } }),
      publishChatEvent({ type: "CONVERSATION_UPDATED", tenantId: session.tenantId, occurredAt, data: { conversationId: conversation.id } }),
    ]);
    return NextResponse.json({ message: serialized }, { status: 201 });
  } catch (error) {
    if (error instanceof MetaWhatsAppError) return NextResponse.json({ error: error.message, meta: error.toJSON() }, { status: error.isRateLimit ? 429 : 502 });
    throw error;
  }
}
