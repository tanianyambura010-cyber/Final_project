import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackButton } from '../components/BackButton';
import { MapPreview } from '../components/MapPreview';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { createOrder, type Order } from '../services/orders';
import { confirmDemoPayment, type DemoPaymentDetails, type Payment } from '../services/payments';
import { calculateDeliveryFee, deliveryDistanceKm } from '../utils/deliveryFee';
import { getCurrentCheckoutLocation } from '../utils/location';
import { validCoordinate } from '../utils/maps';
import { money } from '../utils/money';
import { orderStatusLabel } from '../utils/orderStatus';

type CheckoutResult = {
  order: Order;
  payment: Payment | null;
  demoPayment: DemoPaymentDetails;
};

export function CheckoutScreen({
  onBackToCart,
  onViewOrders,
}: {
  onBackToCart: () => void;
  onViewOrders: () => void;
}) {
  const { session } = useAuth();
  const { clearCart, lines, notes, subtotal } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const hasRequestedAutomaticLocation = useRef(false);
  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);
  const hasValidLocation =
    latitude.trim().length > 0 &&
    longitude.trim().length > 0 &&
    validCoordinate(latitudeNumber, longitudeNumber);
  const estimatedDeliveryFee = hasValidLocation
    ? calculateDeliveryFee(latitudeNumber, longitudeNumber)
    : 0;
  const estimatedDistanceKm = hasValidLocation
    ? deliveryDistanceKm(latitudeNumber, longitudeNumber)
    : null;
  const estimatedTotal = subtotal + estimatedDeliveryFee;

  // Checkout is allowed only when the cart and GPS details are ready.
  const canSubmit = useMemo(() => {
    return (
      Boolean(session?.token) &&
      lines.length > 0 &&
      deliveryAddress.trim().length >= 5 &&
      hasValidLocation &&
      !submitting
    );
  }, [deliveryAddress, hasValidLocation, lines.length, session?.token, submitting]);

  // Get the customer current delivery point from the device or browser.
  async function useCurrentLocation() {
    setLoadingLocation(true);
    setError(null);

    try {
      const location = await getCurrentCheckoutLocation();
      setDeliveryAddress(location.address);
      setLatitude(String(location.latitude));
      setLongitude(String(location.longitude));
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'Unable to get location');
    } finally {
      setLoadingLocation(false);
    }
  }

  useEffect(() => {
    if (hasRequestedAutomaticLocation.current) {
      return;
    }

    // Run automatic location detection once when checkout opens.
    hasRequestedAutomaticLocation.current = true;
    void useCurrentLocation();
  }, []);

  async function submitOrder() {
    if (!canSubmit || !session) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      // Send cart items and delivery details to the backend.
      const order = await createOrder(session.token, {
        items: lines.map((line) => ({
          menuItemId: line.item.id,
          quantity: line.quantity,
        })),
        deliveryAddress: deliveryAddress.trim(),
        deliveryLatitude: Number(latitude),
        deliveryLongitude: Number(longitude),
        deliveryNotes: notes.trim() || undefined,
        paymentMethod: 'stripe',
      });

      // Confirm a demo payment so the order can be tested without real money.
      const demoResult = await confirmDemoPayment(session.token, order.id);

      setResult({
        order: {
          ...order,
          status: demoResult.orderStatus,
          paymentStatus: demoResult.paymentStatus,
        },
        payment: demoResult.payment,
        demoPayment: demoResult.demoPayment,
      });
      clearCart();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to place order');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.successPanel}>
          <View style={styles.successHeader}>
            <BackButton onPress={onBackToCart} />
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>Payment accepted</Text>
              <Text style={styles.title}>Order #{result.order.id}</Text>
              <Text style={styles.bodyText}>
                A fake card payment was generated. Your order is {orderStatusLabel(result.order.status)} until staff accepts it.
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Demo payment details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Card</Text>
              <Text style={styles.detailValue}>
                {result.demoPayment.cardBrand} {result.demoPayment.maskedCardNumber}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cardholder</Text>
              <Text style={styles.detailValue}>{result.demoPayment.cardholder}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expiry</Text>
              <Text style={styles.detailValue}>{result.demoPayment.expiry}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={styles.detailValue}>{result.demoPayment.reference}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Approval code</Text>
              <Text style={styles.detailValue}>{result.demoPayment.approvalCode}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>{money(result.demoPayment.amount)}</Text>
            </View>
            {result.payment ? (
              <Text style={styles.receiptNote}>Backend payment status: {result.payment.status}</Text>
            ) : null}
          </View>

          <Pressable onPress={onViewOrders} style={styles.submitButton}>
            <Text style={styles.submitText}>View order history</Text>
          </Pressable>

          <Pressable onPress={onBackToCart} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back to cart</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <BackButton onPress={onBackToCart} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Bean & Dash</Text>
          <Text style={styles.title}>Checkout</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery location</Text>
        <View style={styles.locationSummary}>
          <View style={styles.locationMarker}>
            <Text style={styles.locationMarkerText}>L</Text>
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationEyebrow}>Current GPS location</Text>
            <Text style={styles.locationAddress}>
              {loadingLocation
                ? 'Detecting your location...'
                : hasValidLocation
                  ? deliveryAddress || 'Current GPS delivery location'
                  : 'Allow location permission so we can detect your delivery point automatically.'}
            </Text>
            {hasValidLocation ? (
              <Text style={styles.locationMeta}>GPS saved for delivery routing.</Text>
            ) : null}
          </View>
        </View>
        <TextInput
          multiline
          onChangeText={setDeliveryAddress}
          placeholder="Confirm or edit the delivery address"
          placeholderTextColor="#8b948b"
          style={styles.addressInput}
          value={deliveryAddress}
        />
        <Pressable onPress={useCurrentLocation} style={styles.locationButton}>
          {loadingLocation ? (
            <ActivityIndicator color="#176b52" />
          ) : (
            <Text style={styles.locationButtonText}>
              {hasValidLocation ? 'Refresh current location' : 'Retry automatic location'}
            </Text>
          )}
        </Pressable>
        {loadingLocation ? (
          <Text style={styles.locationHint}>Getting your current delivery location...</Text>
        ) : null}
        {hasValidLocation ? (
          <MapPreview
            points={[
              {
                latitude: latitudeNumber,
                longitude: longitudeNumber,
                label: 'D',
                color: 'green',
              },
            ]}
            subtitle={deliveryAddress || 'Delivery destination'}
            title="Delivery map preview"
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order summary</Text>
        {lines.map((line) => (
          <View key={line.item.id} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {line.item.name} x {line.quantity}
            </Text>
            <Text style={styles.summaryValue}>{money(line.item.price * line.quantity)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{money(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery fee</Text>
          <Text style={styles.summaryValue}>
            {hasValidLocation ? money(estimatedDeliveryFee) : 'Waiting for GPS'}
          </Text>
        </View>
        {estimatedDistanceKm !== null ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Distance</Text>
            <Text style={styles.summaryValue}>{estimatedDistanceKm.toFixed(2)} km</Text>
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{money(estimatedTotal)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <Text style={styles.bodyText}>
          Checkout will generate fake payment details and accept this order for demo testing.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submitOrder}
        style={[styles.submitButton, !canSubmit && styles.disabledButton]}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>Generate payment and place order</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  successHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
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
  locationSummary: {
    alignItems: 'center',
    backgroundColor: '#e8f0ec',
    borderColor: '#d3e0d9',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  locationMarker: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  locationMarkerText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  locationCopy: {
    flex: 1,
  },
  locationEyebrow: {
    color: '#a34f16',
    fontSize: 12,
    fontWeight: '900',
  },
  locationAddress: {
    color: '#151815',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 2,
  },
  locationMeta: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  addressInput: {
    borderColor: '#d8ded7',
    borderRadius: 8,
    borderWidth: 1,
    color: '#171a17',
    minHeight: 78,
    padding: 12,
    textAlignVertical: 'top',
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordinateInput: {
    borderColor: '#d8ded7',
    borderRadius: 8,
    borderWidth: 1,
    color: '#171a17',
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  locationButton: {
    alignItems: 'center',
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  locationButtonText: {
    color: '#176b52',
    fontSize: 14,
    fontWeight: '900',
  },
  locationHint: {
    color: '#5f675f',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#5f675f',
    flex: 1,
    fontSize: 14,
  },
  summaryValue: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    backgroundColor: '#dde2dc',
    height: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#151815',
    fontSize: 17,
    fontWeight: '900',
  },
  totalValue: {
    color: '#b14a32',
    fontSize: 17,
    fontWeight: '900',
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
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  disabledButton: {
    opacity: 0.55,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  successPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  infoBox: {
    backgroundColor: '#e8f0ec',
    gap: 8,
    borderRadius: 8,
    padding: 14,
  },
  infoTitle: {
    color: '#176b52',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  detailRow: {
    borderBottomColor: '#d7e0db',
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 8,
  },
  detailLabel: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '900',
  },
  receiptNote: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: '#fff3ec',
    borderRadius: 8,
    padding: 14,
  },
  warningTitle: {
    color: '#b14a32',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  syncButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 42,
  },
  syncButtonText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    color: '#176b52',
    fontSize: 15,
    fontWeight: '900',
  },
});
