import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  confirmDemoPayment,
  createStripePaymentIntent,
  getOrderPayment,
  syncStripePayment
} from './payment.controller.js';
import {
  demoPaymentSchema,
  orderPaymentSchema,
  stripeIntentSchema,
  syncStripePaymentSchema
} from './payment.validation.js';

export const paymentRoutes = Router();

paymentRoutes.use(requireAuth);
paymentRoutes.get('/orders/:orderId', validate(orderPaymentSchema), getOrderPayment);
paymentRoutes.post('/orders/:orderId/demo-confirm', validate(demoPaymentSchema), confirmDemoPayment);
paymentRoutes.post('/orders/:orderId/stripe-intent', validate(stripeIntentSchema), createStripePaymentIntent);
paymentRoutes.post('/orders/:orderId/sync-stripe', validate(syncStripePaymentSchema), syncStripePayment);
