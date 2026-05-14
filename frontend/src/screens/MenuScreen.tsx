import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { API_BASE_URL } from '../config/api';
import { PublicFooter } from '../components/PublicFooter';
import { useCart } from '../context/CartContext';
import { fetchMenuItems, type MenuItem } from '../services/menu';
import { foodImageFor } from '../utils/foodImages';
import { money } from '../utils/money';

function categoryKey(category: string) {
  return category.trim().toLowerCase();
}

function MenuCard({
  item,
  quantity,
  onAdd,
}: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
}) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: foodImageFor(item.category, item.imageUrl) }} style={styles.itemImage} />
      <View style={styles.cardHeader}>
        <View style={styles.itemText}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description || 'Freshly prepared item'}
          </Text>
        </View>
        <Text style={styles.price}>{money(item.price)}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.category}>{item.category}</Text>
        <Pressable onPress={onAdd} style={styles.addButton}>
          <Text style={styles.addButtonText}>{quantity > 0 ? `Add (${quantity})` : 'Add'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MenuScreen({
  initialCategory = 'All',
  initialSearch = '',
}: {
  initialCategory?: string;
  initialSearch?: string;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const { addItem, quantityFor } = useCart();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, string>();

    for (const item of items) {
      const key = categoryKey(item.category);

      if (!uniqueCategories.has(key)) {
        uniqueCategories.set(key, item.category);
      }
    }

    return ['All', ...uniqueCategories.values()];
  }, [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || categoryKey(item.category) === categoryKey(selectedCategory);
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.description ?? '').toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [items, search, selectedCategory]);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextItems = await fetchMenuItems();
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load menu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Bean & Dash</Text>
          <Text style={styles.title}>Menu</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={loadMenu}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusText}>{items.length} available items</Text>
        <Text style={styles.statusText}>{Math.max(categories.length - 1, 0)} categories</Text>
      </View>

      <View style={styles.filterBlock}>
        <TextInput
          autoCapitalize="none"
          onChangeText={setSearch}
          placeholder="Search menu"
          placeholderTextColor="#8b948b"
          style={styles.searchInput}
          value={search}
        />
        <ScrollView
          contentContainerStyle={styles.categoryList}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {categories.map((category) => (
            <Pressable
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#176b52" />
          <Text style={styles.stateText}>Loading menu...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Menu unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.apiText}>{API_BASE_URL}</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No matching items</Text>
          <Text style={styles.emptyText}>Try another search or category.</Text>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={isDesktop ? styles.desktopGridRow : undefined}
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          key={isDesktop ? 'desktop-grid' : 'mobile-list'}
          numColumns={isDesktop ? 3 : 1}
          renderItem={({ item }) => (
            <MenuCard item={item} onAdd={() => addItem(item)} quantity={quantityFor(item.id)} />
          )}
          contentContainerStyle={[styles.list, isDesktop && styles.desktopList]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={<PublicFooter />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  kicker: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#151815',
    fontSize: 29,
    fontWeight: '800',
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: '#075f46',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statusText: {
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    color: '#3f463f',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterBlock: {
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151815',
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  categoryList: {
    gap: 8,
    paddingRight: 18,
  },
  categoryChip: {
    alignItems: 'center',
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  categoryChipActive: {
    backgroundColor: '#176b52',
    borderColor: '#176b52',
  },
  categoryChipText: {
    color: '#3d453d',
    fontSize: 13,
    fontWeight: '800',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingBottom: 28,
  },
  desktopList: {
    paddingBottom: 40,
  },
  desktopGridRow: {
    gap: 16,
  },
  separator: {
    height: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
    padding: 0,
  },
  itemImage: {
    height: 180,
    marginBottom: 0,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    color: '#1d211d',
    fontSize: 18,
    fontWeight: '800',
  },
  itemDescription: {
    color: '#5f675f',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  price: {
    color: '#a34f16',
    fontSize: 15,
    fontWeight: '900',
  },
  category: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '700',
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    paddingTop: 12,
  },
  addButton: {
    backgroundColor: '#075f46',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
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
  apiText: {
    color: '#6b736b',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});
