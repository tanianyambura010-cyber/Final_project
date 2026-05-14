import { API_BASE_URL } from '../config/api';

export type OrderPayload = {
  items: {
    menuItemId: number;
    quantity: number;
  }[];
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  deliveryNotes?: string;
  paymentMethod: 'stripe';
};

export type Order = {
  id: number;
  customerId: number;
  customerName?: string;
  riderId: number | null;
  riderUserId?: number | null;
  riderName?: string | null;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  deliveryNotes: string | null;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OrderItem = {
  id: number;
  menuItemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderDetails = {
  order: Order;
  items: OrderItem[];
};

type OrderResponse = {
  order: Order;
};

type OrderDetailsResponse = {
  order: Order;
  items: OrderItem[];
};

type OrdersResponse = {
  orders: Order[];
};

type ApiErrorBody = {
  message?: string;
};

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function createOrder(token: string, payload: OrderPayload): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as OrderResponse;
  return data.order;
}

export async function fetchOrders(token: string): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as OrdersResponse;
  return data.orders;
}

export async function fetchOrderDetails(token: string, orderId: number): Promise<OrderDetails> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as OrderDetailsResponse;
}

export async function updateOrderStatus(
  token: string,
  orderId: number,
  status: string
): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as OrderResponse;
  return data.order;
}

export async function assignRider(
  token: string,
  orderId: number,
  riderId: number
): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/assign-rider`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ riderId }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as OrderResponse;
  return data.order;
}
