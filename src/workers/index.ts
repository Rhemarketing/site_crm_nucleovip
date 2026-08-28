import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { campaignWorker } from "@/workers/campaign.worker";
import { webhookWorker } from "@/workers/webhook.worker";

console.info("Workers iniciados", {
  webhooks: true,
  campaigns: true,
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Encerrando workers (${signal})`);
  await Promise.all([webhookWorker.close(), campaignWorker.close()]);
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
