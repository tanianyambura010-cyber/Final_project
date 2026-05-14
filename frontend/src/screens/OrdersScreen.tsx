import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type DimensionValue,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { createTrackingSocket, type OrderRealtimeEvent } from '../services/realtime';
import { fetchOrders, type Order } from '../services/orders';
import { money } from '../utils/money';
import { ORDER_STATUS_STEPS, orderStatusDescription, orderStatusLabel } from '../utils/orderStatus';
import { OrderDetailsScreen } from './OrderDetailsScreen';
import { TrackingScreen } from './TrackingScreen';

const ACTIVE_STATUSES = ['created', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery'];
const FINAL_STATUSES = ['delivered', 'completed', 'cancelled'];
const ORDER_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
] as const;

type OrderFilter = (typeof ORDER_FILTERS)[number]['value'];

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

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function isActiveOrder(status: string) {
  return ACTIVE_STATUSES.includes(status);
}

function statusTone(status: string) {
  if (status === 'cancelled') {
    return 'danger';
  }

  if (status === 'delivered' || status === 'completed') {
    return 'success';
  }

  if (status === 'created') {
    return 'warning';
  }

  return 'progress';
}

function OrderProgress({ status }: { status: string }) {
  const activeIndex = Math.max(ORDER_STATUS_STEPS.indexOf(status), 0);
  // Convert the order status into a progress bar width.
  const progressWidth: DimensionValue =
    status === 'cancelled'
      ? '0%'
      : `${Math.min(((activeIndex + 1) / ORDER_STATUS_STEPS.length) * 100, 100)}%`;

  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>Progress</Text>
        <Text style={styles.progressValue}>{orderStatusLabel(status)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
      <View style={styles.progressEndpoints}>
        <Text style={styles.progressEndpoint}>Pending</Text>
        <Text style={styles.progressEndpoint}>Delivered</Text>
      </View>
    </View>
  );
}

function SummaryTile({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'default' | 'green' | 'orange' | 'cream';
  value: string;
}) {
  return (
    <View
      style={[
        styles.summaryTile,
        tone === 'green' && styles.summaryTileGreen,
        tone === 'orange' && styles.summaryTileOrange,
        tone === 'cream' && styles.summaryTileCream,
      ]}
    >
      <Text
        style={[
          styles.summaryTileValue,
          tone === 'green' && styles.summaryTileValueGreen,
          tone === 'orange' && styles.summaryTileValueOrange,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.summaryTileLabel}>{label}</Text>
    </View>
  );
}

function OrderCard({
  onDetails,
  onTrack,
  order,
}: {
  onDetails: (order: Order) => void;
  onTrack: (order: Order) => void;
  order: Order;
}) {
  const paymentDone = order.paymentStatus === 'paid';
  const trackable = isActiveOrder(order.status);
  const tone = statusTone(order.status);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.orderIcon}>
          <Text style={styles.orderIconText}>BD</Text>
        </View>
        <View style={styles.orderTitleBlock}>
          <Text style={styles.orderTitle}>#ORD-{order.id}</Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <Text
          style={[
            styles.statusBadge,
            tone === 'success' && styles.statusBadgeSuccess,
            tone === 'warning' && styles.statusBadgeWarning,
            tone === 'danger' && styles.statusBadgeDanger,
          ]}
        >
          {orderStatusLabel(order.status)}
        </Text>
      </View>

      <Text style={styles.statusDescription}>{orderStatusDescription(order.status)}</Text>

      <OrderProgress status={order.status} />

      <View style={styles.metaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Delivery address</Text>
          <Text style={styles.metaValue} numberOfLines={2}>
            {order.deliveryAddress}
          </Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Rider</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {order.riderName ?? 'Not assigned yet'}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amountLabel}>Total paid</Text>
          <Text style={styles.total}>{money(Number(order.totalAmount))}</Text>
        </View>
        <Text style={[styles.paymentBadge, paymentDone && styles.paymentBadgePaid]}>
          {readableStatus(order.paymentStatus)}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={() => onDetails(order)} style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>View details</Text>
        </Pressable>
        {trackable ? (
          <Pressable onPress={() => onTrack(order)} style={styles.trackButton}>
            <Text style={styles.trackButtonText}>Track order</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function OrdersScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [notification, setNotification] = useState<OrderRealtimeEvent | null>(null);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDesktop = width >= 900;

  const activeOrders = useMemo(
    () => orders.filter((order) => !FINAL_STATUSES.includes(order.status)).length,
    [orders]
  );
  const deliveredOrders = useMemo(
    () => orders.filter((order) => ['delivered', 'completed'].includes(order.status)).length,
    [orders]
  );
  const pendingOrders = useMemo(
    () => orders.filter((order) => ['created', 'confirmed', 'preparing'].includes(order.status)).length,
    [orders]
  );
  // Apply both status filter and search text to the order list.
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && isActiveOrder(order.status)) ||
        (filter === 'delivered' && ['delivered', 'completed'].includes(order.status)) ||
        (filter === 'cancelled' && order.status === 'cancelled');

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        `ord-${order.id}`,
        String(order.id),
        order.deliveryAddress,
        order.riderName ?? '',
        orderStatusLabel(order.status),
        readableStatus(order.paymentStatus),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [filter, orders, searchQuery]);

  const loadOrders = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!session?.token) {
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const nextOrders = await fetchOrders(session.token);
      setOrders(nextOrders);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load orders');
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [session?.token]);

  const showNotification = useCallback((event: OrderRealtimeEvent) => {
    setNotification(event);

    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }

    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimerRef.current = null;
    }, 7000);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!session?.token) {
      return undefined;
    }

    // Update the customer order list when the backend sends a notification.
    const socket = createTrackingSocket(session.token);

    socket.on('order:notification', (event: OrderRealtimeEvent) => {
      showNotification(event);
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === event.orderId
            ? {
                ...order,
                paymentStatus: event.paymentStatus,
                status: event.status,
              }
            : order
        )
      );
      setDetailsOrder((currentOrder) =>
        currentOrder?.id === event.orderId
          ? { ...currentOrder, paymentStatus: event.paymentStatus, status: event.status }
          : currentOrder
      );
      setTrackingOrder((currentOrder) =>
        currentOrder?.id === event.orderId
          ? { ...currentOrder, paymentStatus: event.paymentStatus, status: event.status }
          : currentOrder
      );
      void loadOrders({ silent: true });
    });

    socket.on('connect_error', (socketError) => {
      setError(socketError.message || 'Realtime order updates are unavailable.');
    });

    return () => {
      socket.off('order:notification');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [loadOrders, session?.token, showNotification]);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  if (trackingOrder) {
    return <TrackingScreen onBack={() => setTrackingOrder(null)} order={trackingOrder} />;
  }

  if (detailsOrder) {
    return (
      <OrderDetailsScreen
        initialOrder={detailsOrder}
        onBack={() => setDetailsOrder(null)}
        onTrack={(order) => {
          setDetailsOrder(null);
          setTrackingOrder(order);
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Bean & Dash</Text>
            <Text style={styles.title}>Order History</Text>
            <Text style={styles.subtitle}>Track your orders and view previous deliveries.</Text>
          </View>
          <Pressable onPress={() => loadOrders()} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryTile label="Total orders" tone="green" value={String(orders.length)} />
          <SummaryTile label="Active now" tone="orange" value={String(activeOrders)} />
          <SummaryTile label="Delivered" tone="cream" value={String(deliveredOrders)} />
          <SummaryTile label="In kitchen" value={String(pendingOrders)} />
        </View>

        <View style={styles.toolsPanel}>
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="Search by order, rider, address, or status..."
            placeholderTextColor="#8b948b"
            style={styles.searchInput}
            value={searchQuery}
          />
          <View style={styles.filterRow}>
            {ORDER_FILTERS.map((item) => {
              const active = filter === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setFilter(item.value)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {notification ? (
          <View style={styles.notificationBanner}>
            <Text style={styles.notificationTitle}>Order update</Text>
            <Text style={styles.notificationText}>{notification.message}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#176b52" />
            <Text style={styles.stateText}>Loading orders...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorTitle}>Orders unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>Your delivery history will appear here.</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>No matching orders</Text>
            <Text style={styles.emptyText}>Try another search term or filter.</Text>
          </View>
        ) : (
          <View style={[styles.orderList, isDesktop && styles.orderListDesktop]}>
            {filteredOrders.map((order) => (
              <View
                key={order.id}
                style={[styles.orderCardWrapper, isDesktop && styles.orderCardWrapperDesktop]}
              >
                <OrderCard
                  onDetails={setDetailsOrder}
                  onTrack={setTrackingOrder}
                  order={order}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f7f3ef',
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 1180,
    width: '100%',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kicker: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: '#151815',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: '#5f675f',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
  },
  refreshButton: {
    backgroundColor: '#176b52',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  summaryTile: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 150,
    flexGrow: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  summaryTileGreen: {
    backgroundColor: '#e9f2ed',
    borderColor: '#c8ded3',
  },
  summaryTileOrange: {
    backgroundColor: '#fff3ec',
    borderColor: '#ffd0b5',
  },
  summaryTileCream: {
    backgroundColor: '#f1ebe3',
    borderColor: '#e1d6cc',
  },
  summaryTileValue: {
    color: '#176b52',
    fontSize: 22,
    fontWeight: '900',
  },
  summaryTileValueGreen: {
    color: '#075f46',
  },
  summaryTileValueOrange: {
    color: '#b14a32',
  },
  summaryTileLabel: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  toolsPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#e2ddd6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
    padding: 12,
  },
  searchInput: {
    backgroundColor: '#f7f3ef',
    borderColor: '#e2ddd6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151815',
    fontSize: 14,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 13,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#f4f6f3',
    borderColor: '#dfe4df',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: '#176b52',
    borderColor: '#176b52',
  },
  filterText: {
    color: '#5f675f',
    fontSize: 13,
    fontWeight: '900',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  notificationBanner: {
    backgroundColor: '#fff3ec',
    borderColor: '#ffbf98',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  notificationTitle: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 3,
  },
  notificationText: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '800',
  },
  orderList: {
    gap: 12,
    paddingBottom: 20,
  },
  orderListDesktop: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  orderCardWrapper: {
    width: '100%',
  },
  orderCardWrapperDesktop: {
    flexBasis: '48.7%',
    flexGrow: 1,
    maxWidth: '49.4%',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 13,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  orderIcon: {
    alignItems: 'center',
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  orderIconText: {
    color: '#176b52',
    fontSize: 12,
    fontWeight: '900',
  },
  orderTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  orderTitle: {
    color: '#151815',
    fontSize: 18,
    fontWeight: '900',
  },
  orderDate: {
    color: '#6b736b',
    fontSize: 12,
    marginTop: 4,
  },
  amountLabel: {
    color: '#8b948b',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  total: {
    color: '#b14a32',
    fontSize: 16,
    fontWeight: '900',
  },
  statusBadge: {
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    color: '#176b52',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: 'capitalize',
  },
  statusBadgeSuccess: {
    backgroundColor: '#dff8e9',
    color: '#08733f',
  },
  statusBadgeWarning: {
    backgroundColor: '#fff3df',
    color: '#b14a32',
  },
  statusBadgeDanger: {
    backgroundColor: '#ffe7e2',
    color: '#b43a2f',
  },
  paymentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff3ec',
    borderRadius: 8,
    color: '#b14a32',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
    textTransform: 'capitalize',
  },
  paymentBadgePaid: {
    backgroundColor: '#e8f0ec',
    color: '#176b52',
  },
  statusDescription: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaCell: {
    backgroundColor: '#f7f3ef',
    borderRadius: 8,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    minWidth: 170,
    padding: 11,
  },
  metaLabel: {
    color: '#8b948b',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: '#151815',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  cardFooter: {
    alignItems: 'center',
    borderTopColor: '#eee8e0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  progressBlock: {
    gap: 7,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '900',
  },
  progressValue: {
    color: '#176b52',
    fontSize: 12,
    fontWeight: '900',
  },
  progressTrack: {
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    height: 9,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#ff741f',
    borderRadius: 8,
    height: 9,
  },
  progressEndpoints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressEndpoint: {
    color: '#8b948b',
    fontSize: 11,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailsButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 130,
  },
  detailsButtonText: {
    color: '#176b52',
    fontSize: 14,
    fontWeight: '900',
  },
  trackButton: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 130,
  },
  trackButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  centerState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2ddd6',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 230,
    paddingHorizontal: 22,
  },
  stateText: {
    color: '#4c554c',
    marginTop: 12,
  },
  errorTitle: {
    color: '#b14a32',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
  },
  errorText: {
    color: '#4c554c',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#151815',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: '#5f675f',
    fontSize: 15,
    textAlign: 'center',
  },
});
