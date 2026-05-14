import dotenv from 'dotenv';

dotenv.config();

function read(name, fallback) {
  return process.env[name] ?? fallback;
}

function readNumber(name, fallback) {
  const value = Number(read(name, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function readBoolean(name, fallback = false) {
  const value = read(name, String(fallback)).toLowerCase();
  return ['true', '1', 'yes'].includes(value);
}

function readList(name, fallback = '') {
  return read(name, fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: read('NODE_ENV', 'development'),
  port: readNumber('PORT', 4000),
  corsOrigin: readList('CORS_ORIGIN', 'http://localhost:8081,http://localhost:19006,http://localhost:3000'),
  deliveryFirstKmFee: readNumber('DELIVERY_FIRST_KM_FEE', 50),
  deliveryFeePerKm: readNumber('DELIVERY_FEE_PER_KM', 50),
  deliveryIncludedKm: readNumber('DELIVERY_INCLUDED_KM', 1),
  restaurant: {
    name: read('RESTAURANT_NAME', 'Senate Hotel Juja'),
    latitude: readNumber('RESTAURANT_LATITUDE', -1.1059),
    longitude: readNumber('RESTAURANT_LONGITUDE', 37.01564)
  },
  allowAdminBootstrap: readBoolean('ALLOW_ADMIN_BOOTSTRAP', true),
  trackingLocationTtlSeconds: readNumber('TRACKING_LOCATION_TTL_SECONDS', 3600),
  jwt: {
    secret: read('JWT_SECRET', 'replace-with-a-long-random-secret'),
    expiresIn: read('JWT_EXPIRES_IN', '7d')
  },
  stripe: {
    secretKey: read('STRIPE_SECRET_KEY', ''),
    webhookSecret: read('STRIPE_WEBHOOK_SECRET', ''),
    currency: read('STRIPE_CURRENCY', 'kes').toLowerCase(),
    amountMultiplier: readNumber('STRIPE_AMOUNT_MULTIPLIER', 100)
  },
  redis: {
    url: read('REDIS_URL', 'redis://localhost:6379')
  },
  database: {
    host: read('DB_HOST', 'localhost'),
    port: readNumber('DB_PORT', 3306),
    user: read('DB_USER', 'root'),
    password: read('DB_PASSWORD', ''),
    name: read('DB_NAME', 'cafe_direct')
  }
};

if (env.nodeEnv === 'production' && env.jwt.secret === 'replace-with-a-long-random-secret') {
  throw new Error('JWT_SECRET must be set to a secure value in production.');
}

if (env.nodeEnv === 'production' && !env.stripe.secretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set in production.');
}
