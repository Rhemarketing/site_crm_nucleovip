import Redis from "ioredis";

function getRedisOptions() {
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
  };
}

export function createRedisConnection() {
  return new Redis({
    ...getRedisOptions(),
    maxRetriesPerRequest: null,
  });
}

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis({
    ...getRedisOptions(),
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
