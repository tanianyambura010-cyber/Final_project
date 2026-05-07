import { ROLES, STAFF_ROLES } from '../../constants/roles.js';

export function canReadOrder(user, order) {
  if (STAFF_ROLES.includes(user.role)) {
    return true;
  }

  if (user.role === ROLES.CUSTOMER) {
    return Number(order.customer_id) === Number(user.id);
  }

  if (user.role === ROLES.RIDER) {
    return Number(order.rider_user_id) === Number(user.id);
  }

  return false;
}

