import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackButton } from '../components/BackButton';
import { MapPreview } from '../components/MapPreview';
import { useAuth } from '../context/AuthContext';
import { fetchOrderDetails, type Order, type OrderItem } from '../services/orders';
import {
  createStripeIntent,
  fetchOrderPayment,
  syncStripePayment,
  type Payment,
  type StripeIntent,
} from '../services/payments';
import { money } from '../utils/money';
import { ORDER_STATUS_STEPS, orderStatusDescription, orderStatusLabel } from '../utils/orderStatus';

const TRACKABLE_STATUSES = ['created', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery'];

function readableStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatDate(value?: string) {
  if (!value) {
    return 'Recently';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return date.toLocaleString();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function StatusTimeline({ status }: { status: string }) {
  const activeIndex = Math.max(ORDER_STATUS_STEPS.indexOf(status), 0);

  return (
    <View style={styles.timeline}>
      {ORDER_STATUS_STEPS.map((step, index) => {
        const done = index <= activeIndex;

        return (
          <View key={step} style={styles.timelineStep}>
            <View style={[styles.timelineDot, done && styles.timelineDotDone]} />
            <Text style={[styles.timelineText, done && styles.timelineTextDone]} numberOfLines={1}>
              {orderStatusLabel(step)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemCopy}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemMeta}>
          {item.quantity} x {money(Number(item.unitPrice))}
        </Text>
      </View>
      <Text style={styles.itemTotal}>{money(Number(item.lineTotal))}</Text>
    </View>
  );
}

export function OrderDetailsScreen({
  backLabel = 'Orders',
  initialOrder,
  onBack,
  onTrack,
  showFinancials = true,
  showItems = true,
  showPayment = true,
  trackLabel = 'Track live order',
}: {
  backLabel?: string;
  initialOrder: Order;
  onBack: () => void;
  onTrack: (order: Order) => void;
  showFinancials?: boolean;
  showItems?: boolean;
  showPayment?: boolean;
  trackLabel?: string;
}) {
  const { session } = useAuth();
  const [order, setOrder] = useState(initialOrder);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [stripeIntent, setStripeIntent] = useState<StripeIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const trackable = TRACKABLE_STATUSES.includes(order.status);
  const mapPoints = useMemo(
    () => [
      {
        latitude: Number(order.deliveryLatitude),
        longitude: Number(order.deliveryLongitude),
        label: 'D',
        color: 'green',
      },
    ],
    [order.deliveryLatitude, order.deliveryLongitude]
  );

  const loadDetails = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const details = await fetchOrderDetails(session.token, initialOrder.id);
      const nextPayment = showPayment
        ? await fetchOrderPayment(session.token, initialOrder.id)
        : null;
      setOrder(details.order);
      setItems(details.items);
      setPayment(nextPayment);
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : 'Unable to load order');
    } finally {
      setLoading(false);
    }
  }, [initialOrder.id, session?.token, showPayment]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  async function prepareStripePayment() {
    if (!session?.token) {
      return;
    }

    setPaymentBusy(true);
    setPaymentError(null);

    try {
      const intent = await createStripeIntent(session.token, order.id);
      const nextPayment = await fetchOrderPayment(session.token, order.id);
      setStripeIntent(intent);
      setPayment(nextPayment);
    } catch (prepareError) {
      setPaymentError(
        prepareError instanceof Error ? prepareError.message : 'Unable to prepare Stripe payment'
      );
    } finally {
      setPaymentBusy(false);
    }
  }

  async function refreshStripeStatus() {
    if (!session?.token) {
      return;
    }

    setPaymentBusy(true);
    setPaymentError(null);

    try {
      const syncResult = await syncStripePayment(session.token, order.id);
      const details = await fetchOrderDetails(session.token, order.id);
      setPayment(syncResult.payment);
      setOrder(details.order);
    } catch (syncError) {
      setPaymentError(syncError instanceof Error ? syncError.message : 'Unable to sync payment');
    } finally {
      setPaymentBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <BackButton label={backLabel} onPress={onBack} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Order Details</Text>
          <Text style={styles.title}>Order #{order.id}</Text>
          <Text style={styles.subtle}>{formatDate(order.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.summaryHeader}>
          <View style={styles.badgeRow}>
            <Text style={styles.statusBadge}>{orderStatusLabel(order.status)}</Text>
            {showFinancials ? (
              <Text
                style={[
                  styles.paymentBadge,
                  order.paymentStatus === 'paid' && styles.paymentBadgePaid,
                ]}
              >
                {readableStatus(order.paymentStatus)}
              </Text>
            ) : null}
          </View>
          {showFinancials ? <Text style={styles.total}>{money(Number(order.totalAmount))}</Text> : null}
        </View>
        <Text style={styles.statusDescription}>{orderStatusDescription(order.status)}</Text>
        <StatusTimeline status={order.status} />
      </View>

      {showItems ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {loading ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color="#176b52" />
              <Text style={styles.bodyText}>Loading order items...</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : items.length === 0 ? (
            <Text style={styles.bodyText}>No items were returned for this order.</Text>
          ) : (
            items.map((item) => <ItemRow item={item} key={item.id} />)
          )}

          {showFinancials ? (
            <View style={styles.totalsBox}>
              <DetailRow label="Subtotal" value={money(Number(order.subtotal))} />
              <DetailRow label="Delivery" value={money(Number(order.deliveryFee))} />
              <DetailRow label="Total" value={money(Number(order.totalAmount))} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery</Text>
        <Text style={styles.address}>{order.deliveryAddress}</Text>
        {order.deliveryNotes ? <Text style={styles.notes}>Note: {order.deliveryNotes}</Text> : null}
        <DetailRow label="Customer" value={order.customerName ?? 'Customer'} />
        <DetailRow label="Rider" value={order.riderName ?? 'Not assigned'} />
      </View>

      {showPayment ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.paymentSummary}>
            <Text
              style={[
                styles.paymentStatus,
                payment?.status === 'paid' && styles.paymentStatusPaid,
                payment?.status === 'failed' && styles.paymentStatusFailed,
              ]}
            >
              {payment?.status ? readableStatus(payment.status) : readableStatus(order.paymentStatus)}
            </Text>
            <Text style={styles.paymentAmount}>{money(Number(payment?.amount ?? order.totalAmount))}</Text>
          </View>

          {payment?.stripePaymentIntentId || stripeIntent ? (
            <Text style={styles.bodyText}>
              Stripe intent {payment?.stripePaymentIntentId ?? stripeIntent?.id}
            </Text>
          ) : (
            <Text style={styles.bodyText}>Stripe payment has not been prepared for this order yet.</Text>
          )}

          {stripeIntent ? (
            <Text style={styles.bodyText}>Stripe status: {readableStatus(stripeIntent.status)}</Text>
          ) : null}

          {paymentError ? <Text style={styles.errorText}>{paymentError}</Text> : null}

          <View style={styles.paymentActions}>
            {payment?.status !== 'paid' ? (
              <Pressable
                disabled={paymentBusy}
                onPress={prepareStripePayment}
                style={[styles.paymentButton, paymentBusy && styles.disabledAction]}
              >
                {paymentBusy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.paymentButtonText}>
                    {payment?.stripePaymentIntentId ? 'Reload Stripe intent' : 'Prepare Stripe payment'}
                  </Text>
                )}
              </Pressable>
            ) : null}
            {payment?.stripePaymentIntentId ? (
              <Pressable
                disabled={paymentBusy}
                onPress={refreshStripeStatus}
                style={[styles.paymentSecondaryButton, paymentBusy && styles.disabledAction]}
              >
                <Text style={styles.paymentSecondaryText}>Sync status</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <MapPreview
          points={mapPoints}
          subtitle="Delivery destination"
          title="Delivery location"
        />
      </View>

      {trackable ? (
        <Pressable onPress={() => onTrack(order)} style={styles.trackButton}>
          <Text style={styles.trackButtonText}>{trackLabel}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    gap: 14,
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#151815',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 2,
  },
  subtle: {
    color: '#6b736b',
    fontSize: 12,
    marginTop: 4,
  },
  backButton: {
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backText: {
    color: '#3d453d',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    color: '#176b52',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 6,
    textTransform: 'capitalize',
  },
  paymentBadge: {
    backgroundColor: '#fff3ec',
    borderRadius: 8,
    color: '#b14a32',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 6,
    textTransform: 'capitalize',
  },
  paymentBadgePaid: {
    backgroundColor: '#e8f0ec',
    color: '#176b52',
  },
  total: {
    color: '#b14a32',
    fontSize: 17,
    fontWeight: '900',
  },
  statusDescription: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  timeline: {
    gap: 7,
  },
  timelineStep: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  timelineDot: {
    backgroundColor: '#d8ded7',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  timelineDotDone: {
    backgroundColor: '#176b52',
  },
  timelineText: {
    color: '#8b948b',
    flex: 1,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  timelineTextDone: {
    color: '#3f463f',
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#151815',
    fontSize: 17,
    fontWeight: '900',
  },
  inlineState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  bodyText: {
    color: '#5f675f',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
  },
  paymentSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  paymentStatus: {
    backgroundColor: '#fff3ec',
    borderRadius: 8,
    color: '#b14a32',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 6,
    textTransform: 'capitalize',
  },
  paymentStatusPaid: {
    backgroundColor: '#e8f0ec',
    color: '#176b52',
  },
  paymentStatusFailed: {
    backgroundColor: '#fde8e2',
    color: '#9f2f1f',
  },
  paymentAmount: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '900',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentButton: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  paymentButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  paymentSecondaryButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  paymentSecondaryText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  disabledAction: {
    opacity: 0.55,
  },
  itemRow: {
    alignItems: 'center',
    borderBottomColor: '#edf0ec',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  itemCopy: {
    flex: 1,
  },
  itemName: {
    color: '#151815',
    fontSize: 15,
    fontWeight: '800',
  },
  itemMeta: {
    color: '#6b736b',
    fontSize: 12,
    marginTop: 3,
  },
  itemTotal: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '900',
  },
  totalsBox: {
    gap: 8,
    paddingTop: 2,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: '#6b736b',
    fontSize: 13,
    fontWeight: '700',
  },
  detailValue: {
    color: '#151815',
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  address: {
    color: '#4c554c',
    fontSize: 14,
    lineHeight: 20,
  },
  notes: {
    color: '#5f675f',
    fontSize: 13,
    fontStyle: 'italic',
  },
  trackButton: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  trackButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});
