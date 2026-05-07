import { z } from 'zod';

export const createRiderSchema = z.object({
  body: z.object({
    userId: z.coerce.number().int().positive(),
    vehicleType: z.string().min(2).max(80),
    plateNumber: z.string().max(40).optional()
  })
});

export const updateRiderStatusSchema = z.object({
  body: z.object({
    currentStatus: z.enum(['available', 'busy', 'offline'])
  })
});

