import { Router } from 'express';
import { STAFF_ROLES } from '../../constants/roles.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createRiderProfile,
  getMyRiderProfile,
  listRiders,
  updateMyRiderStatus
} from './rider.controller.js';
import { createRiderSchema, updateRiderStatusSchema } from './rider.validation.js';

export const riderRoutes = Router();

riderRoutes.use(requireAuth);
riderRoutes.get('/', requireRole(...STAFF_ROLES), listRiders);
riderRoutes.post('/', requireRole(...STAFF_ROLES), validate(createRiderSchema), createRiderProfile);
riderRoutes.get('/me', getMyRiderProfile);
riderRoutes.patch('/me/status', validate(updateRiderStatusSchema), updateMyRiderStatus);

