import { query } from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { forbidden, notFound } from '../../utils/http-error.js';
import { canReadOrder } from '../orders/order-access.js';
import { getLatestLocation } from './location-store.js';

async function getOrderForAccess(orderId) {
  const rows = await query(
    `SELECT o.*, rp.user_id AS rider_user_id
     FROM orders o
     LEFT JOIN rider_profiles rp ON rp.id = o.rider_id
     WHERE o.id = :orderId
     LIMIT 1`,
    { orderId }
  );

  return rows[0];
}

export const latestOrderLocation = [
  requireAuth,
  asyncHandler(async (req, res) => {
    const { orderId } = req.validated.params;
    const order = await getOrderForAccess(orderId);

    if (!order) {
      throw notFound('Order was not found.');
    }

    if (!canReadOrder(req.user, order)) {
      throw forbidden();
    }

    const cached = await getLatestLocation(orderId);

    if (cached) {
      res.json({ location: cached });
      return;
    }

    const rows = await query(
      `SELECT rider_id, order_id, latitude, longitude, heading, speed, recorded_at
       FROM rider_locations
       WHERE order_id = :orderId
       ORDER BY recorded_at DESC
       LIMIT 1`,
      { orderId }
    );

    res.json({ location: rows[0] ?? null });
  })
];
