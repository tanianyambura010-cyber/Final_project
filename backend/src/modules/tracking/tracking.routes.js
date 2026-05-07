import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { latestOrderLocation } from './tracking.controller.js';
import { orderTrackingSchema } from './tracking.validation.js';

export const trackingRoutes = Router();

trackingRoutes.get('/orders/:orderId/latest', validate(orderTrackingSchema), latestOrderLocation);

