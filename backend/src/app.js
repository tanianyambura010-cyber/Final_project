import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { menuRoutes } from './modules/menu/menu.routes.js';
import { orderRoutes } from './modules/orders/order.routes.js';
import { handleStripeWebhook } from './modules/payments/payment.controller.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { riderRoutes } from './modules/riders/rider.routes.js';
import { trackingRoutes } from './modules/tracking/tracking.routes.js';
import { userRoutes } from './modules/users/user.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigin.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin is not allowed by CORS.'));
      },
      credentials: true
    })
  );
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.post('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'Cafe Direct API',
      version: '0.1.0',
      docs: '/api/v1/health'
    });
  });

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/menu', menuRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/riders', riderRoutes);
  app.use('/api/v1/tracking', trackingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
