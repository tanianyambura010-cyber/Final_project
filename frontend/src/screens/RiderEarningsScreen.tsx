import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { fetchOrders, type Order } from '../services/orders';
import { money } from '../utils/money';

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

export function RiderEarningsScreen() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deliveredOrders = useMemo(
    () => orders.filter((order) => ['delivered', 'completed'].includes(order.status)),
    [orders]
  );
  const todayOrders = useMemo(
    () => deliveredOrders.filter((order) => isToday(order.updatedAt ?? order.createdAt)),
    [deliveredOrders]
  );
  const todayEarnings = useMemo(
    () => todayOrders.reduce((total, order) => total + Number(order.deliveryFee), 0),
    [todayOrders]
  );
  const totalEarnings = useMemo(
    () => deliveredOrders.reduce((total, order) => total + Number(order.deliveryFee), 0),
    [deliveredOrders]
  );

  const loadEarnings = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setOrders(await fetchOrders(session.token));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load earnings');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.dashboard}>
        <Text style={styles.title}>Earnings</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIconOrange}>$</Text>
            <Text style={styles.summaryValue}>{money(todayEarnings)}</Text>
            <Text style={styles.summaryLabel}>Today</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIconGreen}>✓</Text>
            <Text style={styles.summaryValue}>{todayOrders.length}</Text>
            <Text style={styles.summaryLabel}>Delivered</Text>
          </View>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.cardTitle}>Total rider earnings</Text>
          <Text style={styles.totalValue}>{money(totalEarnings)}</Text>
          <Text style={styles.cardText}>Delivery fees from completed deliveries.</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#14543b" />
            <Text style={styles.stateText}>Loading earnings...</Text>
          </View>
        ) : deliveredOrders.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.emptyIcon}>$</Text>
            <Text style={styles.emptyTitle}>No earnings yet</Text>
            <Text style={styles.stateText}>Completed deliveries will appear here.</Text>
          </View>
        ) : (
          <View style={styles.deliveryList}>
            {deliveredOrders.slice(0, 6).map((order) => (
              <View key={order.id} style={styles.deliveryRow}>
                <View>
                  <Text style={styles.orderTitle}>Order #{order.id}</Text>
                  <Text style={styles.orderMeta}>{order.customerName ?? 'Customer'}</Text>
                </View>
                <Text style={styles.orderAmount}>{money(Number(order.deliveryFee))}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable onPress={loadEarnings} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
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
  summaryIconOrange: {
    color: '#ff741f',
    fontSize: 22,
    fontWeight: '900',
  },
  summaryIconGreen: {
    color: '#00b650',
    fontSize: 22,
    fontWeight: '900',
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
  earningsCard: {
    backgroundColor: '#14543b',
    borderRadius: 8,
    gap: 6,
    marginBottom: 14,
    padding: 18,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  totalValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  cardText: {
    color: '#d9e7df',
    fontSize: 13,
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e6ddd4',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 134,
    padding: 22,
  },
  emptyIcon: {
    color: '#ff741f',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#4c554c',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 5,
  },
  stateText: {
    color: '#5f675f',
    fontSize: 14,
    textAlign: 'center',
  },
  deliveryList: {
    gap: 10,
  },
  deliveryRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e6ddd4',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  orderTitle: {
    color: '#151815',
    fontSize: 15,
    fontWeight: '900',
  },
  orderMeta: {
    color: '#5f675f',
    fontSize: 12,
    marginTop: 3,
  },
  orderAmount: {
    color: '#ff741f',
    fontSize: 15,
    fontWeight: '900',
  },
  refreshButton: {
    alignItems: 'center',
    borderColor: '#14543b',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 42,
  },
  refreshText: {
    color: '#14543b',
    fontSize: 13,
    fontWeight: '900',
  },
});
