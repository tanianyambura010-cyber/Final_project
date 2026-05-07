import { createClient } from 'redis';
import { env } from './env.js';

let client;

export function getRedis() {
  if (!client) {
    client = createClient({ url: env.redis.url });
    client.on('error', (error) => {
      console.error('Redis error:', error.message);
    });
  }

  return client;
}

export async function connectRedis() {
  const redis = getRedis();

  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
}

export async function closeRedis() {
  if (client?.isOpen) {
    await client.quit();
  }
}

