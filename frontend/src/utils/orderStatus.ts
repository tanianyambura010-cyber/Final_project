export const ORDER_STATUS_STEPS = [
  'created',
  'confirmed',
  'preparing',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
  'completed',
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  created: 'Pending',
  confirmed: 'Accepted',
  preparing: 'Preparing',
  ready_for_delivery: 'Ready for rider',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ORDER_STATUS_DESCRIPTIONS: Record<string, string> = {
  created: 'Your order is waiting for cafe staff to accept it.',
  confirmed: 'Cafe staff accepted your order.',
  preparing: 'The kitchen is preparing your food.',
  ready_for_delivery: 'Your order is ready and waiting for a rider.',
  out_for_delivery: 'Your rider is on the way to you.',
  delivered: 'Your order has been delivered.',
  completed: 'This order is complete.',
  cancelled: 'This order was cancelled.',
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function orderStatusDescription(status: string) {
  return ORDER_STATUS_DESCRIPTIONS[status] ?? `Order status: ${orderStatusLabel(status)}.`;
}
