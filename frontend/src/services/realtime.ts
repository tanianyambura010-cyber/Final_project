import { io, type Socket } from 'socket.io-client';

import { API_ORIGIN_URL } from '../config/api';

type SocketAck = {
  ok: boolean;
  message?: string;
};

export type LocationUpdatePayload = {
  orderId: number;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
};

export type OrderRealtimeEvent = {
  type:
    | 'order_created'
    | 'payment_confirmed'
    | 'order_status_updated'
    | 'order_delivered'
    | 'rider_assigned'
    | 'delivery_assigned';
  orderId: number;
  customerId?: number;
  status: string;
  paymentStatus: string;
  riderUserId: number | null;
  message: string;
  createdAt: string;
};

export type TrackingSocket = Socket;

export function createTrackingSocket(token: string): TrackingSocket {
  return io(API_ORIGIN_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
}

function requireSuccessfulAck(ack: SocketAck | undefined, fallbackMessage: string) {
  if (!ack?.ok) {
    throw new Error(ack?.message ?? fallbackMessage);
  }
}

export function joinOrderTracking(socket: TrackingSocket, orderId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit('order:track', { orderId }, (ack?: SocketAck) => {
      try {
        requireSuccessfulAck(ack, 'Unable to join order tracking.');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function watchStaffActiveOrders(socket: TrackingSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit('staff:watch-active-orders', {}, (ack?: SocketAck) => {
      try {
        requireSuccessfulAck(ack, 'Unable to watch staff orders.');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function watchRiderOrders(socket: TrackingSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit('rider:watch-orders', {}, (ack?: SocketAck) => {
      try {
        requireSuccessfulAck(ack, 'Unable to watch rider orders.');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function sendRiderLocation(
  socket: TrackingSocket,
  payload: LocationUpdatePayload
): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit('rider:location:update', payload, (ack?: SocketAck) => {
      try {
        requireSuccessfulAck(ack, 'Unable to send rider location.');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}
