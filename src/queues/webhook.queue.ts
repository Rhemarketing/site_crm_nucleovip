import { Queue } from "bullmq";

import { redis } from "@/lib/redis";
import type { MetaWebhookPayload } from "@/types/meta-webhook";

export const WEBHOOK_QUEUE_NAME = "whatsapp-webhooks";

export type WebhookJobData = {
  tenantId: string;
  whatsappAccountId: string;
  phoneNumberId: string;
  rawPayload: MetaWebhookPayload;
  receivedAt: string;
};

let webhookQueue: Queue<WebhookJobData> | undefined;

export function getWebhookQueue() {
  webhookQueue ??= new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 2_000,
      removeOnFail: 10_000,
    },
  });

  return webhookQueue;
}
