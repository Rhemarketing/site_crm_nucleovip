import { Worker } from "bullmq";

import { redis } from "@/lib/redis";
import { MESSAGE_QUEUE_NAME, type SendMessageJob } from "@/queues/message.queue";

const worker = new Worker<SendMessageJob>(
  MESSAGE_QUEUE_NAME,
  async (job) => {
    // A integracao com a Graph API sera implementada na fase de mensageria.
    console.info("Processando mensagem", {
      jobId: job.id,
      tenantId: job.data.tenantId,
      messageId: job.data.messageId,
    });
  },
  { connection: redis, concurrency: 10 },
);

worker.on("failed", (job, error) => {
  console.error("Falha ao processar mensagem", { jobId: job?.id, error });
});

async function shutdown(signal: string) {
  console.info(`Encerrando worker (${signal})`);
  await worker.close();
  await redis.quit();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
