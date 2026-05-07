import { Router } from 'express';
import { ROLES } from '../../constants/roles.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listUsers, updateUserActive, updateUserRole } from './user.controller.js';
import { listUsersSchema, updateUserActiveSchema, updateUserRoleSchema } from './user.validation.js';

export const userRoutes = Router();

userRoutes.use(requireAuth, requireRole(ROLES.ADMIN));
userRoutes.get('/', validate(listUsersSchema), listUsers);
userRoutes.patch('/:id/role', validate(updateUserRoleSchema), updateUserRole);
userRoutes.patch('/:id/active', validate(updateUserActiveSchema), updateUserActive);

