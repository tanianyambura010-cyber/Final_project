import { z } from 'zod';

const money = z.coerce.number().positive().max(999999);

export const listMenuSchema = z.object({
  query: z.object({
    category: z.string().optional(),
    available: z.enum(['true', 'false']).optional(),
    search: z.string().optional()
  })
});

export const menuIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});

export const createMenuItemSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(160),
    description: z.string().max(1000).optional(),
    category: z.string().min(2).max(80),
    price: money,
    imageUrl: z.string().url().optional(),
    isAvailable: z.boolean().optional()
  })
});

export const updateMenuItemSchema = z.object({
  params: menuIdSchema.shape.params,
  body: createMenuItemSchema.shape.body.partial()
});

export const updateAvailabilitySchema = z.object({
  params: menuIdSchema.shape.params,
  body: z.object({
    isAvailable: z.boolean()
  })
});

