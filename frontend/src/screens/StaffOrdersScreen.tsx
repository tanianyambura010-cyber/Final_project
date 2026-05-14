import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import {
  assignRider,
  fetchOrders,
  updateOrderStatus,
  type Order,
} from '../services/orders';
import {
  createTrackingSocket,
  watchStaffActiveOrders,
  type OrderRealtimeEvent,
} from '../services/realtime';
import { fetchRiders, type Rider } from '../services/riders';
import { money } from '../utils/money';
import { orderStatusLabel } from '../utils/orderStatus';
import { OrderDetailsScreen } from './OrderDetailsScreen';
import { TrackingScreen } from './TrackingScreen';

// Defines how staff move an order through the cafe workflow.
const NEXT_STATUS: Record<string, { label: string; value: string } | null> = {
  created: { label: 'Accept', value: 'confirmed' },
  confirmed: { label: 'Start preparing', value: 'preparing' },
  preparing: { label: 'Ready', value: 'ready_for_delivery' },
  ready_for_delivery: { label: 'Out for delivery', value: 'out_for_delivery' },
  out_for_delivery: { label: 'Delivered', value: 'delivered' },
  delivered: null,
  completed: null,
  cancelled: null,
};

function readableStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function riderAvailability(rider: Rider) {
  return rider.currentStatus === 'available' ? 'Online' : 'Offline';
}

function StaffOrderCard({
  order,
  riders,
  busyOrderId,
  onDetails,
  onAssign,
  onStatus,
  onTrack,
}: {
  order: Order;
  riders: Rider[];
  busyOrderId: number | null;
  onDetails: (order: Order) => void;
  onAssign: (orderId: number, riderId: number) => void;
  onStatus: (orderId: number, status: string) => void;
  onTrack: (order: Order) => void;
}) {
  const nextStatus = NEXT_STATUS[order.status];
  const busy = busyOrderId === order.id;
  const trackable = !['delivered', 'completed', 'cancelled'].includes(order.status);
  const assignedRider = riders.find((rider) => Number(rider.id) === Number(order.riderId));
  const needsRiderBeforeDelivery = nextStatus?.value === 'out_for_delivery' && !order.riderId;
  const assignedRiderOfflineBeforeDelivery =
    nextStatus?.value === 'out_for_delivery' &&
    Boolean(order.riderId) &&
    Boolean(assignedRider) &&
    assignedRider?.currentStatus !== 'available';
  // Staff must choose an online rider before dispatching an order.
  const cannotSendOutForDelivery = needsRiderBeforeDelivery || assignedRiderOfflineBeforeDelivery;
  const canShowRiderSelection =
    !order.riderId && !['delivered', 'completed', 'cancelled'].includes(order.status);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.orderTitle}>Order #{order.id}</Text>
          <Text style={styles.customerText}>{order.customerName ?? 'Customer'}</Text>
        </View>
        <Text style={styles.total}>{money(order.totalAmount)}</Text>
      </View>

      <View style={styles.badgeRow}>
        <Text style={styles.statusBadge}>{orderStatusLabel(order.status)}</Text>
        <Text style={styles.paymentBadge}>{readableStatus(order.paymentStatus)}</Text>
      </View>

      <Text style={styles.address} numberOfLines={2}>
        {order.deliveryAddress}
      </Text>

      {order.riderName ? (
        <Text style={styles.riderText}>
          Assigned rider: {order.riderName}
          {assignedRider ? ` (${riderAvailability(assignedRider)})` : ''}
        </Text>
      ) : (
        <Text style={styles.riderText}>No rider assigned</Text>
      )}

      <View style={styles.inspectRow}>
        <Pressable onPress={() => onDetails(order)} style={styles.detailsAction}>
          <Text style={styles.detailsActionText}>View details</Text>
        </Pressable>
        {trackable ? (
          <Pressable onPress={() => onTrack(order)} style={styles.trackAction}>
            <Text style={styles.trackActionText}>Track</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        {nextStatus ? (
          <Pressable
            disabled={busy || cannotSendOutForDelivery}
            onPress={() => onStatus(order.id, nextStatus.value)}
            style={[
              styles.primaryAction,
              (busy || cannotSendOutForDelivery) && styles.disabledAction,
            ]}
          >
            <Text style={styles.primaryActionText}>{nextStatus.label}</Text>
          </Pressable>
        ) : null}

        {!['delivered', 'completed', 'cancelled'].includes(order.status) ? (
          <Pressable
            disabled={busy}
            onPress={() => onStatus(order.id, 'cancelled')}
            style={[styles.secondaryAction, busy && styles.disabledAction]}
          >
            <Text style={styles.secondaryActionText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>

      {needsRiderBeforeDelivery ? (
        <Text style={styles.assignHint}>Select an online rider before sending this order out.</Text>
      ) : null}

      {assignedRiderOfflineBeforeDelivery ? (
        <Text style={styles.assignHint}>
          The assigned rider is offline. Ask them to go online before out for delivery.
        </Text>
      ) : null}

      {canShowRiderSelection ? (
        <View style={styles.riderAssignBlock}>
          <Text style={styles.assignTitle}>Assign rider</Text>
          {riders.length > 0 ? (
            <View style={styles.riderPills}>
              {riders.map((rider) => {
                const online = rider.currentStatus === 'available';

                return (
                  <Pressable
                    disabled={busy || !online}
                    key={rider.id}
                    onPress={() => onAssign(order.id, rider.id)}
                    style={[
                      styles.riderPill,
                      online ? styles.riderPillOnline : styles.riderPillOffline,
                      (busy || !online) && styles.riderPillDisabled,
                    ]}
                  >
                    <Text style={styles.riderPillText}>{rider.name}</Text>
                    <Text style={[styles.riderStatusText, online && styles.riderStatusTextOnline]}>
                      {riderAvailability(rider)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.assignHint}>No rider accounts have been created yet.</Text>
          )}
          <Text style={styles.assignHint}>Only online riders can receive a delivery.</Text>
        </View>
      ) : null}
    </View>
  );
}

export function StaffOrdersScreen() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [notification, setNotification] = useState<OrderRealtimeEvent | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summary = useMemo(() => {
    const pending = orders.filter((order) => order.status === 'created').length;
    const active = orders.filter(
      (order) => !['delivered', 'completed', 'cancelled'].includes(order.status)
    ).length;
    const availableRiders = riders.filter((rider) => rider.currentStatus === 'available').length;

    return { pending, active, availableRiders };
  }, [orders, riders]);

  const loadDashboard = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!session?.token) {
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      // Staff need both orders and riders on the same dashboard.
      const [nextOrders, nextRiders] = await Promise.all([
        fetchOrders(session.token),
        fetchRiders(session.token),
      ]);
      setOrders(nextOrders);
      setRiders(nextRiders);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load staff dashboard');
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
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!session?.token) {
      return undefined;
    }

    // Keep staff orders updated without forcing the page to reload.
    const socket = createTrackingSocket(session.token);

    socket.on('connect', () => {
      void watchStaffActiveOrders(socket).catch((watchError) => {
        setError(watchError instanceof Error ? watchError.message : 'Unable to watch staff orders');
      });
    });

    socket.on('order:notification', (event: OrderRealtimeEvent) => {
      showNotification(event);
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === event.orderId
            ? {
                ...order,
                status: event.status,
                paymentStatus: event.paymentStatus,
              }
            : order
        )
      );
      void loadDashboard({ silent: true });
    });

    socket.on('connect_error', (socketError) => {
      setError(socketError.message || 'Realtime order notifications are unavailable.');
    });

    return () => {
      socket.off('connect');
      socket.off('order:notification');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [loadDashboard, session?.token, showNotification]);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  async function handleStatus(orderId: number, status: string) {
    if (!session?.token) {
      return;
    }

    setBusyOrderId(orderId);
    setError(null);

    try {
      const updatedOrder = await updateOrderStatus(session.token, orderId, status);
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
      );
      await loadDashboard({ silent: true });
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update order');
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleAssign(orderId: number, riderId: number) {
    if (!session?.token) {
      return;
    }

    setBusyOrderId(orderId);
    setError(null);

    try {
      // Assign the selected online rider to this order.
      const updatedOrder = await assignRider(session.token, orderId, riderId);
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
      );
      await loadDashboard({ silent: true });
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Unable to assign rider');
    } finally {
      setBusyOrderId(null);
    }
  }

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
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Staff Dashboard</Text>
          <Text style={styles.title}>Orders</Text>
        </View>
        <Pressable onPress={() => loadDashboard()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.pending}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.active}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.availableRiders}</Text>
          <Text style={styles.summaryLabel}>Riders</Text>
        </View>
      </View>

      {notification ? (
        <View style={styles.notificationBanner}>
          <Text style={styles.notificationTitle}>Staff alert</Text>
          <Text style={styles.notificationText}>{notification.message}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#176b52" />
          <Text style={styles.stateText}>Loading staff orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Incoming cafe orders will appear here.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={orders}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <StaffOrderCard
              busyOrderId={busyOrderId}
              onAssign={handleAssign}
              onDetails={setDetailsOrder}
              onStatus={handleStatus}
              onTrack={setTrackingOrder}
              order={item}
              riders={riders}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kicker: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#151815',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 2,
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
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  summaryValue: {
    color: '#176b52',
    fontSize: 23,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
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
  list: {
    paddingBottom: 28,
  },
  separator: {
    height: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitleBlock: {
    flex: 1,
  },
  orderTitle: {
    color: '#151815',
    fontSize: 18,
    fontWeight: '900',
  },
  customerText: {
    color: '#5f675f',
    fontSize: 13,
    marginTop: 4,
  },
  total: {
    color: '#b14a32',
    fontSize: 16,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
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
  address: {
    color: '#4c554c',
    fontSize: 14,
    lineHeight: 20,
  },
  riderText: {
    color: '#151815',
    fontSize: 13,
    fontWeight: '800',
  },
  inspectRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailsAction: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  detailsActionText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  trackAction: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  trackActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: '#b14a32',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '900',
  },
  disabledAction: {
    opacity: 0.55,
  },
  riderAssignBlock: {
    gap: 8,
  },
  assignTitle: {
    color: '#3d453d',
    fontSize: 13,
    fontWeight: '900',
  },
  assignHint: {
    color: '#6b736b',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  riderPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  riderPill: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    minWidth: 116,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  riderPillOnline: {
    backgroundColor: '#e8f0ec',
    borderColor: '#176b52',
  },
  riderPillOffline: {
    backgroundColor: '#f4f2ef',
    borderColor: '#ded7d0',
  },
  riderPillDisabled: {
    opacity: 0.62,
  },
  riderPillText: {
    color: '#151815',
    fontSize: 12,
    fontWeight: '900',
  },
  riderStatusText: {
    color: '#7a817a',
    fontSize: 11,
    fontWeight: '900',
  },
  riderStatusTextOnline: {
    color: '#176b52',
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  stateText: {
    color: '#4c554c',
    marginTop: 12,
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
