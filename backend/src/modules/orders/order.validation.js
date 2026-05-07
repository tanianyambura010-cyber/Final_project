import { z } from 'zod';
import { ORDER_STATUSES } from '../../constants/order-status.js';

export const createOrderSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          menuItemId: z.coerce.number().int().positive(),
          quantity: z.coerce.number().int().positive().max(50)
        })
      )
      .min(1),
    deliveryAddress: z.string().min(5).max(500),
    deliveryLatitude: z.coerce.number().min(-90).max(90),
    deliveryLongitude: z.coerce.number().min(-180).max(180),
    deliveryNotes: z.string().max(500).optional(),
    paymentMethod: z.literal('stripe')
  })
});

export const listOrdersSchema = z.object({
  query: z.object({
    status: z.enum(ORDER_STATUSES).optional()
  })
});

export const orderIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});

export const updateOrderStatusSchema = z.object({
  params: orderIdSchema.shape.params,
  body: z.object({
    status: z.enum(ORDER_STATUSES)
  })
});

export const assignRiderSchema = z.object({
  params: orderIdSchema.shape.params,
  body: z.object({
    riderId: z.coerce.number().int().positive()
  })
});
