import type { ChatEvent } from "@/types/chat";
import { createRedisConnection } from "@/lib/redis";

const globalForPublisher = globalThis as unknown as {
  chatEventPublisher: ReturnType<typeof createRedisConnection> | undefined;
};

const publisher =
  globalForPublisher.chatEventPublisher ?? createRedisConnection();

if (process.env.NODE_ENV !== "production") {
  globalForPublisher.chatEventPublisher = publisher;
}

export function getTenantEventsChannel(tenantId: string) {
  return `tenant:${tenantId}:events`;
}

export async function publishChatEvent(event: ChatEvent) {
  await publisher.publish(
    getTenantEventsChannel(event.tenantId),
    JSON.stringify(event),
  );
}
