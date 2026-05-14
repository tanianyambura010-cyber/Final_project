import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { fetchMenuItems } from '../services/menu';
import { fetchOrderDetails, fetchOrders, type Order, type OrderItem } from '../services/orders';
import { fetchRiders, type Rider } from '../services/riders';
import { money } from '../utils/money';
import { orderStatusLabel } from '../utils/orderStatus';

const ACTIVE_ORDER_STATUSES = ['created', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered'];

type Accent = 'green' | 'orange' | 'blue' | 'neutral';

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function safeDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });
}

function MetricCard({
  accent = 'green',
  label,
  value,
}: {
  accent?: Accent;
  label: string;
  value: string;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        accent === 'blue' && styles.metricCardBlue,
        accent === 'orange' && styles.metricCardOrange,
      ]}
    >
      <Text
        style={[
          styles.metricValue,
          accent === 'blue' && styles.metricValueBlue,
          accent === 'orange' && styles.metricValueOrange,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function InsightCard({
  accent = 'green',
  label,
  value,
}: {
  accent?: Accent;
  label: string;
  value: string;
}) {
  return (
    <View
      style={[
        styles.insightCard,
        accent === 'blue' && styles.insightCardBlue,
        accent === 'orange' && styles.insightCardOrange,
        accent === 'neutral' && styles.insightCardNeutral,
      ]}
    >
      <Text
        style={[
          styles.insightValue,
          accent === 'blue' && styles.insightValueBlue,
          accent === 'orange' && styles.insightValueOrange,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

function BarRow({
  fillColor = '#176b52',
  label,
  value,
  maxValue,
  valueLabel,
}: {
  fillColor?: string;
  label: string;
  value: number;
  maxValue: number;
  valueLabel: string;
}) {
  const percent = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 8 : 0) : 0;

  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{valueLabel}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { backgroundColor: fillColor, width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function RevenueColumnChart({
  data,
  maxValue,
}: {
  data: { key: string; label: string; revenue: number }[];
  maxValue: number;
}) {
  return (
    <View style={styles.columnChart}>
      {data.map((entry) => {
        const height = maxValue > 0 ? Math.max((entry.revenue / maxValue) * 128, entry.revenue > 0 ? 10 : 0) : 0;

        return (
          <View key={entry.key} style={styles.columnSlot}>
            <Text style={styles.columnValue} numberOfLines={1}>
              {entry.revenue > 0 ? money(entry.revenue) : ''}
            </Text>
            <View style={styles.columnTrack}>
              <View style={[styles.columnBar, { height }]} />
            </View>
            <Text style={styles.columnLabel}>{entry.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function StatusStackChart({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  const colors = ['#2563eb', '#176b52', '#ff741f', '#0f766e', '#b14a32', '#94a3b8'];
  const total = data.reduce((sum, entry) => sum + entry.count, 0);
  const visible = data.filter((entry) => entry.count > 0);

  return (
    <View style={styles.stackChart}>
      <View style={styles.stackTrack}>
        {visible.length > 0 ? (
          visible.map((entry, index) => (
            <View
              key={entry.status}
              style={[
                styles.stackSegment,
                {
                  backgroundColor: colors[index % colors.length],
                  flex: entry.count,
                },
              ]}
            />
          ))
        ) : (
          <View style={styles.emptyStackSegment} />
        )}
      </View>

      <View style={styles.statusLegend}>
        {data.map((entry, index) => (
          <View key={entry.status} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors[index % colors.length] }]} />
            <Text style={styles.legendLabel}>{orderStatusLabel(entry.status)}</Text>
            <Text style={styles.legendValue}>
              {entry.count}
              {total > 0 ? ` (${Math.round((entry.count / total) * 100)}%)` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecentOrderRow({ order }: { order: Order }) {
  return (
    <View style={styles.recentRow}>
      <View style={styles.recentCopy}>
        <Text style={styles.recentTitle}>Order #{order.id}</Text>
        <Text style={styles.recentMeta}>{order.customerName ?? 'Customer'}</Text>
      </View>
      <View style={styles.recentRight}>
        <Text style={styles.recentAmount}>{money(Number(order.totalAmount))}</Text>
        <Text style={styles.recentStatus}>{orderStatusLabel(order.status)}</Text>
      </View>
    </View>
  );
}

export function AnalyticsDashboardScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [menuCount, setMenuCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextOrders, nextRiders, menuItems] = await Promise.all([
        fetchOrders(session.token),
        fetchRiders(session.token),
        fetchMenuItems({}),
      ]);

      const detailResults = await Promise.all(
        nextOrders.slice(0, 40).map((order) =>
          fetchOrderDetails(session.token, order.id).catch(() => ({ order, items: [] }))
        )
      );

      setOrders(nextOrders);
      setRiders(nextRiders);
      setMenuCount(menuItems.length);
      setOrderItems(detailResults.flatMap((detail) => detail.items));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load analytics');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const analytics = useMemo(() => {
    const today = startOfToday();
    const todayOrders = orders.filter((order) => {
      const createdAt = safeDate(order.createdAt);
      return createdAt ? createdAt >= today : false;
    });
    const paidOrders = orders.filter((order) => order.paymentStatus === 'paid');
    const activeOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status));
    const activeRiders = riders.filter((rider) => rider.currentStatus !== 'offline');
    const completedOrders = orders.filter((order) => order.status === 'completed');
    const deliveredOrders = orders.filter((order) => ['delivered', 'completed'].includes(order.status));
    const completedDurations = completedOrders
      .map((order) => {
        const createdAt = safeDate(order.createdAt);
        const updatedAt = safeDate(order.updatedAt);
        return createdAt && updatedAt ? (updatedAt.getTime() - createdAt.getTime()) / 60000 : null;
      })
      .filter((duration): duration is number => duration !== null && duration >= 0);
    const averageDeliveryMinutes =
      completedDurations.length > 0
        ? completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length
        : 0;

    const days = lastSevenDays();
    const revenueByDay = days.map((day) => {
      const key = dateKey(day);
      const revenue = paidOrders
        .filter((order) => {
          const createdAt = safeDate(order.createdAt);
          return createdAt ? dateKey(createdAt) === key : false;
        })
        .reduce((sum, order) => sum + Number(order.totalAmount), 0);

      return {
        key,
        label: day.toLocaleDateString(undefined, { weekday: 'short' }),
        revenue,
      };
    });

    const itemTotals = new Map<string, number>();

    for (const item of orderItems) {
      itemTotals.set(item.name, (itemTotals.get(item.name) ?? 0) + item.quantity);
    }

    const topItems = [...itemTotals.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 5);

    const statusTotals = ACTIVE_ORDER_STATUSES.map((status) => ({
      status,
      count: orders.filter((order) => order.status === status).length,
    }));

    return {
      activeOrders: activeOrders.length,
      activeRiders: activeRiders.length,
      averageDeliveryMinutes,
      completionRate: orders.length > 0 ? Math.round((deliveredOrders.length / orders.length) * 100) : 0,
      paidOrders: paidOrders.length,
      menuCount,
      ordersToday: todayOrders.length,
      pendingOrders: orders.filter((order) => order.status === 'created').length,
      recentOrders: orders.slice(0, 5),
      revenueByDay,
      revenueToday: todayOrders
        .filter((order) => order.paymentStatus === 'paid')
        .reduce((sum, order) => sum + Number(order.totalAmount), 0),
      totalRevenue: paidOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
      statusTotals,
      topItems,
    };
  }, [menuCount, orderItems, orders, riders]);

  const maxRevenue = Math.max(...analytics.revenueByDay.map((entry) => entry.revenue), 0);
  const maxTopItemQuantity = Math.max(...analytics.topItems.map((item) => item.quantity), 0);
  const busiestStatus = analytics.statusTotals.reduce(
    (current, status) => (status.count > current.count ? status : current),
    analytics.statusTotals[0]
  );
  const isWide = width >= 960;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Analytics</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        <Pressable onPress={loadAnalytics} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#176b52" />
          <Text style={styles.stateText}>Loading analytics...</Text>
        </View>
      ) : (
        <>
          <View style={[styles.heroPanel, isWide && styles.heroPanelWide]}>
            <View style={styles.heroMain}>
              <Text style={styles.heroKicker}>Today at a glance</Text>
              <Text style={styles.heroValue}>{money(analytics.revenueToday)}</Text>
              <Text style={styles.heroText}>
                {analytics.ordersToday} orders today with {analytics.pendingOrders} waiting for staff action.
              </Text>
            </View>
            <View style={styles.heroInsightGrid}>
              <InsightCard accent="blue" label="Paid orders" value={String(analytics.paidOrders)} />
              <InsightCard accent="orange" label="Completion" value={`${analytics.completionRate}%`} />
              <InsightCard
                accent="neutral"
                label="Busiest status"
                value={busiestStatus ? orderStatusLabel(busiestStatus.status) : 'None'}
              />
            </View>
          </View>

          <View style={styles.metricGrid}>
            <MetricCard accent="blue" label="Orders today" value={String(analytics.ordersToday)} />
            <MetricCard accent="green" label="Total revenue" value={money(analytics.totalRevenue)} />
            <MetricCard accent="orange" label="Active riders" value={String(analytics.activeRiders)} />
            <MetricCard accent="green" label="Pending orders" value={String(analytics.pendingOrders)} />
          </View>

          <View style={[styles.chartGrid, isWide && styles.chartGridWide]}>
            <View style={[styles.card, styles.chartCard, isWide && styles.chartHalf]}>
              <View style={styles.cardHeadingRow}>
                <View>
                  <Text style={styles.sectionTitle}>Revenue report</Text>
                  <Text style={styles.sectionMeta}>Last 7 days</Text>
                </View>
                <Text style={[styles.chartType, styles.chartTypeBlue]}>Column chart</Text>
              </View>
              <RevenueColumnChart data={analytics.revenueByDay} maxValue={maxRevenue} />
            </View>

            <View style={[styles.card, styles.chartCard, isWide && styles.chartHalf]}>
              <View style={styles.cardHeadingRow}>
                <View>
                  <Text style={styles.sectionTitle}>Order status mix</Text>
                  <Text style={styles.sectionMeta}>Current order pipeline</Text>
                </View>
                <Text style={styles.chartType}>Stacked chart</Text>
              </View>
              <StatusStackChart data={analytics.statusTotals} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Popular foods</Text>
            {analytics.topItems.length > 0 ? (
              analytics.topItems.map((item) => (
                <BarRow
                  key={item.name}
                  label={item.name}
                  maxValue={maxTopItemQuantity}
                  value={item.quantity}
                  valueLabel={`${item.quantity} sold`}
                  fillColor="#2e4983"
                />
              ))
            ) : (
              <Text style={styles.bodyText}>Top-selling items will appear after orders are placed.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery performance</Text>
            <View style={styles.performanceGrid}>
              <InsightCard accent="green" label="Active orders" value={String(analytics.activeOrders)} />
              <InsightCard accent="blue" label="Menu items" value={String(analytics.menuCount)} />
              <InsightCard
                accent="orange"
                label="Average delivery"
                value={`${Math.round(analytics.averageDeliveryMinutes)} mins`}
              />
            </View>
            <Text style={styles.bodyText}>
              Use this panel to monitor whether orders are moving through preparation and delivery smoothly.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent orders</Text>
            {analytics.recentOrders.length > 0 ? (
              analytics.recentOrders.map((order) => <RecentOrderRow key={order.id} order={order} />)
            ) : (
              <Text style={styles.bodyText}>Recent orders will appear here.</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f5f8fb',
    flexGrow: 1,
    gap: 16,
    paddingBottom: 34,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: '#151815',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: '#da7421',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  heroPanel: {
    backgroundColor: '#176b52',
    borderRadius: 8,
    gap: 14,
    padding: 18,
  },
  heroPanelWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  heroMain: {
    flex: 1.2,
    gap: 6,
  },
  heroKicker: {
    color: '#bfdbfe',
    fontSize: 13,
    fontWeight: '900',
  },
  heroValue: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
  },
  heroText: {
    color: '#dbeafe',
    fontSize: 14,
    lineHeight: 20,
  },
  heroInsightGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
  },
  metricCardBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  metricCardOrange: {
    backgroundColor: '#fff3ec',
    borderColor: '#ffd0b5',
  },
  metricValue: {
    color: '#176b52',
    fontSize: 22,
    fontWeight: '900',
  },
  metricValueBlue: {
    color: '#2563eb',
  },
  metricValueOrange: {
    color: '#b14a32',
  },
  metricLabel: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  insightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flexBasis: 124,
    flexGrow: 1,
    padding: 12,
  },
  insightCardBlue: {
    backgroundColor: '#eff6ff',
  },
  insightCardOrange: {
    backgroundColor: '#fff3ec',
  },
  insightCardNeutral: {
    backgroundColor: '#f8fafc',
  },
  insightValue: {
    color: '#176b52',
    fontSize: 17,
    fontWeight: '900',
  },
  insightValueBlue: {
    color: '#2563eb',
  },
  insightValueOrange: {
    color: '#b14a32',
  },
  insightLabel: {
    color: '#5f675f',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 5,
  },
  chartGrid: {
    gap: 14,
  },
  chartGridWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  chartHalf: {
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe5ef',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  chartCard: {
    minHeight: 258,
  },
  cardHeadingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#151815',
    fontSize: 17,
    fontWeight: '900',
  },
  sectionMeta: {
    color: '#6b736b',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  chartType: {
    backgroundColor: '#fff3ec',
    borderRadius: 8,
    color: '#b14a32',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  chartTypeBlue: {
    backgroundColor: '#eff6ff',
    color: '#06225f',
  },
  columnChart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 184,
  },
  columnSlot: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  columnValue: {
    color: '#5f675f',
    fontSize: 10,
    fontWeight: '800',
    minHeight: 14,
    textAlign: 'center',
  },
  columnTrack: {
    alignItems: 'center',
    backgroundColor: '#eaf1fb',
    borderRadius: 8,
    height: 132,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  columnBar: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    width: '100%',
  },
  columnLabel: {
    color: '#4c554c',
    fontSize: 11,
    fontWeight: '900',
  },
  stackChart: {
    gap: 12,
  },
  stackTrack: {
    backgroundColor: '#eaf1fb',
    borderRadius: 8,
    flexDirection: 'row',
    height: 24,
    overflow: 'hidden',
  },
  stackSegment: {
    height: 24,
  },
  emptyStackSegment: {
    backgroundColor: '#d8ded7',
    flex: 1,
    height: 24,
  },
  statusLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendSwatch: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: '#151815',
    fontSize: 12,
    fontWeight: '900',
  },
  legendValue: {
    color: '#6b736b',
    fontSize: 11,
    fontWeight: '800',
  },
  barRow: {
    gap: 6,
  },
  barLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  barLabel: {
    color: '#3d453d',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  barValue: {
    color: '#6b736b',
    fontSize: 12,
    fontWeight: '800',
  },
  barTrack: {
    backgroundColor: '#eaf1fb',
    borderRadius: 8,
    height: 12,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 8,
    height: 12,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bodyText: {
    color: '#5f675f',
    fontSize: 14,
    lineHeight: 20,
  },
  recentRow: {
    alignItems: 'center',
    borderBottomColor: '#edf0ec',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  recentCopy: {
    flex: 1,
  },
  recentTitle: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '900',
  },
  recentMeta: {
    color: '#6b736b',
    fontSize: 12,
    marginTop: 3,
  },
  recentRight: {
    alignItems: 'flex-end',
  },
  recentAmount: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '900',
  },
  recentStatus: {
    color: '#176b52',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 280,
    paddingHorizontal: 22,
  },
  stateText: {
    color: '#4c554c',
    marginTop: 12,
  },
});
