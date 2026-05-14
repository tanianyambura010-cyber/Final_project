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

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(160),
    phone: z.string().min(7).max(30),
    password: z.string().min(8).max(100),
    role: z.enum(['staff', 'admin']).default('staff')
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

