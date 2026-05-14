import { API_BASE_URL } from '../config/api';

export type StripeIntent = {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
};

export type Payment = {
  id: number;
  orderId: number;
  method: string;
  status: string;
  amount: number;
  stripePaymentIntentId: string | null;
  stripeClientSecret: string | null;
  paidAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DemoPaymentDetails = {
  reference: string;
  cardBrand: string;
  maskedCardNumber: string;
  expiry: string;
  cardholder: string;
  approvalCode: string;
  amount: number;
  currency: string;
  status: string;
};

type StripeIntentResponse = {
  payment?: Payment | null;
  paymentIntent: StripeIntent;
};

type PaymentResponse = {
  payment: Payment | null;
};

type SyncPaymentResponse = {
  payment: Payment | null;
  stripeStatus: string;
};

type DemoPaymentResponse = {
  payment: Payment | null;
  demoPayment: DemoPaymentDetails;
  orderStatus: string;
  paymentStatus: string;
};

type ApiErrorBody = {
  message?: string;
  debug?: string;
};

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.debug ?? body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function createStripeIntent(token: string, orderId: number): Promise<StripeIntent> {
  const response = await fetch(`${API_BASE_URL}/payments/orders/${orderId}/stripe-intent`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as StripeIntentResponse;
  return data.paymentIntent;
}

export async function fetchOrderPayment(token: string, orderId: number): Promise<Payment | null> {
  const response = await fetch(`${API_BASE_URL}/payments/orders/${orderId}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as PaymentResponse;
  return data.payment;
}

export async function confirmDemoPayment(
  token: string,
  orderId: number
): Promise<DemoPaymentResponse> {
  const response = await fetch(`${API_BASE_URL}/payments/orders/${orderId}/demo-confirm`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as DemoPaymentResponse;
}

export async function syncStripePayment(
  token: string,
  orderId: number
): Promise<SyncPaymentResponse> {
  const response = await fetch(`${API_BASE_URL}/payments/orders/${orderId}/sync-stripe`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as SyncPaymentResponse;
}
