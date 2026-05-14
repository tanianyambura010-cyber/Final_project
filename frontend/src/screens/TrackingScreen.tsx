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
import { RESTAURANT_LOCATION } from '../config/restaurant';
import { useAuth } from '../context/AuthContext';
import type { Order } from '../services/orders';
import { createTrackingSocket, joinOrderTracking } from '../services/realtime';
import {
  fetchLatestOrderLocation,
  normalizeRiderLocation,
  type RiderLocation,
  type SnakeCaseRiderLocation,
} from '../services/tracking';
import { getCurrentCheckoutLocation, type CheckoutLocation } from '../utils/location';
import type { MapPoint } from '../utils/maps';
import { orderStatusDescription, orderStatusLabel } from '../utils/orderStatus';

function readableStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatTime(value?: string) {
  if (!value) {
    return 'No update yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No update yet';
  }

  return date.toLocaleString();
}

export function TrackingScreen({ order: initialOrder, onBack }: { order: Order; onBack: () => void }) {
  const { session } = useAuth();
  const [order, setOrder] = useState(initialOrder);
  const [location, setLocation] = useState<RiderLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState('Connecting live tracking...');
  const [customerLiveLocation, setCustomerLiveLocation] = useState<CheckoutLocation | null>(null);
  const [customerLocationStatus, setCustomerLocationStatus] = useState<string | null>(null);

  const restaurantPoint = useMemo<MapPoint>(
    () => ({
      latitude: RESTAURANT_LOCATION.latitude,
      longitude: RESTAURANT_LOCATION.longitude,
      label: 'Restaurant',
      color: 'orange',
    }),
    []
  );

  const customerAddress = customerLiveLocation
    ? customerLiveLocation.address
    : order.deliveryAddress;

  const customerPoint = customerLiveLocation
    ? {
        latitude: customerLiveLocation.latitude,
        longitude: customerLiveLocation.longitude,
        label: 'Customer (live)',
        color: 'green',
      }
    : {
        latitude: Number(order.deliveryLatitude),
        longitude: Number(order.deliveryLongitude),
        label: 'Customer',
        color: 'green',
      };

  // Build the map route from restaurant to rider to customer.
  const mapPoints = useMemo(() => {
    const points: MapPoint[] = [restaurantPoint, customerPoint];

    if (location) {
      points.splice(1, 0, {
        latitude: location.latitude,
        longitude: location.longitude,
        label: 'Rider',
        color: '#176b52',
        icon: 'motorbike',
      });
    }

    return points;
  }, [customerPoint.latitude, customerPoint.longitude, customerPoint.label, location, restaurantPoint]);

  const loadLatestLocation = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const latestLocation = await fetchLatestOrderLocation(session.token, order.id);
      setLocation(latestLocation);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load tracking');
    } finally {
      setLoading(false);
    }
  }, [order.id, session?.token]);

  useEffect(() => {
    loadLatestLocation();
  }, [loadLatestLocation]);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (session?.user.role !== 'customer') {
      return;
    }

    let active = true;
    setCustomerLocationStatus('Detecting your current GPS delivery point...');

    getCurrentCheckoutLocation()
      .then((currentLocation) => {
        if (active) {
          setCustomerLiveLocation(currentLocation);
          setCustomerLocationStatus('Using your current GPS location for this route.');
        }
      })
      .catch(() => {
        if (active) {
          setCustomerLocationStatus('Using the delivery GPS saved at checkout.');
        }
      });

    return () => {
      active = false;
    };
  }, [session?.user.role]);

  useEffect(() => {
    if (!session?.token) {
      return undefined;
    }

    // Listen for live rider GPS updates and order status notifications.
    let active = true;
    const socket = createTrackingSocket(session.token);

    socket.on('connect', () => {
      setLiveStatus('Joining order tracking...');

      joinOrderTracking(socket, order.id)
        .then(() => {
          if (active) {
            setLiveStatus('Live tracking connected');
          }
        })
        .catch((joinError) => {
          if (active) {
            setLiveStatus(
              joinError instanceof Error ? joinError.message : 'Live tracking is unavailable'
            );
          }
        });
    });

    socket.on('connect_error', (socketError) => {
      if (active) {
        setLiveStatus(socketError.message || 'Live tracking is unavailable');
      }
    });

    socket.on('disconnect', () => {
      if (active) {
        setLiveStatus('Live tracking disconnected');
      }
    });

    socket.on('rider:location', (payload: RiderLocation | SnakeCaseRiderLocation) => {
      if (active) {
        setLocation(normalizeRiderLocation(payload));
        setLiveStatus('Live location updated');
      }
    });

    socket.on('order:notification', (event) => {
      if (active && event.orderId === order.id) {
        setOrder((currentOrder) => ({
          ...currentOrder,
          paymentStatus: event.paymentStatus,
          status: event.status,
        }));
        setLiveStatus(event.message);
      }
    });

    return () => {
      active = false;
      socket.off('order:notification');
      socket.disconnect();
    };
  }, [order.id, session?.token]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <BackButton label="Orders" onPress={onBack} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Live Tracking</Text>
          <Text style={styles.title}>Order #{order.id}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery status</Text>
        <View style={styles.badgeRow}>
          <Text style={styles.statusBadge}>{orderStatusLabel(order.status)}</Text>
          <Text style={styles.paymentBadge}>{readableStatus(order.paymentStatus)}</Text>
        </View>
        <Text style={styles.statusDescription}>{orderStatusDescription(order.status)}</Text>
        <Text style={styles.bodyText}>{customerAddress}</Text>
        {customerLocationStatus ? (
          <Text style={styles.locationHint}>{customerLocationStatus}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <MapPreview
          points={mapPoints}
          subtitle={
            location
              ? `Rider is moving toward the customer. Last seen ${formatTime(location.recordedAt)}`
              : customerLiveLocation
              ? `${RESTAURANT_LOCATION.name} to the customer's real-time delivery location.`
              : `${RESTAURANT_LOCATION.name} to the customer's saved delivery point.`
          }
          title="Delivery location"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rider update</Text>
        {loading ? (
          <View style={styles.inlineState}>
            <ActivityIndicator color="#176b52" />
            <Text style={styles.bodyText}>Checking latest location...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : location ? (
          <>
            <Text style={styles.bodyText}>
              Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
            <Text style={styles.bodyText}>Last update: {formatTime(location.recordedAt)}</Text>
          </>
        ) : (
          <Text style={styles.bodyText}>
            Tracking will appear here once the rider starts sending GPS updates.
          </Text>
        )}

        <Text style={styles.liveText}>{liveStatus}</Text>

        <Pressable onPress={loadLatestLocation} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh location</Text>
        </Pressable>
      </View>
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
    fontSize: 34,
    fontWeight: '800',
    marginTop: 2,
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
  sectionTitle: {
    color: '#151815',
    fontSize: 17,
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
  bodyText: {
    color: '#5f675f',
    fontSize: 14,
    lineHeight: 20,
  },
  statusDescription: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  locationHint: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  inlineState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
  },
  liveText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '800',
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});
