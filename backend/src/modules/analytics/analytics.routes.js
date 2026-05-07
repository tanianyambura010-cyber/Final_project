import { Router } from 'express';
import { query } from '../../config/db.js';
import { STAFF_ROLES } from '../../constants/roles.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth, requireRole(...STAFF_ROLES));

analyticsRoutes.get(
  '/daily',
  asyncHandler(async (_req, res) => {
    const [summary] = await query(
      `SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(AVG(total_amount), 0) AS average_order_value
       FROM orders
       WHERE DATE(created_at) = CURRENT_DATE
         AND payment_status = 'paid'`
    );

    const topItems = await query(
      `SELECT item_name_snapshot AS name,
              SUM(quantity) AS quantity_sold,
              SUM(line_total) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE DATE(o.created_at) = CURRENT_DATE
         AND o.payment_status = 'paid'
       GROUP BY item_name_snapshot
       ORDER BY quantity_sold DESC
       LIMIT 10`
    );

    res.json({
      summary,
      topItems
    });
  })
);

