import { Queue } from "bullmq";

import { redis } from "@/lib/redis";

export const MESSAGE_QUEUE_NAME = "whatsapp-messages";

export type SendMessageJob = {
  tenantId: string;
  conversationId: string;
  messageId: string;
};

export const messageQueue = new Queue<SendMessageJob>(MESSAGE_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  },
});
