import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { ROLES, STAFF_ROLES } from '../../constants/roles.js';
import { canReadOrder } from '../orders/order-access.js';
import { setLatestLocation } from './location-store.js';

async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    next(new Error('Authentication token is required.'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret);
    const users = await query(
      `SELECT id, name, email, phone, role, is_active
       FROM users
       WHERE id = :id
       LIMIT 1`,
      { id: payload.sub }
    );
    const user = users[0];

    if (!user || !user.is_active) {
      next(new Error('User is inactive or unavailable.'));
      return;
    }

    socket.user = user;
    next();
  } catch (_error) {
    next(new Error('Invalid or expired token.'));
  }
}

async function getOrder(orderId) {
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

function validCoordinate(payload) {
  return (
    Number.isFinite(Number(payload?.latitude)) &&
    Number(payload.latitude) >= -90 &&
    Number(payload.latitude) <= 90 &&
    Number.isFinite(Number(payload?.longitude)) &&
    Number(payload.longitude) >= -180 &&
    Number(payload.longitude) <= 180
  );
}

export function registerTrackingSocket(io) {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    socket.on('order:track', async ({ orderId }, callback) => {
      try {
        const order = await getOrder(orderId);

        if (!order || !canReadOrder(socket.user, order)) {
          callback?.({ ok: false, message: 'Order tracking is not available.' });
          return;
        }

        socket.join(`order:${orderId}`);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on('rider:location:update', async (payload, callback) => {
      try {
        if (socket.user.role !== ROLES.RIDER) {
          callback?.({ ok: false, message: 'Only riders can broadcast location.' });
          return;
        }

        if (!validCoordinate(payload)) {
          callback?.({ ok: false, message: 'Invalid coordinates.' });
          return;
        }

        const order = await getOrder(payload.orderId);

        if (!order || Number(order.rider_user_id) !== Number(socket.user.id)) {
          callback?.({ ok: false, message: 'Order is not assigned to this rider.' });
          return;
        }

        const location = {
          riderUserId: socket.user.id,
          orderId: Number(payload.orderId),
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          heading: payload.heading == null ? null : Number(payload.heading),
          speed: payload.speed == null ? null : Number(payload.speed)
        };

        const recordedLocation = await setLatestLocation(payload.orderId, location);

        await query(
          `INSERT INTO rider_locations (rider_id, order_id, latitude, longitude, heading, speed)
           SELECT rp.id, :orderId, :latitude, :longitude, :heading, :speed
           FROM rider_profiles rp
           WHERE rp.user_id = :riderUserId`,
          location
        );

        io.to(`order:${payload.orderId}`).emit('rider:location', recordedLocation);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on('staff:watch-active-orders', (_payload, callback) => {
      if (!STAFF_ROLES.includes(socket.user.role)) {
        callback?.({ ok: false, message: 'Staff access is required.' });
        return;
      }

      socket.join('staff:active-orders');
      callback?.({ ok: true });
    });
  });
}
