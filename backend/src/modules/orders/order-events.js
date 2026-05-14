function getIo(req) {
  return req.app.get('io');
}

export function createOrderNotification(type, order, message) {
  return {
    type,
    orderId: Number(order.id),
    customerId: Number(order.customer_id),
    status: order.status,
    paymentStatus: order.payment_status,
    riderUserId: order.rider_user_id ?? null,
    message,
    createdAt: new Date().toISOString()
  };
}

export function emitStaffOrderNotification(req, notification) {
  getIo(req)?.to('staff:active-orders').emit('order:notification', notification);
}

export function emitRiderOrderNotification(req, riderUserId, notification) {
  if (riderUserId) {
    getIo(req)?.to(`rider:${riderUserId}`).emit('order:notification', notification);
  }
}

export function emitCustomerOrderNotification(req, customerId, notification) {
  if (customerId) {
    getIo(req)?.to(`customer:${customerId}`).emit('order:notification', notification);
  }
}

export function emitTrackedOrderNotification(req, orderId, notification) {
  if (orderId) {
    getIo(req)?.to(`order:${orderId}`).emit('order:notification', notification);
  }
}
