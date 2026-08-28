import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { serializeCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireCurrentUser();
  const { id } = await context.params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      whatsappAccount: {
        select: { id: true, name: true, phoneNumberId: true },
      },
      template: {
        select: {
          id: true,
          name: true,
          language: true,
          category: true,
          components: true,
        },
      },
      recipients: {
        include: {
          contact: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      },
    },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  const messageIds = campaign.recipients
    .map((recipient) => recipient.messageId)
    .filter((id): id is string => Boolean(id));
  const messages = messageIds.length
    ? await prisma.message.findMany({
        where: { tenantId: session.tenantId, id: { in: messageIds } },
        select: {
          id: true,
          metaMessageId: true,
          content: true,
          status: true,
          createdAt: true,
        },
      })
    : [];
  const messagesById = new Map(messages.map((message) => [message.id, message]));

  return NextResponse.json({
    campaign: serializeCampaign({
      ...campaign,
      recipients: campaign.recipients.map((recipient) => ({
        ...recipient,
        message: recipient.messageId
          ? messagesById.get(recipient.messageId) ?? null
          : null,
      })),
    }),
  });
}
