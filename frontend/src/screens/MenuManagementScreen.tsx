import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import {
  createMenuItem,
  fetchMenuItems,
  uploadMenuImage,
  updateMenuAvailability,
  updateMenuItem,
  type MenuItem,
  type MenuItemPayload,
} from '../services/menu';
import { money } from '../utils/money';

type FormState = {
  name: string;
  description: string;
  category: string;
  price: string;
  imageUrl: string;
  isAvailable: boolean;
};

const emptyForm: FormState = {
  name: '',
  description: '',
  category: '',
  price: '',
  imageUrl: '',
  isAvailable: true,
};

function toForm(item: MenuItem): FormState {
  return {
    name: item.name,
    description: item.description ?? '',
    category: item.category,
    price: String(item.price),
    imageUrl: item.imageUrl ?? '',
    isAvailable: item.isAvailable,
  };
}

function compactOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildPayload(form: FormState): MenuItemPayload {
  const price = Number(form.price);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Price must be a positive number.');
  }

  return {
    name: form.name.trim(),
    description: compactOptional(form.description),
    category: form.category.trim(),
    price,
    imageUrl: compactOptional(form.imageUrl),
    isAvailable: form.isAvailable,
  };
}

function MenuAdminCard({
  busyItemId,
  desktop,
  item,
  onEdit,
  onToggleAvailability,
}: {
  busyItemId: number | null;
  desktop: boolean;
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}) {
  const busy = busyItemId === item.id;

  return (
    <View style={[styles.itemCard, desktop && styles.desktopItemCard]}>
      {item.imageUrl ? (
        <Image resizeMode="cover" source={{ uri: item.imageUrl }} style={styles.itemImage} />
      ) : (
        <View style={styles.itemImagePlaceholder}>
          <Text style={styles.itemImagePlaceholderText}>{item.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.itemHeader}>
        <View style={styles.itemCopy}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>{item.category}</Text>
        </View>
        <Text style={styles.price}>{money(Number(item.price))}</Text>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {item.description || 'No description yet.'}
      </Text>

      <View style={styles.badgeRow}>
        <Text style={[styles.availabilityBadge, !item.isAvailable && styles.unavailableBadge]}>
          {item.isAvailable ? 'Available' : 'Unavailable'}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={() => onEdit(item)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Edit</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => onToggleAvailability(item)}
          style={[styles.primaryButton, busy && styles.disabledAction]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {item.isAvailable ? 'Mark unavailable' : 'Mark available'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function StatTile({
  accent,
  label,
  value,
}: {
  accent: 'green' | 'orange' | 'cream';
  label: string;
  value: string;
}) {
  return (
    <View
      style={[
        styles.statTile,
        accent === 'orange' && styles.statTileOrange,
        accent === 'cream' && styles.statTileCream,
      ]}
    >
      <Text style={[styles.statValue, accent === 'orange' && styles.statValueOrange]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function MenuManagementScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const available = items.filter((item) => item.isAvailable).length;
    const unavailable = items.length - available;
    const categories = new Set(items.map((item) => item.category)).size;

    return { available, categories, unavailable };
  }, [items]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(items.map((item) => item.category))).sort()],
    [items]
  );

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm) ||
        (item.description ?? '').toLowerCase().includes(searchTerm);

      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, items, search]);

  const isDesktop = width >= 980;

  const loadMenu = useCallback(async () => {
    // Reload the latest menu list after create, edit, or availability changes.
    setLoading(true);
    setError(null);

    try {
      const nextItems = await fetchMenuItems({});
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load menu items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  function resetForm() {
    setForm(emptyForm);
    setEditingItemId(null);
  }

  function editItem(item: MenuItem) {
    setForm(toForm(item));
    setEditingItemId(item.id);
    setError(null);
  }

  async function chooseImage() {
    if (!session?.token || uploadingImage) {
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      // Let admin or staff select an image from the local device.
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const webFile = (asset as ImagePicker.ImagePickerAsset & { file?: Blob }).file;
      const upload = await uploadMenuImage(session.token, {
        uri: asset.uri,
        name: asset.fileName ?? `menu-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
        file: webFile,
      });

      setForm((current) => ({ ...current, imageUrl: upload.imageUrl }));
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Unable to upload image');
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveItem() {
    if (!session?.token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Reuse the same form for creating and editing menu items.
      const payload = buildPayload(form);

      if (editingItemId) {
        await updateMenuItem(session.token, editingItemId, payload);
      } else {
        await createMenuItem(session.token, payload);
      }

      resetForm();
      await loadMenu();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save menu item');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!session?.token) {
      return;
    }

    setBusyItemId(item.id);
    setError(null);

    try {
      await updateMenuAvailability(session.token, item.id, !item.isAvailable);
      await loadMenu();
    } catch (availabilityError) {
      setError(
        availabilityError instanceof Error
          ? availabilityError.message
          : 'Unable to update availability'
      );
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.screen, isDesktop && styles.desktopScreen]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Bean & Dash Admin</Text>
          <Text style={styles.title}>Menu Management</Text>
          <Text style={styles.subtitle}>Create, edit, and control what customers can order.</Text>
        </View>
        <Pressable onPress={loadMenu} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <StatTile accent="green" label="Total items" value={String(items.length)} />
        <StatTile accent="orange" label="Available" value={String(summary.available)} />
        <StatTile accent="cream" label="Offline" value={String(summary.unavailable)} />
        <StatTile accent="green" label="Categories" value={String(summary.categories)} />
      </View>

      <View style={[styles.workspace, isDesktop && styles.desktopWorkspace]}>
        <View style={[styles.formCard, isDesktop && styles.desktopFormCard]}>
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.formTitle}>{editingItemId ? 'Edit item' : 'Create item'}</Text>
              <Text style={styles.formSubtitle}>
                {editingItemId ? 'Update the selected menu item.' : 'Add a meal, drink, snack, or breakfast item.'}
              </Text>
            </View>
            {editingItemId ? (
              <Pressable onPress={resetForm} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>New</Text>
              </Pressable>
            ) : null}
          </View>

          <TextInput
            onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="Item name"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={form.name}
          />
          <TextInput
            onChangeText={(value) => setForm((current) => ({ ...current, category: value }))}
            placeholder="Category"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={form.category}
          />
          <TextInput
            keyboardType="numeric"
            onChangeText={(value) => setForm((current) => ({ ...current, price: value }))}
            placeholder="Price"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={form.price}
          />
          <TextInput
            multiline
            onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
            placeholder="Description"
            placeholderTextColor="#8b948b"
            style={[styles.input, styles.textArea]}
            value={form.description}
          />

          {form.imageUrl ? (
            <Image resizeMode="cover" source={{ uri: form.imageUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image selected</Text>
            </View>
          )}

          <View style={styles.imageButtonRow}>
            <Pressable
              disabled={uploadingImage}
              onPress={chooseImage}
              style={[styles.imageButton, uploadingImage && styles.disabledAction]}
            >
              {uploadingImage ? (
                <ActivityIndicator color="#176b52" />
              ) : (
                <Text style={styles.imageButtonText}>Choose image</Text>
              )}
            </Pressable>
            {form.imageUrl ? (
              <Pressable
                onPress={() => setForm((current) => ({ ...current, imageUrl: '' }))}
                style={styles.removeImageButton}
              >
                <Text style={styles.removeImageText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
            placeholder="Image URL, optional"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={form.imageUrl}
          />

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchTitle}>Visible to customers</Text>
              <Text style={styles.switchCopy}>Turn off when the item is out of stock.</Text>
            </View>
            <Switch
              onValueChange={(value) => setForm((current) => ({ ...current, isAvailable: value }))}
              thumbColor={form.isAvailable ? '#176b52' : '#f4f3f4'}
              trackColor={{ false: '#d8d2ca', true: '#f4b184' }}
              value={form.isAvailable}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            disabled={saving}
            onPress={saveItem}
            style={[styles.saveButton, saving && styles.disabledAction]}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>{editingItemId ? 'Save changes' : 'Create item'}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.menuPanel}>
          <View style={styles.menuPanelHeader}>
            <View>
              <Text style={styles.panelTitle}>Menu items</Text>
              <Text style={styles.panelSubtitle}>{filteredItems.length} shown</Text>
            </View>
            <TextInput
              onChangeText={setSearch}
              placeholder="Search menu..."
              placeholderTextColor="#8b948b"
              style={[styles.searchInput, isDesktop && styles.desktopSearchInput]}
              value={search}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((category) => {
              const active = categoryFilter === category;

              return (
                <Pressable
                  key={category}
                  onPress={() => setCategoryFilter(category)}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#176b52" />
              <Text style={styles.stateText}>Loading menu...</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No menu items found</Text>
              <Text style={styles.emptyText}>Try another search or create a new item.</Text>
            </View>
          ) : (
            <View style={[styles.itemsGrid, isDesktop && styles.desktopItemsGrid]}>
              {filteredItems.map((item) => (
                <MenuAdminCard
                  busyItemId={busyItemId}
                  desktop={isDesktop}
                  item={item}
                  key={item.id}
                  onEdit={editItem}
                  onToggleAvailability={toggleAvailability}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f7f3ef',
    flexGrow: 1,
    gap: 16,
    paddingBottom: 32,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  desktopScreen: {
    paddingHorizontal: 32,
    paddingTop: 28,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  kicker: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: '#151815',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: '#5f675f',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  refreshButton: {
    backgroundColor: '#ff741f',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 136,
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statTileOrange: {
    backgroundColor: '#fff3ec',
    borderColor: '#ffd0b5',
  },
  statTileCream: {
    backgroundColor: '#f1ebe3',
    borderColor: '#e3d8ce',
  },
  statValue: {
    color: '#176b52',
    fontSize: 24,
    fontWeight: '900',
  },
  statValueOrange: {
    color: '#b14a32',
  },
  statLabel: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  workspace: {
    gap: 14,
  },
  desktopWorkspace: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  desktopFormCard: {
    flexBasis: 360,
    maxWidth: 400,
  },
  menuPanel: {
    flex: 1,
    gap: 12,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  formHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  formTitle: {
    color: '#151815',
    fontSize: 17,
    fontWeight: '900',
  },
  formSubtitle: {
    color: '#5f675f',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  clearButton: {
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  clearButtonText: {
    color: '#176b52',
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151815',
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 84,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  imagePreview: {
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    height: 154,
    width: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f4f6f3',
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 130,
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#6b736b',
    fontSize: 13,
    fontWeight: '800',
  },
  imageButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  imageButtonText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  removeImageButton: {
    alignItems: 'center',
    borderColor: '#b14a32',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  removeImageText: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '900',
  },
  switchRow: {
    alignItems: 'center',
    backgroundColor: '#f7f3ef',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  switchTitle: {
    color: '#151815',
    fontSize: 14,
    fontWeight: '900',
  },
  switchCopy: {
    color: '#6b736b',
    fontSize: 12,
    marginTop: 3,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  menuPanelHeader: {
    alignItems: 'flex-start',
    backgroundColor: '#14543b',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 16,
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: '#f8caa6',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151815',
    fontSize: 14,
    minHeight: 44,
    minWidth: 170,
    paddingHorizontal: 12,
  },
  desktopSearchInput: {
    minWidth: 260,
  },
  categoryRow: {
    gap: 8,
    paddingRight: 12,
  },
  categoryChip: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  categoryChipActive: {
    backgroundColor: '#ff741f',
    borderColor: '#ff741f',
  },
  categoryChipText: {
    color: '#4c554c',
    fontSize: 13,
    fontWeight: '900',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  itemsGrid: {
    gap: 12,
  },
  desktopItemsGrid: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    gap: 11,
    padding: 16,
  },
  desktopItemCard: {
    flexBasis: '31.8%',
    flexGrow: 1,
    minWidth: 250,
  },
  itemImage: {
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    height: 138,
    width: '100%',
  },
  itemImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f1ebe3',
    borderRadius: 8,
    height: 138,
    justifyContent: 'center',
    width: '100%',
  },
  itemImagePlaceholderText: {
    color: '#b14a32',
    fontSize: 36,
    fontWeight: '900',
  },
  itemHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  itemCopy: {
    flex: 1,
  },
  itemName: {
    color: '#151815',
    fontSize: 17,
    fontWeight: '900',
  },
  itemMeta: {
    color: '#b14a32',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  price: {
    color: '#176b52',
    fontSize: 15,
    fontWeight: '900',
  },
  description: {
    color: '#5f675f',
    fontSize: 13,
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  availabilityBadge: {
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    color: '#176b52',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  unavailableBadge: {
    backgroundColor: '#fff3ec',
    color: '#b14a32',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff741f',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  secondaryButtonText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  disabledAction: {
    opacity: 0.55,
  },
  errorText: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '800',
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
