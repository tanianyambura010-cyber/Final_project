import { env } from '../../config/env.js';
import { getRedis } from '../../config/redis.js';

function key(orderId) {
  return `tracking:orders:${orderId}:latest-location`;
}

export async function setLatestLocation(orderId, location) {
  const recordedLocation = {
    ...location,
    recordedAt: new Date().toISOString()
  };

  await getRedis().setEx(key(orderId), env.trackingLocationTtlSeconds, JSON.stringify(recordedLocation));

  return recordedLocation;
}

export async function getLatestLocation(orderId) {
  const value = await getRedis().get(key(orderId));

  return value ? JSON.parse(value) : null;
}
