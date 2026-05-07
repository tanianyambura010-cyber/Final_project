import { z } from 'zod';

export const orderPaymentSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive()
  })
});

export const stripeIntentSchema = orderPaymentSchema;

export const syncStripePaymentSchema = orderPaymentSchema;
