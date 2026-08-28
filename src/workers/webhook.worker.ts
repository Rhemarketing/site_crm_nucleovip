import {
  CampaignRecipientStatus,
  MessageStatus,
  MessageType,
  Prisma,
} from "@prisma/client";
import { Worker } from "bullmq";

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { publishChatEvent } from "@/lib/chat-events";
import { serializeChatMessage } from "@/lib/chat-serializers";
import { botEngineService } from "@/services/bot-engine.service";
import {
  WEBHOOK_QUEUE_NAME,
  type WebhookJobData,
} from "@/queues/webhook.queue";
import type {
  MetaWebhookMessage,
  MetaWebhookStatus,
  MetaWebhookValue,
} from "@/types/meta-webhook";

type TransactionClient = Prisma.TransactionClient;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getMessageDate(timestamp?: string) {
  const milliseconds = Number(timestamp) * 1_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getMessageData(message: MetaWebhookMessage): {
  type: MessageType;
  content: string;
  mediaUrl?: string;
} {
  switch (message.type) {
    case "text":
      return { type: "TEXT", content: message.text?.body ?? "" };
    case "image":
      return {
        type: "IMAGE",
        content: message.image?.caption ?? "Imagem recebida",
        mediaUrl: message.image?.id,
      };
    case "audio":
      return {
        type: "AUDIO",
        content: "Audio recebido",
        mediaUrl: message.audio?.id,
      };
    case "document":
      return {
        type: "DOCUMENT",
        content:
          message.document?.caption ??
          message.document?.filename ??
          "Documento recebido",
        mediaUrl: message.document?.id,
      };
    case "interactive":
    case "button":
      return {
        type: "INTERACTIVE",
        content: JSON.stringify(message.interactive ?? message.button ?? {}),
      };
    case "template":
      return { type: "TEMPLATE", content: JSON.stringify(message.template ?? {}) };
    default:
      return { type: "TEXT", content: JSON.stringify(message) };
  }
}

function getProfileName(value: MetaWebhookValue, phone: string) {
  return value.contacts?.find((contact) => contact.wa_id === phone)?.profile?.name;
}

async function processInboundMessage(
  transaction: TransactionClient,
  data: WebhookJobData,
  value: MetaWebhookValue,
  message: MetaWebhookMessage,
) {
  if (!message.id || !message.from) return null;

  const existingMessage = await transaction.message.findUnique({
    where: {
      tenantId_metaMessageId: {
        tenantId: data.tenantId,
        metaMessageId: message.id,
      },
    },
  });

  if (existingMessage) {
    return {
      conversationId: existingMessage.conversationId,
      message: serializeChatMessage(existingMessage),
      isNew: false,
    };
  }

  const profileName = getProfileName(value, message.from);
  const contact = await transaction.contact.upsert({
    where: {
      tenantId_phone: { tenantId: data.tenantId, phone: message.from },
    },
    create: {
      tenantId: data.tenantId,
      phone: message.from,
      name: profileName ?? message.from,
    },
    update: profileName ? { name: profileName } : {},
  });

  let conversation = await transaction.conversation.findFirst({
    where: {
      tenantId: data.tenantId,
      whatsappAccountId: data.whatsappAccountId,
      contactId: contact.id,
      status: "OPEN",
    },
    orderBy: { createdAt: "desc" },
  });

  const messageDate = getMessageDate(message.timestamp);
  const windowExpiresAt = new Date(messageDate.getTime() + 24 * 60 * 60 * 1_000);

  if (!conversation) {
    conversation = await transaction.conversation.create({
      data: {
        tenantId: data.tenantId,
        whatsappAccountId: data.whatsappAccountId,
        contactId: contact.id,
        status: "OPEN",
        lastMessageAt: messageDate,
        unreadCount: 0,
        is24hWindowActive: true,
        windowExpiresAt,
      },
    });
  }

  const parsed = getMessageData(message);
  const createdMessage = await transaction.message.create({
    data: {
      tenantId: data.tenantId,
      conversationId: conversation.id,
      metaMessageId: message.id,
      direction: "INBOUND",
      type: parsed.type,
      content: parsed.content,
      mediaUrl: parsed.mediaUrl,
      status: "DELIVERED",
      metadata: toJson(message),
      createdAt: messageDate,
    },
  });

  await transaction.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: messageDate,
      unreadCount: { increment: 1 },
      is24hWindowActive: true,
      windowExpiresAt,
    },
  });

  return {
    conversationId: conversation.id,
    message: serializeChatMessage(createdMessage),
    isNew: true,
  };
}

function mapMessageStatus(status?: string): MessageStatus | null {
  const statuses: Record<string, MessageStatus> = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  };
  return status ? statuses[status] ?? null : null;
}

const messageStatusRank: Record<MessageStatus | CampaignRecipientStatus, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
};

async function processMessageStatus(
  transaction: TransactionClient,
  tenantId: string,
  status: MetaWebhookStatus,
) {
  const mappedStatus = mapMessageStatus(status.status);
  if (!status.id || !mappedStatus) return null;

  const message = await transaction.message.findFirst({
    where: { tenantId, metaMessageId: status.id },
    select: {
      id: true,
      conversationId: true,
      metaMessageId: true,
      status: true,
    },
  });

  if (!message) return null;

  const effectiveStatus =
    messageStatusRank[mappedStatus] >= messageStatusRank[message.status]
      ? mappedStatus
      : message.status;

  if (effectiveStatus !== message.status) {
    await transaction.message.update({
      where: { id: message.id },
      data: {
        status: mappedStatus,
        metadata: toJson(status),
      },
    });
  }

  const recipient = await transaction.campaignRecipient.findUnique({
    where: { messageId: message.id },
  });
  let campaignProgress = null;

  if (
    recipient &&
    recipient.status !== mappedStatus &&
    messageStatusRank[mappedStatus] >= messageStatusRank[recipient.status]
  ) {
    const deliveredIncrement =
      (mappedStatus === "DELIVERED" || mappedStatus === "READ") &&
      recipient.status === "SENT"
        ? 1
        : 0;
    const readIncrement = mappedStatus === "READ" && recipient.status !== "READ" ? 1 : 0;
    const failedIncrement =
      mappedStatus === "FAILED" && recipient.status !== "FAILED" ? 1 : 0;

    await transaction.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: mappedStatus },
    });
    campaignProgress = await transaction.campaign.update({
      where: { id: recipient.campaignId },
      data: {
        ...(deliveredIncrement
          ? { deliveredCount: { increment: deliveredIncrement } }
          : {}),
        ...(readIncrement ? { readCount: { increment: readIncrement } } : {}),
        ...(failedIncrement ? { failedCount: { increment: failedIncrement } } : {}),
      },
      select: {
        id: true,
        status: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        totalRecipients: true,
      },
    });
  }

  return {
    messageId: message.id,
    conversationId: message.conversationId,
    metaMessageId: message.metaMessageId,
    status: effectiveStatus,
    campaignProgress,
  };
}

export async function processWebhookJob(data: WebhookJobData) {
  for (const entry of data.rawPayload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      if (value?.metadata?.phone_number_id !== data.phoneNumberId) continue;

      const events = await prisma.$transaction(async (transaction) => {
        const transactionEvents: Array<
          | { kind: "message"; result: NonNullable<Awaited<ReturnType<typeof processInboundMessage>>> }
          | { kind: "status"; result: NonNullable<Awaited<ReturnType<typeof processMessageStatus>>> }
        > = [];

        for (const message of value.messages ?? []) {
          const result = await processInboundMessage(transaction, data, value, message);
          if (result) transactionEvents.push({ kind: "message", result });
        }

        for (const status of value.statuses ?? []) {
          const result = await processMessageStatus(transaction, data.tenantId, status);
          if (result) transactionEvents.push({ kind: "status", result });
        }

        return transactionEvents;
      });

      for (const event of events) {
        const occurredAt = new Date().toISOString();

        if (event.kind === "message") {
          await Promise.all([
            publishChatEvent({
              type: "NEW_MESSAGE",
              tenantId: data.tenantId,
              occurredAt,
              data: event.result,
            }),
            publishChatEvent({
              type: "CONVERSATION_UPDATED",
              tenantId: data.tenantId,
              occurredAt,
              data: { conversationId: event.result.conversationId },
            }),
          ]);
          if (event.result.isNew) {
            try {
              await botEngineService.processIncomingMessage(
                data.tenantId,
                event.result.conversationId,
                event.result.message.content,
              );
            } catch (error) {
              console.error("Falha ao executar fluxo do bot", {
                conversationId: event.result.conversationId,
                error,
              });
            }
          }
        } else {
          await publishChatEvent({
            type: "MESSAGE_STATUS_UPDATED",
            tenantId: data.tenantId,
            occurredAt,
            data: event.result,
          });
          if (event.result.campaignProgress) {
            const campaign = event.result.campaignProgress;
            await publishChatEvent({
              type: "CAMPAIGN_PROGRESS",
              tenantId: data.tenantId,
              occurredAt,
              data: {
                campaignId: campaign.id,
                status: campaign.status,
                sentCount: campaign.sentCount,
                deliveredCount: campaign.deliveredCount,
                readCount: campaign.readCount,
                failedCount: campaign.failedCount,
                totalRecipients: campaign.totalRecipients,
                percentage: campaign.totalRecipients
                  ? Math.min(
                      100,
                      Math.round(
                        ((campaign.sentCount + campaign.failedCount) /
                          campaign.totalRecipients) *
                          100,
                      ),
                    )
                  : 0,
              },
            });
          }
        }
      }
    }
  }
}

export const webhookWorker = new Worker<WebhookJobData>(
  WEBHOOK_QUEUE_NAME,
  (job) => processWebhookJob(job.data),
  { connection: redis, concurrency: 10 },
);

webhookWorker.on("completed", (job) => {
  console.info("Webhook processado", { jobId: job.id });
});

webhookWorker.on("failed", (job, error) => {
  console.error("Falha ao processar webhook", { jobId: job?.id, error });
});
