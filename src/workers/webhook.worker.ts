import {
  MessageStatus,
  MessageType,
  Prisma,
} from "@prisma/client";
import { Worker } from "bullmq";

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
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
  if (!message.id || !message.from) return;

  const existingMessage = await transaction.message.findUnique({
    where: {
      tenantId_metaMessageId: {
        tenantId: data.tenantId,
        metaMessageId: message.id,
      },
    },
    select: { id: true },
  });

  if (existingMessage) return;

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
  await transaction.message.create({
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

async function processMessageStatus(
  transaction: TransactionClient,
  tenantId: string,
  status: MetaWebhookStatus,
) {
  const mappedStatus = mapMessageStatus(status.status);
  if (!status.id || !mappedStatus) return;

  await transaction.message.updateMany({
    where: { tenantId, metaMessageId: status.id },
    data: {
      status: mappedStatus,
      metadata: toJson(status),
    },
  });
}

export async function processWebhookJob(data: WebhookJobData) {
  for (const entry of data.rawPayload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      if (value?.metadata?.phone_number_id !== data.phoneNumberId) continue;

      await prisma.$transaction(async (transaction) => {
        for (const message of value.messages ?? []) {
          await processInboundMessage(transaction, data, value, message);
        }

        for (const status of value.statuses ?? []) {
          await processMessageStatus(transaction, data.tenantId, status);
        }
      });
    }
  }
}

const worker = new Worker<WebhookJobData>(
  WEBHOOK_QUEUE_NAME,
  (job) => processWebhookJob(job.data),
  { connection: redis, concurrency: 10 },
);

worker.on("completed", (job) => {
  console.info("Webhook processado", { jobId: job.id });
});

worker.on("failed", (job, error) => {
  console.error("Falha ao processar webhook", { jobId: job?.id, error });
});

async function shutdown(signal: string) {
  console.info(`Encerrando webhook worker (${signal})`);
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
