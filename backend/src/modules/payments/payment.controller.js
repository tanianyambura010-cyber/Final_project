import { query, transaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { getStripe } from '../../config/stripe.js';
import { ROLES, STAFF_ROLES } from '../../constants/roles.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { badRequest, forbidden, notFound } from '../../utils/http-error.js';
import {
  createOrderNotification,
  emitCustomerOrderNotification,
  emitRiderOrderNotification,
  emitStaffOrderNotification,
  emitTrackedOrderNotification
} from '../orders/order-events.js';

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

function canManagePayment(user, order) {
  return STAFF_ROLES.includes(user.role) || (user.role === ROLES.CUSTOMER && Number(order.customer_id) === Number(user.id));
}

function toStripeAmount(amount) {
  return Math.round(Number(amount) * env.stripe.amountMultiplier);
}

function serializePayment(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    method: row.method,
    status: row.status,
    amount: row.amount,
    stripePaymentIntentId: row.provider_reference,
    stripeClientSecret: row.provider_client_secret,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createDemoPaymentDetails(order, user, reference) {
  const orderSuffix = String(order.id).padStart(4, '0').slice(-4);
  const approvalSeed = Date.now().toString(36).toUpperCase().slice(-6);

  // Fake card details are used only for project demonstration.
  return {
    reference,
    cardBrand: 'Visa',
    maskedCardNumber: `4242 4242 4242 ${orderSuffix}`,
    expiry: '12/30',
    cardholder: user.name,
    approvalCode: `CF-${approvalSeed}-${orderSuffix}`,
    amount: order.total_amount,
    currency: env.stripe.currency.toUpperCase(),
    status: 'accepted'
  };
}

async function getLatestPayment(orderId) {
  const rows = await query('SELECT * FROM payments WHERE order_id = :orderId ORDER BY id DESC LIMIT 1', { orderId });
  return rows[0] ?? null;
}

async function markPaymentPaidByIntent(paymentIntent) {
  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE payments
       SET status = 'paid',
           provider_reference = :paymentIntentId,
           paid_at = CURRENT_TIMESTAMP
       WHERE provider_reference = :paymentIntentId`,
      { paymentIntentId: paymentIntent.id }
    );

    await connection.execute(
      `UPDATE orders o
       JOIN payments p ON p.order_id = o.id
       SET o.payment_status = 'paid'
       WHERE p.provider_reference = :paymentIntentId`,
      { paymentIntentId: paymentIntent.id }
    );
  });
}

async function markPaymentFailedByIntent(paymentIntent) {
  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE payments
       SET status = 'failed',
           provider_reference = :paymentIntentId
       WHERE provider_reference = :paymentIntentId`,
      { paymentIntentId: paymentIntent.id }
    );

    await connection.execute(
      `UPDATE orders o
       JOIN payments p ON p.order_id = o.id
       SET o.payment_status = 'failed'
       WHERE p.provider_reference = :paymentIntentId`,
      { paymentIntentId: paymentIntent.id }
    );
  });
}

export const getOrderPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.validated.params;
  const order = await getOrder(orderId);

  if (!order) {
    throw notFound('Order was not found.');
  }

  if (!canManagePayment(req.user, order)) {
    throw forbidden();
  }

  res.json({ payment: serializePayment(await getLatestPayment(orderId)) });
});

export const createStripePaymentIntent = asyncHandler(async (req, res) => {
  const { orderId } = req.validated.params;
  const order = await getOrder(orderId);

  if (!order) {
    throw notFound('Order was not found.');
  }

  if (!canManagePayment(req.user, order)) {
    throw forbidden();
  }

  if (order.payment_status === 'paid') {
    throw badRequest('This order is already paid.');
  }

  const stripe = getStripe();
  const existingPayment = await getLatestPayment(orderId);

  if (existingPayment?.provider_reference && existingPayment?.provider_client_secret) {
    const existingIntent = await stripe.paymentIntents.retrieve(existingPayment.provider_reference);

    res.json({
      payment: serializePayment(existingPayment),
      paymentIntent: {
        id: existingIntent.id,
        clientSecret: existingIntent.client_secret,
        amount: existingIntent.amount,
        currency: existingIntent.currency,
        status: existingIntent.status
      }
    });
    return;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: toStripeAmount(order.total_amount),
    currency: env.stripe.currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId: String(order.id),
      customerId: String(order.customer_id)
    }
  });

  await query(
    `UPDATE payments
     SET provider_reference = :paymentIntentId,
         provider_client_secret = :clientSecret
     WHERE order_id = :orderId`,
    {
      orderId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    }
  );

  res.json({
    payment: serializePayment(await getLatestPayment(orderId)),
    paymentIntent: {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    }
  });
});

export const syncStripePayment = asyncHandler(async (req, res) => {
  const { orderId } = req.validated.params;
  const order = await getOrder(orderId);

  if (!order) {
    throw notFound('Order was not found.');
  }

  if (!canManagePayment(req.user, order)) {
    throw forbidden();
  }

  const payment = await getLatestPayment(orderId);

  if (!payment?.provider_reference) {
    throw badRequest('Create a Stripe payment intent before syncing payment status.');
  }

  const paymentIntent = await getStripe().paymentIntents.retrieve(payment.provider_reference);

  if (paymentIntent.status === 'succeeded') {
    await markPaymentPaidByIntent(paymentIntent);
  }

  if (paymentIntent.status === 'canceled') {
    await markPaymentFailedByIntent(paymentIntent);
  }

  res.json({
    payment: serializePayment(await getLatestPayment(orderId)),
    stripeStatus: paymentIntent.status
  });
});

export const confirmDemoPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.validated.params;
  const order = await getOrder(orderId);

  if (!order) {
    throw notFound('Order was not found.');
  }

  if (!canManagePayment(req.user, order)) {
    throw forbidden();
  }

  const payment = await getLatestPayment(orderId);

  if (!payment) {
    throw badRequest('Payment record was not found for this order.');
  }

  // Reuse the demo reference if the same order is confirmed again.
  const reference = payment.provider_reference?.startsWith('demo_')
    ? payment.provider_reference
    : `demo_${order.id}_${Date.now()}`;
  const demoPayment = createDemoPaymentDetails(order, req.user, reference);

  if (payment.status !== 'paid' || order.payment_status !== 'paid') {
    // Mark both payment and order as paid in one transaction.
    await transaction(async (connection) => {
      await connection.execute(
        `UPDATE payments
         SET status = 'paid',
             provider_reference = :reference,
             provider_client_secret = :approvalCode,
             paid_at = CURRENT_TIMESTAMP
         WHERE id = :paymentId`,
        {
          paymentId: payment.id,
          reference,
          approvalCode: demoPayment.approvalCode
        }
      );

      await connection.execute(
        `UPDATE orders
         SET payment_status = 'paid'
         WHERE id = :orderId`,
        { orderId }
      );
    });
  }

  const updatedOrder = await getOrder(orderId);
  const notification = createOrderNotification(
    'payment_confirmed',
    updatedOrder,
    `Payment accepted for order #${updatedOrder.id}.`
  );

  emitStaffOrderNotification(req, notification);
  emitCustomerOrderNotification(req, updatedOrder.customer_id, notification);
  emitRiderOrderNotification(req, updatedOrder.rider_user_id, notification);
  emitTrackedOrderNotification(req, updatedOrder.id, notification);

  res.json({
    payment: serializePayment(await getLatestPayment(orderId)),
    demoPayment,
    orderStatus: updatedOrder.status,
    paymentStatus: 'paid'
  });
});

export const handleStripeWebhook = asyncHandler(async (req, res) => {
  if (!env.stripe.webhookSecret) {
    throw badRequest('STRIPE_WEBHOOK_SECRET is required for webhook verification.');
  }

  const signature = req.get('stripe-signature');

  if (!signature) {
    throw badRequest('Stripe signature header is missing.');
  }

  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, env.stripe.webhookSecret);
  } catch (error) {
    throw badRequest(`Stripe webhook verification failed: ${error.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    await markPaymentPaidByIntent(event.data.object);
  }

  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    await markPaymentFailedByIntent(event.data.object);
  }

  res.json({ received: true });
});
