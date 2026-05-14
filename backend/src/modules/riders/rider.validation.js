import { z } from 'zod';

export const createRiderSchema = z.object({
  body: z
    .object({
      userId: z.coerce.number().int().positive().optional(),
      name: z.string().min(2).max(120).optional(),
      email: z.string().email().max(160).optional(),
      phone: z.string().min(7).max(30).optional(),
      password: z.string().min(8).max(100).optional(),
      vehicleType: z.string().min(2).max(80),
      plateNumber: z.string().max(40).optional()
    })
    .superRefine((body, context) => {
      if (body.userId) {
        return;
      }

      for (const field of ['name', 'email', 'phone', 'password']) {
        if (!body[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field} is required when creating a rider account.`,
            path: [field]
          });
        }
      }
    })
});

export const updateRiderStatusSchema = z.object({
  body: z.object({
    currentStatus: z.enum(['available', 'busy', 'offline'])
  })
});

