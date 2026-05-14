import { env } from '../../config/env.js';
import { query, transaction } from '../../config/db.js';
import { ALLOWED_ORDER_TRANSITIONS } from '../../constants/order-status.js';
import { ROLES, STAFF_ROLES } from '../../constants/roles.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { badRequest, forbidden, notFound } from '../../utils/http-error.js';
import { canReadOrder } from './order-access.js';
import {
  createOrderNotification,
  emitCustomerOrderNotification,
  emitRiderOrderNotification,
  emitStaffOrderNotification,
  emitTrackedOrderNotification
} from './order-events.js';

const ORDER_STATUS_LABELS = {
  created: 'pending',
  confirmed: 'accepted',
  preparing: 'preparing',
  ready_for_delivery: 'ready for delivery',
  out_for_delivery: 'out for delivery',
  delivered: 'delivered',
  completed: 'completed',
  cancelled: 'cancelled'
};

function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceInKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(toLatitude - fromLatitude);
  const longitudeDelta = degreesToRadians(toLongitude - fromLongitude);
  const startLatitude = degreesToRadians(fromLatitude);
  const endLatitude = degreesToRadians(toLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function calculateDeliveryFee(deliveryLatitude, deliveryLongitude) {
  // Work out delivery cost from the restaurant to the customer GPS point.
  const distanceKm = distanceInKm(
    env.restaurant.latitude,
    env.restaurant.longitude,
    Number(deliveryLatitude),
    Number(deliveryLongitude)
  );
  const billableDistanceKm = Math.max(distanceKm - env.deliveryIncludedKm, 0);

  return Math.round(env.deliveryFirstKmFee + billableDistanceKm * env.deliveryFeePerKm);
}

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
            rp.current_status AS rider_current_status,
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
  const deliveryFee = calculateDeliveryFee(deliveryLatitude, deliveryLongitude);
  const totalAmount = subtotal + deliveryFee;

  // Save the order, its items, and its payment record together.
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

  emitStaffOrderNotification(
    req,
    createOrderNotification('order_created', order, `New order #${order.id} has been created.`)
  );
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
            rp.current_status AS rider_current_status,
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
  const { status: requestedStatus } = req.validated.body;
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
  const riderAcceptingDelivery =
    req.user.role === ROLES.RIDER &&
    requestedStatus === 'out_for_delivery' &&
    ['confirmed', 'preparing', 'ready_for_delivery'].includes(order.status);

  if (!allowed.includes(requestedStatus) && !riderAcceptingDelivery) {
    throw badRequest(`Order cannot move from ${order.status} to ${requestedStatus}.`);
  }

  if (requestedStatus === 'out_for_delivery' && !order.rider_id) {
    throw badRequest('Assign an online rider before marking this order out for delivery.');
  }

  if (requestedStatus === 'out_for_delivery' && order.rider_current_status !== 'available') {
    throw badRequest('The assigned rider must be online before this order can go out for delivery.');
  }

  // A rider marking delivered closes the order for the customer.
  const finalStatus =
    req.user.role === ROLES.RIDER && requestedStatus === 'delivered' ? 'completed' : requestedStatus;

  await query('UPDATE orders SET status = :status WHERE id = :id', { id, status: finalStatus });

  if (requestedStatus === 'delivered' || finalStatus === 'completed') {
    await query('UPDATE rider_profiles SET current_status = "available" WHERE id = :riderId', {
      riderId: order.rider_id
    });
  }

  const updated = await findOrderById(id);
  const deliveredByRider = req.user.role === ROLES.RIDER && requestedStatus === 'delivered';
  const notification = createOrderNotification(
    deliveredByRider ? 'order_delivered' : 'order_status_updated',
    updated,
    deliveredByRider
      ? `Order #${updated.id} has been delivered by ${updated.rider_name ?? 'the rider'} and is now complete.`
      : `Order #${updated.id} is now ${orderStatusLabel(updated.status)}.`
  );

  emitStaffOrderNotification(req, notification);
  emitCustomerOrderNotification(req, updated.customer_id, notification);
  emitRiderOrderNotification(req, updated.rider_user_id, notification);
  emitTrackedOrderNotification(req, updated.id, notification);

  res.json({ order: mapOrder(updated) });
});

export const assignRider = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { riderId } = req.validated.body;
  const order = await findOrderById(id);

  if (!order) {
    throw notFound('Order was not found.');
  }

  if (['out_for_delivery', 'delivered', 'completed', 'cancelled'].includes(order.status)) {
    throw badRequest('A rider can only be assigned before delivery starts.');
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
    throw badRequest('Selected rider does not exist or is inactive.');
  }

  if (rider.current_status !== 'available') {
    throw badRequest('Only online riders can be assigned to an order.');
  }

  // Attach the selected online rider to this order.
  await transaction(async (connection) => {
    await connection.execute('UPDATE orders SET rider_id = :riderId WHERE id = :id', { id, riderId });
  });

  const updated = await findOrderById(id);
  const notification = createOrderNotification(
    'rider_assigned',
    updated,
    `Order #${updated.id} was assigned to ${updated.rider_name}.`
  );

  emitStaffOrderNotification(req, notification);
  emitCustomerOrderNotification(req, updated.customer_id, notification);
  emitTrackedOrderNotification(req, updated.id, notification);
  emitRiderOrderNotification(
    req,
    updated.rider_user_id,
    createOrderNotification('delivery_assigned', updated, `New delivery assigned: Order #${updated.id}.`)
  );

  res.json({ order: mapOrder(updated) });
});
