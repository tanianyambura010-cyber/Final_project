import { env } from '../../config/env.js';
import { query, transaction } from '../../config/db.js';
import { ALLOWED_ORDER_TRANSITIONS } from '../../constants/order-status.js';
import { ROLES, STAFF_ROLES } from '../../constants/roles.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { badRequest, forbidden, notFound } from '../../utils/http-error.js';
import { canReadOrder } from './order-access.js';

function mapOrder(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    riderId: row.rider_id,
    riderUserId: row.rider_user_id,
    riderName: row.rider_name,
    deliveryAddress: row.delivery_address,
    deliveryLatitude: row.delivery_latitude,
    deliveryLongitude: row.delivery_longitude,
    deliveryNotes: row.delivery_notes,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    totalAmount: row.total_amount,
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOrderItem(row) {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: row.item_name_snapshot,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total
  };
}

async function findOrderById(id) {
  const rows = await query(
    `SELECT o.*,
            c.name AS customer_name,
            rp.user_id AS rider_user_id,
            ru.name AS rider_name
     FROM orders o
     JOIN users c ON c.id = o.customer_id
     LEFT JOIN rider_profiles rp ON rp.id = o.rider_id
     LEFT JOIN users ru ON ru.id = rp.user_id
     WHERE o.id = :id
     LIMIT 1`,
    { id }
  );

  return rows[0];
}

async function loadOrderItems(orderId) {
  return query(
    `SELECT *
     FROM order_items
     WHERE order_id = :orderId
     ORDER BY id ASC`,
    { orderId }
  );
}

export const createOrder = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.CUSTOMER) {
    throw forbidden('Only customers can place orders.');
  }

  const {
    items,
    deliveryAddress,
    deliveryLatitude,
    deliveryLongitude,
    deliveryNotes = null,
    paymentMethod
  } = req.validated.body;
  const menuIds = [...new Set(items.map((item) => item.menuItemId))];
  const placeholders = menuIds.map((_, index) => `:id${index}`).join(', ');
  const params = Object.fromEntries(menuIds.map((id, index) => [`id${index}`, id]));
  const menuRows = await query(
    `SELECT id, name, price, is_available
     FROM menu_items
     WHERE id IN (${placeholders})`,
    params
  );
  const menuById = new Map(menuRows.map((item) => [Number(item.id), item]));

  for (const item of items) {
    const menuItem = menuById.get(Number(item.menuItemId));

    if (!menuItem) {
      throw badRequest(`Menu item ${item.menuItemId} does not exist.`);
    }

    if (!menuItem.is_available) {
      throw badRequest(`${menuItem.name} is currently unavailable.`);
    }
  }

  const subtotal = items.reduce((sum, item) => {
    const menuItem = menuById.get(Number(item.menuItemId));
    return sum + Number(menuItem.price) * item.quantity;
  }, 0);
  const deliveryFee = env.deliveryFee;
  const totalAmount = subtotal + deliveryFee;

  const orderId = await transaction(async (connection) => {
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
        customer_id, delivery_address, delivery_latitude, delivery_longitude,
        delivery_notes, subtotal, delivery_fee, total_amount, status, payment_status
      )
      VALUES (
        :customerId, :deliveryAddress, :deliveryLatitude, :deliveryLongitude,
        :deliveryNotes, :subtotal, :deliveryFee, :totalAmount, 'created', 'pending'
      )`,
      {
        customerId: req.user.id,
        deliveryAddress,
        deliveryLatitude,
        deliveryLongitude,
        deliveryNotes,
        subtotal,
        deliveryFee,
        totalAmount
      }
    );

    for (const item of items) {
      const menuItem = menuById.get(Number(item.menuItemId));
      const lineTotal = Number(menuItem.price) * item.quantity;

      await connection.execute(
        `INSERT INTO order_items (
          order_id, menu_item_id, item_name_snapshot, quantity, unit_price, line_total
        )
        VALUES (:orderId, :menuItemId, :name, :quantity, :unitPrice, :lineTotal)`,
        {
          orderId: orderResult.insertId,
          menuItemId: item.menuItemId,
          name: menuItem.name,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          lineTotal
        }
      );
    }

    await connection.execute(
      `INSERT INTO payments (order_id, method, status, amount)
       VALUES (:orderId, :method, 'pending', :amount)`,
      {
        orderId: orderResult.insertId,
        method: paymentMethod,
        amount: totalAmount
      }
    );

    return orderResult.insertId;
  });

  const order = await findOrderById(orderId);
  const orderItems = await loadOrderItems(orderId);

  res.status(201).json({
    order: mapOrder(order),
    items: orderItems.map(mapOrderItem)
  });
});

export const listOrders = asyncHandler(async (req, res) => {
  const { status } = req.validated.query;
  const filters = [];
  const params = {};

  if (status) {
    filters.push('o.status = :status');
    params.status = status;
  }

  if (req.user.role === ROLES.CUSTOMER) {
    filters.push('o.customer_id = :customerId');
    params.customerId = req.user.id;
  }

  if (req.user.role === ROLES.RIDER) {
    filters.push('rp.user_id = :riderUserId');
    params.riderUserId = req.user.id;
  }

  const rows = await query(
    `SELECT o.*,
            c.name AS customer_name,
            rp.user_id AS rider_user_id,
            ru.name AS rider_name
     FROM orders o
     JOIN users c ON c.id = o.customer_id
     LEFT JOIN rider_profiles rp ON rp.id = o.rider_id
     LEFT JOIN users ru ON ru.id = rp.user_id
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY o.created_at DESC`,
    params
  );

  res.json({ orders: rows.map(mapOrder) });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await findOrderById(req.validated.params.id);

  if (!order) {
    throw notFound('Order was not found.');
  }

  if (!canReadOrder(req.user, order)) {
    throw forbidden();
  }

  const items = await loadOrderItems(order.id);

  res.json({
    order: mapOrder(order),
    items: items.map(mapOrderItem)
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { status: nextStatus } = req.validated.body;
  const order = await findOrderById(id);

  if (!order) {
    throw notFound('Order was not found.');
  }

  if (!STAFF_ROLES.includes(req.user.role) && req.user.role !== ROLES.RIDER) {
    throw forbidden();
  }

  if (req.user.role === ROLES.RIDER && Number(order.rider_user_id) !== Number(req.user.id)) {
    throw forbidden('Riders can only update orders assigned to them.');
  }

  const allowed = ALLOWED_ORDER_TRANSITIONS[order.status] ?? [];

  if (!allowed.includes(nextStatus)) {
    throw badRequest(`Order cannot move from ${order.status} to ${nextStatus}.`);
  }

  await query('UPDATE orders SET status = :status WHERE id = :id', { id, status: nextStatus });

  if (nextStatus === 'delivered') {
    await query('UPDATE rider_profiles SET current_status = "available" WHERE id = :riderId', {
      riderId: order.rider_id
    });
  }

  const updated = await findOrderById(id);

  res.json({ order: mapOrder(updated) });
});

export const assignRider = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { riderId } = req.validated.body;
  const order = await findOrderById(id);

  if (!order) {
    throw notFound('Order was not found.');
  }

  const riders = await query(
    `SELECT rp.id, rp.current_status, u.is_active
     FROM rider_profiles rp
     JOIN users u ON u.id = rp.user_id
     WHERE rp.id = :riderId
     LIMIT 1`,
    { riderId }
  );
  const rider = riders[0];

  if (!rider || !rider.is_active) {
    throw badRequest('Selected rider is unavailable.');
  }

  await transaction(async (connection) => {
    await connection.execute('UPDATE orders SET rider_id = :riderId WHERE id = :id', { id, riderId });
    await connection.execute('UPDATE rider_profiles SET current_status = "busy" WHERE id = :riderId', { riderId });
  });

  const updated = await findOrderById(id);

  res.json({ order: mapOrder(updated) });
});
