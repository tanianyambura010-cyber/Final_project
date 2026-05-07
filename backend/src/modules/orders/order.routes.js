import { Router } from 'express';
import { STAFF_ROLES } from '../../constants/roles.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  assignRider,
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus
} from './order.controller.js';
import {
  assignRiderSchema,
  createOrderSchema,
  listOrdersSchema,
  orderIdSchema,
  updateOrderStatusSchema
} from './order.validation.js';

export const orderRoutes = Router();

orderRoutes.use(requireAuth);
orderRoutes.get('/', validate(listOrdersSchema), listOrders);
orderRoutes.post('/', validate(createOrderSchema), createOrder);
orderRoutes.get('/:id', validate(orderIdSchema), getOrder);
orderRoutes.patch('/:id/status', validate(updateOrderStatusSchema), updateOrderStatus);
orderRoutes.patch(
  '/:id/assign-rider',
  requireRole(...STAFF_ROLES),
  validate(assignRiderSchema),
  assignRider
);

