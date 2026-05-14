import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { fetchOrders, updateOrderStatus, type Order } from '../services/orders';
import {
  createTrackingSocket,
  sendRiderLocation,
  watchRiderOrders,
  type OrderRealtimeEvent,
  type TrackingSocket,
} from '../services/realtime';
import {
  fetchMyRiderProfile,
  updateMyRiderStatus,
  type Rider,
} from '../services/riders';
import { money } from '../utils/money';
import { OrderDetailsScreen } from './OrderDetailsScreen';
import { TrackingScreen } from './TrackingScreen';

// Shows which action a rider can take for each order status.
const RIDER_NEXT_STATUS: Record<string, { label: string; value: string } | null> = {
  ready_for_delivery: { label: 'Accept delivery', value: 'out_for_delivery' },
  out_for_delivery: { label: 'Mark delivered', value: 'delivered' },
  delivered: null,
  created: null,
  confirmed: null,
  preparing: null,
  completed: null,
  cancelled: null,
};

function readableStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function isToday(value?: string) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toDateString() === new Date().toDateString();
}

function StatCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: string;
  label: string;
  tone: 'green' | 'orange' | 'deepGreen';
  value: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text
        style={[
          styles.summaryIcon,
          tone === 'orange' && styles.summaryIconOrange,
          tone === 'green' && styles.summaryIconGreen,
          tone === 'deepGreen' && styles.summaryIconDeepGreen,
        ]}
      >
        {icon}
      </Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function DeliveryCard({
  busyOrderId,
  onDetails,
  onStartLocationShare,
  onStopLocationShare,
  onStatus,
  order,
  sharing,
  sharingError,
  sharingStatus,
}: {
  busyOrderId: number | null;
  onDetails: (order: Order) => void;
  onStartLocationShare: (orderId: number) => void;
  onStopLocationShare: () => void;
  onStatus: (orderId: number, status: string) => void;
  order: Order;
  sharing: boolean;
  sharingError: string | null;
  sharingStatus: string | null;
}) {
  const nextStatus = RIDER_NEXT_STATUS[order.status];
  const busy = busyOrderId === order.id;
  const canAcceptDelivery =
    ['confirmed', 'preparing', 'ready_for_delivery'].includes(order.status) && !sharing;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.orderTitle}>Order #{order.id}</Text>
          <Text style={styles.customerText}>{order.customerName ?? 'Customer'}</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <Text style={styles.statusBadge}>{readableStatus(order.status)}</Text>
      </View>

      <Text style={styles.address} numberOfLines={3}>
        {order.deliveryAddress}
      </Text>

      {order.deliveryNotes ? (
        <Text style={styles.notes} numberOfLines={2}>
          Note: {order.deliveryNotes}
        </Text>
      ) : null}

      {canAcceptDelivery ? (
        <Pressable
          disabled={busy}
          onPress={() => onStatus(order.id, 'out_for_delivery')}
          style={[styles.primaryAction, busy && styles.disabledAction]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryActionText}>Accept delivery</Text>
          )}
        </Pressable>
      ) : nextStatus ? (
        <Pressable
          disabled={busy}
          onPress={() => onStatus(order.id, nextStatus.value)}
          style={[styles.primaryAction, busy && styles.disabledAction]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryActionText}>{nextStatus.label}</Text>
          )}
        </Pressable>
      ) : order.status === 'delivered' ? (
        <Text style={styles.deliveredText}>Delivered</Text>
      ) : sharing ? (
        <Text style={styles.acceptedText}>Delivery accepted. Live GPS is on.</Text>
      ) : (
        <Text style={styles.helperText}>Waiting for cafe staff to mark this delivery ready.</Text>
      )}
      <View style={styles.cardActionRow}>
        <Pressable onPress={() => onDetails(order)} style={styles.detailAction}>
          <Text style={styles.detailActionText}>View details</Text>
        </Pressable>
        {sharing ? (
          <Pressable
            onPress={onStopLocationShare}
            style={[styles.secondaryAction, sharing && styles.secondaryActionActive]}
          >
            <Text style={[styles.secondaryActionText, sharing && styles.secondaryActionTextActive]}>
              Stop live GPS
            </Text>
          </Pressable>
        ) : null}
      </View>

      {sharing ? (
        <>
          <Text style={styles.liveText}>{sharingStatus ?? 'Sharing live location...'}</Text>
          {sharingError ? <Text style={styles.cardErrorText}>{sharingError}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

export function RiderDashboardScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Rider | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notification, setNotification] = useState<OrderRealtimeEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [sharingOrderId, setSharingOrderId] = useState<number | null>(null);
  const [sharingStatus, setSharingStatus] = useState<string | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const locationSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const trackingSocketRef = useRef<TrackingSocket | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWatchingLocationRef = useRef(false);

  // Completed or cancelled deliveries are not counted as active work.
  const activeDeliveries = useMemo(
    () => orders.filter((order) => !['delivered', 'completed', 'cancelled'].includes(order.status)),
    [orders]
  );
  const visibleDeliveries = useMemo(
    () => orders.filter((order) => !['completed', 'cancelled'].includes(order.status)),
    [orders]
  );
  const riderOnline = profile?.currentStatus === 'available';
  const riderOffline = Boolean(profile) && !riderOnline;
  const deliveredToday = useMemo(
    () =>
      orders.filter(
        (order) =>
          ['delivered', 'completed'].includes(order.status) &&
          isToday(order.updatedAt ?? order.createdAt)
      ).length,
    [orders]
  );
  const earningsToday = useMemo(() => {
    return orders
      .filter(
        (order) =>
          ['delivered', 'completed'].includes(order.status) &&
          isToday(order.updatedAt ?? order.createdAt)
      )
      .reduce((total, order) => total + Number(order.deliveryFee), 0);
  }, [orders]);

  const loadRiderDashboard = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!session?.token) {
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const [nextProfile, nextOrders] = await Promise.all([
        fetchMyRiderProfile(session.token),
        fetchOrders(session.token),
      ]);
      setProfile(nextProfile);
      setOrders(nextOrders);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load rider dashboard');
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
    loadRiderDashboard();
  }, [loadRiderDashboard]);

  useEffect(() => {
    if (!session?.token) {
      return undefined;
    }

    // Watch for delivery assignments and status changes in real time.
    const socket = createTrackingSocket(session.token);

    socket.on('connect', () => {
      void watchRiderOrders(socket).catch((watchError) => {
        setError(watchError instanceof Error ? watchError.message : 'Unable to watch deliveries');
      });
    });

    socket.on('order:notification', (event: OrderRealtimeEvent) => {
      showNotification(event);
      void loadRiderDashboard({ silent: true });
    });

    socket.on('connect_error', (socketError) => {
      setError(socketError.message || 'Realtime delivery notifications are unavailable.');
    });

    return () => {
      socket.off('connect');
      socket.off('order:notification');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [loadRiderDashboard, session?.token, showNotification]);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // Stop GPS tracking and close the tracking socket.
  const stopLocationSharing = useCallback(() => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    trackingSocketRef.current?.disconnect();
    trackingSocketRef.current = null;
    isWatchingLocationRef.current = false;
    setSharingOrderId(null);
    setSharingStatus(null);
    setSharingError(null);
  }, []);

  useEffect(() => stopLocationSharing, [stopLocationSharing]);

  async function changeRiderStatus(currentStatus: Rider['currentStatus']) {
    if (!session?.token) {
      return;
    }

    setUpdatingStatus(true);
    setError(null);

    try {
      await updateMyRiderStatus(session.token, currentStatus);
      await loadRiderDashboard();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update rider status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeliveryStatus(orderId: number, status: string) {
    if (!session?.token) {
      return;
    }

    setBusyOrderId(orderId);
    setError(null);

    try {
      // Accepting a delivery starts GPS sharing; delivered stops it.
      await updateOrderStatus(session.token, orderId, status);
      await loadRiderDashboard();

      if (status === 'out_for_delivery') {
        await startLocationSharing(orderId);
      }

      if (status === 'delivered') {
        stopLocationSharing();
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update delivery');
    } finally {
      setBusyOrderId(null);
    }
  }

  async function startLocationSharing(orderId: number) {
    if (!session?.token) {
      return;
    }

    if (sharingOrderId === orderId && isWatchingLocationRef.current) {
      return;
    }

    stopLocationSharing();
    setSharingOrderId(orderId);
    setSharingStatus('Requesting location permission...');
    setSharingError(null);

    try {
      // Ask for permission before sending the rider live location.
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        throw new Error('Location permission was not granted.');
      }

      const socket = createTrackingSocket(session.token);
      trackingSocketRef.current = socket;

      const sendPosition = async (position: Location.LocationObject) => {
        try {
          await sendRiderLocation(socket, {
            orderId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
          });
          setSharingStatus(`Last sent ${new Date().toLocaleTimeString()}`);
          setSharingError(null);
        } catch (locationError) {
          setSharingError(
            locationError instanceof Error ? locationError.message : 'Unable to send location'
          );
        }
      };

      const startWatching = async () => {
        if (isWatchingLocationRef.current) {
          return;
        }

        isWatchingLocationRef.current = true;
        setSharingStatus('Sharing live location...');

        const getBrowserPosition = () =>
          new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Browser geolocation is unavailable.'));
              return;
            }

            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000,
              }
            );
          });

        const normalizeBrowserPosition = (position: GeolocationPosition) => ({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading ?? null,
            speed: position.coords.speed ?? null,
            altitude: position.coords.altitude ?? null,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
          },
          timestamp: position.timestamp,
        } as Location.LocationObject);

        if (Platform.OS === 'web') {
          const firstPosition = await getBrowserPosition();
          await sendPosition(normalizeBrowserPosition(firstPosition));

          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              void sendPosition(normalizeBrowserPosition(position));
            },
            (error) => {
              setSharingError(error.message || 'Unable to track location.');
            },
            {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 15000,
            }
          );

          locationSubscriptionRef.current = {
            remove: () => navigator.geolocation.clearWatch(watchId),
          };
        } else {
          const firstPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await sendPosition(firstPosition);

          locationSubscriptionRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 20,
              timeInterval: 10000,
            },
            (position) => {
              void sendPosition(position);
            }
          );
        }
      };

      socket.on('connect', () => {
        void startWatching();
      });
      socket.on('connect_error', (socketError) => {
        setSharingError(socketError.message || 'Live tracking connection failed.');
      });
    } catch (shareError) {
      stopLocationSharing();
      setError(
        shareError instanceof Error
          ? `Live tracking could not start: ${shareError.message}`
          : 'Live tracking could not start.'
      );
    }
  }

  if (trackingOrder) {
    return <TrackingScreen onBack={() => setTrackingOrder(null)} order={trackingOrder} />;
  }

  if (detailsOrder) {
    return (
      <OrderDetailsScreen
        backLabel="Deliveries"
        initialOrder={detailsOrder}
        onBack={() => setDetailsOrder(null)}
        onTrack={(order) => {
          setDetailsOrder(null);
          setTrackingOrder(order);
        }}
        trackLabel="View tracking"
        showFinancials={false}
        showItems={false}
        showPayment={false}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.dashboard}>
        <Text style={styles.title}>My Dashboard</Text>

        <View style={styles.summaryRow}>
          <StatCard icon="$" label="Today" tone="orange" value={money(earningsToday)} />
          <StatCard icon="✓" label="Delivered" tone="green" value={String(deliveredToday)} />
          <StatCard icon="□" label="Active" tone="deepGreen" value={String(activeDeliveries.length)} />
        </View>

        <View style={styles.availabilityCard}>
          <View style={styles.availabilityCopy}>
            <Text style={styles.availabilityTitle}>
              {riderOnline ? 'You are online' : 'You are offline'}
            </Text>
            <Text style={styles.availabilityText}>
              {riderOnline
                ? 'Staff can assign deliveries to you.'
                : 'Go online to receive delivery assignments.'}
            </Text>
          </View>
          <View style={styles.statusControls}>
            <Pressable
              disabled={updatingStatus}
              onPress={() => changeRiderStatus('available')}
              style={[
                styles.onlineButton,
                profile?.currentStatus === 'available' && styles.onlineButtonActive,
                updatingStatus && styles.disabledAction,
              ]}
            >
              <Text
                style={[
                  styles.onlineButtonText,
                  riderOnline && styles.onlineButtonTextActive,
                ]}
              >
                Online
              </Text>
            </Pressable>
            <Pressable
              disabled={updatingStatus}
              onPress={() => changeRiderStatus('offline')}
              style={[
                styles.offlineButton,
                riderOffline && styles.offlineButtonActive,
                updatingStatus && styles.disabledAction,
              ]}
            >
              <Text
                style={[
                  styles.offlineButtonText,
                  riderOffline && styles.offlineButtonTextActive,
                ]}
              >
                Offline
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active Deliveries</Text>

      {notification ? (
        <View style={styles.notificationBanner}>
          <Text style={styles.notificationTitle}>Rider alert</Text>
          <Text style={styles.notificationText}>{notification.message}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.deliveryStateCard}>
          <ActivityIndicator color="#176b52" />
          <Text style={styles.stateText}>Loading deliveries...</Text>
        </View>
      ) : visibleDeliveries.length === 0 ? (
        <View style={styles.deliveryStateCard}>
          <Text style={styles.emptyIcon}>↗</Text>
          <Text style={styles.emptyTitle}>No active deliveries</Text>
          <Text style={styles.emptyText}>Go online to receive orders</Text>
        </View>
      ) : (
        <View style={styles.deliveryList}>
          {visibleDeliveries.map((item) => (
            <DeliveryCard
              key={item.id}
              busyOrderId={busyOrderId}
              onDetails={setDetailsOrder}
              onStartLocationShare={startLocationSharing}
              onStopLocationShare={stopLocationSharing}
              onStatus={handleDeliveryStatus}
              order={item}
              sharing={sharingOrderId === item.id}
              sharingError={sharingOrderId === item.id ? sharingError : null}
              sharingStatus={sharingOrderId === item.id ? sharingStatus : null}
            />
          ))}
        </View>
      )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#f7f3ef',
    flexGrow: 1,
    paddingBottom: 96,
    paddingHorizontal: 18,
    paddingTop: 34,
  },
  dashboard: {
    maxWidth: 454,
    width: '100%',
  },
  title: {
    color: '#151815',
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 11,
    marginBottom: 22,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e6ddd4',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 88,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  summaryIcon: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  summaryIconOrange: {
    color: '#ff741f',
  },
  summaryIconGreen: {
    color: '#00b650',
  },
  summaryIconDeepGreen: {
    color: '#14543b',
  },
  summaryValue: {
    color: '#0c0f0d',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 7,
    textAlign: 'center',
  },
  summaryLabel: {
    color: '#54635c',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  availabilityCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e6ddd4',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  availabilityCopy: {
    flex: 1,
    paddingRight: 12,
  },
  availabilityTitle: {
    color: '#151815',
    fontSize: 16,
    fontWeight: '900',
  },
  availabilityText: {
    color: '#5f675f',
    fontSize: 14,
    marginTop: 2,
  },
  statusControls: {
    flexDirection: 'row',
    gap: 8,
  },
  onlineButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#14543b',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  onlineButtonActive: {
    backgroundColor: '#00a64f',
    borderColor: '#063b29',
  },
  onlineButtonText: {
    color: '#14543b',
    fontSize: 12,
    fontWeight: '900',
  },
  onlineButtonTextActive: {
    color: '#ffffff',
  },
  offlineButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d8d0c8',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  offlineButtonActive: {
    backgroundColor: '#f3eee9',
  },
  offlineButtonText: {
    color: '#151815',
    fontSize: 12,
    fontWeight: '900',
  },
  offlineButtonTextActive: {
    color: '#14543b',
  },
  sectionTitle: {
    color: '#151815',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
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
  deliveryList: {
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e6ddd4',
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
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailAction: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  detailActionText: {
    color: '#176b52',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryActionActive: {
    backgroundColor: '#e8f0ec',
  },
  secondaryActionText: {
    color: '#176b52',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryActionTextActive: {
    color: '#124b3c',
  },
  disabledAction: {
    opacity: 0.55,
  },
  helperText: {
    color: '#6b736b',
    fontSize: 13,
    lineHeight: 19,
  },
  deliveredText: {
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    color: '#176b52',
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  acceptedText: {
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    color: '#176b52',
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  liveText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '800',
  },
  cardErrorText: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '800',
  },
  deliveryStateCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e6ddd4',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 134,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  stateText: {
    color: '#4c554c',
    marginTop: 12,
  },
  emptyIcon: {
    color: '#65776d',
    fontSize: 38,
    fontWeight: '300',
    lineHeight: 42,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#4c554c',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 5,
  },
  emptyText: {
    color: '#5f675f',
    fontSize: 14,
    textAlign: 'center',
  },
});
