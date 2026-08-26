import { MessageType } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { publishChatEvent } from "@/lib/chat-events";
import { serializeChatMessage } from "@/lib/chat-serializers";
import { prisma } from "@/lib/prisma";
import {
  MetaWhatsAppError,
  metaWhatsAppService,
} from "@/services/meta-whatsapp.service";

type SendBody = {
  conversationId?: string;
  type?: MessageType;
  content?: string;
  mediaUrl?: string;
};

const allowedTypes = new Set<MessageType>([
  "TEXT",
  "IMAGE",
  "AUDIO",
  "DOCUMENT",
]);

export async function POST(request: Request) {
  const session = await requireCurrentUser();
  let body: SendBody;

  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const conversationId = body.conversationId?.trim();
  const type = body.type;
  const content = body.content?.trim() ?? "";
  const mediaUrl = body.mediaUrl?.trim();

  if (!conversationId || !type || !allowedTypes.has(type)) {
    return NextResponse.json(
      { error: "conversationId e um type suportado sao obrigatorios." },
      { status: 400 },
    );
  }

  if (type === "TEXT" && !content) {
    return NextResponse.json({ error: "A mensagem nao pode estar vazia." }, { status: 400 });
  }

  if (type !== "TEXT" && !mediaUrl) {
    return NextResponse.json({ error: "mediaUrl e obrigatoria para midia." }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId: session.tenantId },
    include: { contact: { select: { phone: true } } },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  const windowActive =
    conversation.is24hWindowActive &&
    Boolean(conversation.windowExpiresAt && conversation.windowExpiresAt > new Date());

  if (!windowActive) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { is24hWindowActive: false },
    });
    return NextResponse.json(
      {
        error:
          "A janela de atendimento de 24 horas expirou. Envie um Template pre-aprovado para retomar a conversa.",
        code: "WHATSAPP_WINDOW_EXPIRED",
      },
      { status: 422 },
    );
  }

  try {
    const result =
      type === "TEXT"
        ? await metaWhatsAppService.sendTextMessage(
            conversation.whatsappAccountId,
            conversation.contact.phone,
            content,
          )
        : await metaWhatsAppService.sendMediaMessage(
            conversation.whatsappAccountId,
            conversation.contact.phone,
            type.toLowerCase() as "image" | "audio" | "document",
            mediaUrl!,
            content || undefined,
          );
    const metaMessageId = result.messages[0]?.id;

    if (!metaMessageId) {
      return NextResponse.json(
        { error: "A Meta nao retornou o identificador da mensagem." },
        { status: 502 },
      );
    }

    const message = await prisma.$transaction(async (transaction) => {
      const created = await transaction.message.create({
        data: {
          tenantId: session.tenantId,
          conversationId: conversation.id,
          metaMessageId,
          direction: "OUTBOUND",
          type,
          content: content || `${type.toLowerCase()} enviado`,
          mediaUrl,
          status: "SENT",
        },
      });
      await transaction.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: created.createdAt },
      });
      return created;
    });
    const serialized = serializeChatMessage(message);
    const occurredAt = new Date().toISOString();

    await Promise.all([
      publishChatEvent({
        type: "NEW_MESSAGE",
        tenantId: session.tenantId,
        occurredAt,
        data: { conversationId: conversation.id, message: serialized },
      }),
      publishChatEvent({
        type: "CONVERSATION_UPDATED",
        tenantId: session.tenantId,
        occurredAt,
        data: { conversationId: conversation.id },
      }),
    ]);

    return NextResponse.json({ message: serialized }, { status: 201 });
  } catch (error) {
    if (error instanceof MetaWhatsAppError) {
      return NextResponse.json(
        { error: error.message, meta: error.toJSON() },
        { status: error.isRateLimit ? 429 : 502 },
      );
    }

    console.error("Falha no envio WhatsApp", error);
    return NextResponse.json({ error: "Nao foi possivel enviar a mensagem." }, { status: 500 });
  }
}
