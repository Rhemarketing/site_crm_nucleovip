import { CampaignStatus, Prisma } from "@prisma/client";
import { Worker } from "bullmq";

import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  buildTemplateSendComponents,
  renderTemplateText,
} from "@/lib/template-utils";
import {
  CAMPAIGN_QUEUE_NAME,
  type CampaignJobData,
} from "@/queues/campaign.queue";
import {
  MetaWhatsAppError,
  metaWhatsAppService,
} from "@/services/meta-whatsapp.service";

const sendIntervalMs = Math.min(
  5_000,
  Math.max(50, Number(process.env.CAMPAIGN_SEND_INTERVAL_MS ?? 75) || 75),
);

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendTemplateWithRateLimitRetry(input: {
  accountId: string;
  to: string;
  name: string;
  language: string;
  components: ReturnType<typeof buildTemplateSendComponents>;
}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await metaWhatsAppService.sendTemplateMessage(
        input.accountId,
        input.to,
        input.name,
        input.language,
        input.components,
      );
    } catch (error) {
      if (!(error instanceof MetaWhatsAppError) || !error.isRateLimit || attempt === 3) {
        throw error;
      }
      const retryAfterSeconds = Number(error.retryAfter ?? 0);
      const backoff = retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : 2_000 * 2 ** (attempt - 1);
      await wait(Math.min(60_000, backoff));
    }
  }
  throw new Error("Não foi possível enviar após novas tentativas.");
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asMapping(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function contactField(
  contact: {
    name: string;
    phone: string;
    email: string | null;
    customFields: unknown;
  },
  field: string,
) {
  if (field === "name") return contact.name;
  if (field === "firstName") return contact.name.trim().split(/\s+/)[0] ?? contact.name;
  if (field === "phone") return contact.phone;
  if (field === "email") return contact.email ?? "";
  if (field.startsWith("custom.")) {
    const customFields = asMapping(contact.customFields);
    return String(customFields[field.slice(7)] ?? "");
  }
  return "";
}

function resolveVariables(
  contact: {
    name: string;
    phone: string;
    email: string | null;
    customFields: unknown;
  },
  mappingsValue: unknown,
) {
  const mappings = asMapping(mappingsValue);
  return Object.fromEntries(
    Object.entries(mappings).map(([index, mapping]) => {
      if (typeof mapping === "string") {
        const value = contactField(contact, mapping);
        return [index, value || mapping];
      }
      const definition = asMapping(mapping);
      return [
        index,
        definition.type === "fixed"
          ? String(definition.value ?? "")
          : contactField(contact, String(definition.field ?? "name")),
      ];
    }),
  );
}

async function publishProgress(
  tenantId: string,
  campaign: {
    id: string;
    status: CampaignStatus;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    totalRecipients: number;
  },
) {
  const processed = campaign.sentCount + campaign.failedCount;
  await publishChatEvent({
    type: "CAMPAIGN_PROGRESS",
    tenantId,
    occurredAt: new Date().toISOString(),
    data: {
      campaignId: campaign.id,
      status: campaign.status,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      totalRecipients: campaign.totalRecipients,
      percentage: campaign.totalRecipients
        ? Math.min(100, Math.round((processed / campaign.totalRecipients) * 100))
        : 0,
    },
  });
}

async function getOrCreateConversation(
  tenantId: string,
  whatsappAccountId: string,
  contactId: string,
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      tenantId,
      whatsappAccountId,
      contactId,
      status: { in: ["OPEN", "PENDING"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      tenantId,
      whatsappAccountId,
      contactId,
      status: "OPEN",
      unreadCount: 0,
      is24hWindowActive: false,
    },
  });
}

export async function processCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });

  if (!campaign || ["CANCELLED", "COMPLETED", "FAILED"].includes(campaign.status)) {
    return;
  }

  const tagIds = asStringArray(campaign.tagIds);
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId: campaign.tenantId,
      ...(tagIds.length
        ? { contactTags: { some: { tagId: { in: tagIds } } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      customFields: true,
    },
    orderBy: { id: "asc" },
  });

  await prisma.$transaction([
    prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "PROCESSING",
        startedAt: campaign.startedAt ?? new Date(),
        totalRecipients: contacts.length,
      },
    }),
    prisma.campaignRecipient.createMany({
      data: contacts.map((contact) => ({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        contactId: contact.id,
        phone: contact.phone,
      })),
      skipDuplicates: true,
    }),
  ]);

  if (contacts.length === 0) {
    const failed = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
    await publishProgress(campaign.tenantId, failed);
    return;
  }

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId: campaign.id, status: "PENDING" },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          customFields: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  for (const [index, recipient] of recipients.entries()) {
    const current = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true, cancelRequestedAt: true },
    });
    if (!current || current.status === "CANCELLED" || current.cancelRequestedAt) break;

    const variables = resolveVariables(
      recipient.contact,
      campaign.variableMappings,
    );

    try {
      const conversation = await getOrCreateConversation(
        campaign.tenantId,
        campaign.whatsappAccountId,
        recipient.contactId,
      );
      const result = await sendTemplateWithRateLimitRetry({
        accountId: campaign.whatsappAccountId,
        to: recipient.phone,
        name: campaign.template.name,
        language: campaign.template.language,
        components: buildTemplateSendComponents(
          campaign.template.components,
          variables,
        ),
      });
      const metaMessageId = result.messages[0]?.id;
      if (!metaMessageId) throw new Error("A Meta não retornou o ID da mensagem.");

      const now = new Date();
      const updated = await prisma.$transaction(async (transaction) => {
        const message = await transaction.message.create({
          data: {
            tenantId: campaign.tenantId,
            conversationId: conversation.id,
            metaMessageId,
            direction: "OUTBOUND",
            type: "TEMPLATE",
            content: renderTemplateText(campaign.template.components, variables),
            status: "SENT",
            metadata: {
              campaignId: campaign.id,
              templateId: campaign.template.id,
              templateName: campaign.template.name,
              variables,
            } as Prisma.InputJsonValue,
          },
        });
        await transaction.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SENT",
            conversationId: conversation.id,
            messageId: message.id,
            sentAt: now,
          },
        });
        await transaction.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: now },
        });
        return transaction.campaign.update({
          where: { id: campaign.id },
          data: { sentCount: { increment: 1 } },
        });
      });
      await publishProgress(campaign.tenantId, updated);
    } catch (error) {
      const metaError = error instanceof MetaWhatsAppError ? error : null;
      const updated = await prisma.$transaction(async (transaction) => {
        await transaction.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "FAILED",
            errorCode: metaError?.code ? String(metaError.code) : null,
            errorMessage:
              error instanceof Error ? error.message.slice(0, 1_000) : "Falha desconhecida",
          },
        });
        return transaction.campaign.update({
          where: { id: campaign.id },
          data: { failedCount: { increment: 1 } },
        });
      });
      await publishProgress(campaign.tenantId, updated);
    }

    if (index < recipients.length - 1) {
      await wait(sendIntervalMs);
    }
  }

  const latest = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
  });
  const finalStatus: CampaignStatus =
    latest.status === "CANCELLED" || latest.cancelRequestedAt
      ? "CANCELLED"
      : latest.sentCount > 0
        ? "COMPLETED"
        : "FAILED";
  const finished = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: finalStatus, completedAt: new Date() },
  });
  await publishProgress(campaign.tenantId, finished);
}

export const campaignWorker = new Worker<CampaignJobData>(
  CAMPAIGN_QUEUE_NAME,
  (job) => processCampaign(job.data.campaignId),
  { connection: redis, concurrency: 1 },
);

campaignWorker.on("completed", (job) => {
  console.info("Campanha processada", {
    jobId: job.id,
    campaignId: job.data.campaignId,
  });
});

campaignWorker.on("failed", (job, error) => {
  console.error("Falha crítica ao processar campanha", {
    jobId: job?.id,
    campaignId: job?.data.campaignId,
    error,
  });
  if (job?.data.campaignId) {
    void prisma.campaign.updateMany({
      where: {
        id: job.data.campaignId,
        status: { in: ["QUEUED", "PROCESSING"] },
      },
      data: { status: "FAILED", completedAt: new Date() },
    });
  }
});
