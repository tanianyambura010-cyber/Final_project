import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    role: z.enum(['customer', 'staff', 'rider', 'admin']).optional(),
    active: z.enum(['true', 'false']).optional(),
    search: z.string().optional()
  })
});

export const userIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});

export const updateUserRoleSchema = z.object({
  params: userIdSchema.shape.params,
  body: z.object({
    role: z.enum(['customer', 'staff', 'admin'])
  })
});

export const updateUserActiveSchema = z.object({
  params: userIdSchema.shape.params,
  body: z.object({
    isActive: z.boolean()
  })
});

