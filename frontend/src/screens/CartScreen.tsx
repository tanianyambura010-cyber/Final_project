import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackButton } from '../components/BackButton';
import { useCart, type CartLine } from '../context/CartContext';
import { money } from '../utils/money';

function QuantityButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quantityButton}>
      <Text style={styles.quantityButtonText}>{label}</Text>
    </Pressable>
  );
}

function CartLineCard({ line }: { line: CartLine }) {
  const { addItem, decrementItem, removeItem } = useCart();

  return (
    <View style={styles.card}>
      <View style={styles.lineHeader}>
        <View style={styles.itemText}>
          <Text style={styles.itemName}>{line.item.name}</Text>
          <Text style={styles.lineMeta}>
            {money(line.item.price)} x {line.quantity}
          </Text>
        </View>
        <Text style={styles.lineTotal}>{money(line.item.price * line.quantity)}</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.stepper}>
          <QuantityButton label="-" onPress={() => decrementItem(line.item.id)} />
          <Text style={styles.quantity}>{line.quantity}</Text>
          <QuantityButton label="+" onPress={() => addItem(line.item)} />
        </View>
        <Pressable onPress={() => removeItem(line.item.id)} style={styles.removeButton}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CartScreen({
  onBack,
  onCheckout,
}: {
  onBack?: () => void;
  onCheckout: () => void;
}) {
  const { clearCart, itemCount, lines, notes, setNotes, subtotal } = useCart();
  const hasItems = lines.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          {onBack ? <BackButton onPress={onBack} /> : null}
          <View>
            <Text style={styles.kicker}>Bean & Dash</Text>
            <Text style={styles.title}>Cart</Text>
          </View>
        </View>
        {hasItems ? (
          <Pressable onPress={clearCart} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {!hasItems ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>Add meals from the menu to start an order.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(line) => String(line.item.id)}
            renderItem={({ item }) => <CartLineCard line={item} />}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          <View style={styles.summary}>
            <Text style={styles.notesLabel}>Delivery notes</Text>
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder="Example: call when you arrive"
              placeholderTextColor="#8b948b"
              style={styles.notesInput}
              value={notes}
            />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items</Text>
              <Text style={styles.summaryValue}>{itemCount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{money(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery fee</Text>
              <Text style={styles.summaryValue}>Calculated at checkout</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Items total</Text>
              <Text style={styles.totalValue}>{money(subtotal)}</Text>
            </View>

            <Pressable onPress={onCheckout} style={styles.checkoutButton}>
              <Text style={styles.checkoutText}>Checkout</Text>
            </Pressable>
          </View>
        </>
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
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerTitleRow: {
    alignItems: 'center',
    flex: 1,
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
  clearButton: {
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  clearText: {
    color: '#3d453d',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
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
  list: {
    paddingBottom: 12,
  },
  separator: {
    height: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  lineHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    color: '#1d211d',
    fontSize: 17,
    fontWeight: '800',
  },
  lineMeta: {
    color: '#5f675f',
    fontSize: 13,
    marginTop: 6,
  },
  lineTotal: {
    color: '#b14a32',
    fontSize: 15,
    fontWeight: '800',
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  quantityButton: {
    alignItems: 'center',
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  quantityButtonText: {
    color: '#176b52',
    fontSize: 20,
    fontWeight: '900',
  },
  quantity: {
    color: '#151815',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeText: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '800',
  },
  summary: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
    padding: 16,
  },
  notesLabel: {
    color: '#3d453d',
    fontSize: 14,
    fontWeight: '800',
  },
  notesInput: {
    borderColor: '#d8ded7',
    borderRadius: 8,
    borderWidth: 1,
    color: '#171a17',
    minHeight: 70,
    padding: 12,
    textAlignVertical: 'top',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#5f675f',
    fontSize: 14,
  },
  summaryValue: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '800',
  },
  totalRow: {
    borderTopColor: '#dde2dc',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
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
  checkoutButton: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  checkoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
