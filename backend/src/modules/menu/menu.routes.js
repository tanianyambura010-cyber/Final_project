import { Router } from 'express';
import { STAFF_ROLES } from '../../constants/roles.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createMenuItem,
  getMenuItem,
  listMenuItems,
  updateAvailability,
  updateMenuItem
} from './menu.controller.js';
import {
  createMenuItemSchema,
  listMenuSchema,
  menuIdSchema,
  updateAvailabilitySchema,
  updateMenuItemSchema
} from './menu.validation.js';

export const menuRoutes = Router();

menuRoutes.get('/', validate(listMenuSchema), listMenuItems);
menuRoutes.get('/:id', validate(menuIdSchema), getMenuItem);
menuRoutes.post('/', requireAuth, requireRole(...STAFF_ROLES), validate(createMenuItemSchema), createMenuItem);
menuRoutes.patch('/:id', requireAuth, requireRole(...STAFF_ROLES), validate(updateMenuItemSchema), updateMenuItem);
menuRoutes.patch(
  '/:id/availability',
  requireAuth,
  requireRole(...STAFF_ROLES),
  validate(updateAvailabilitySchema),
  updateAvailability
);

