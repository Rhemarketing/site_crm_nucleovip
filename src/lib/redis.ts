import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
