import { z } from 'zod';

export const orderTrackingSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive()
  })
});

