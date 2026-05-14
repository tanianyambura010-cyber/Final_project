import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { MenuItem } from '../services/menu';

export type CartLine = {
  item: MenuItem;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  notes: string;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  addItem: (item: MenuItem) => void;
  decrementItem: (itemId: number) => void;
  removeItem: (itemId: number) => void;
  clearCart: () => void;
  quantityFor: (itemId: number) => number;
  setNotes: (notes: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState('');

  const addItem = useCallback((item: MenuItem) => {
    setLines((currentLines) => {
      const existingLine = currentLines.find((line) => line.item.id === item.id);

      if (existingLine) {
        return currentLines.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      return [...currentLines, { item, quantity: 1 }];
    });
  }, []);

  const decrementItem = useCallback((itemId: number) => {
    setLines((currentLines) =>
      currentLines
        .map((line) =>
          line.item.id === itemId ? { ...line, quantity: line.quantity - 1 } : line
        )
        .filter((line) => line.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((itemId: number) => {
    setLines((currentLines) => currentLines.filter((line) => line.item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setNotes('');
  }, []);

  const quantityFor = useCallback(
    (itemId: number) => lines.find((line) => line.item.id === itemId)?.quantity ?? 0,
    [lines]
  );

  const value = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const deliveryFee = 0;

    return {
      lines,
      notes,
      itemCount,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      addItem,
      decrementItem,
      removeItem,
      clearCart,
      quantityFor,
      setNotes,
    };
  }, [addItem, clearCart, decrementItem, lines, notes, quantityFor, removeItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);

  if (!value) {
    throw new Error('useCart must be used inside CartProvider');
  }

  return value;
}
