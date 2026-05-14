import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { PublicFooter } from '../components/PublicFooter';
import { useCart } from '../context/CartContext';
import { fetchMenuItems, type MenuItem } from '../services/menu';
import { foodImageFor, HOME_HERO_IMAGE } from '../utils/foodImages';
import { money } from '../utils/money';

const HOME_CATEGORY_ORDER = ['breakfast', 'coffee', 'drinks', 'snacks', 'meals'];
const HIDDEN_HOME_CATEGORY_PARTS = ['burger', 'pastr', 'past'];
const ABOUT_BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=80';
const CATEGORY_ICONS: Record<string, string> = {
  breakfast: '🍳',
  coffee: '☕',
  drinks: '🥤',
  snacks: '🍟',
  meals: '🍽',
};

function categoryKey(category: string) {
  return category.trim().toLowerCase();
}

function showCategoryOnHome(category: string) {
  const key = categoryKey(category);
  return !HIDDEN_HOME_CATEGORY_PARTS.some((hidden) => key.includes(hidden));
}

function categoryIcon(category: string) {
  return CATEGORY_ICONS[categoryKey(category)] ?? '🍽';
}

function categoryLabel(category: string) {
  const key = categoryKey(category);
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : category;
}

function HeroFeature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.heroFeature}>
      <Text style={styles.heroFeatureIcon}>{icon}</Text>
      <Text style={styles.heroFeatureText}>{label}</Text>
    </View>
  );
}

function FeaturedMeal({
  desktop,
  item,
  onAdd,
  onOpenMenu,
}: {
  desktop?: boolean;
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  onOpenMenu: (category: string) => void;
}) {
  return (
    <View style={[styles.featuredCard, desktop && styles.desktopFeaturedCard]}>
      <Image source={{ uri: foodImageFor(item.category, item.imageUrl) }} style={styles.foodImage} />
      <View style={styles.featuredBody}>
        <View style={styles.featuredTopLine}>
          <Text style={styles.featuredName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.featuredRating}>4.8</Text>
        </View>
        <Text style={styles.featuredDescription} numberOfLines={2}>
          {item.description || 'Fresh cafe favorite prepared for quick delivery.'}
        </Text>
        <View style={styles.featuredFooter}>
          <View>
            <Text style={styles.featuredPrice}>{money(Number(item.price))}</Text>
            <Pressable onPress={() => onOpenMenu(item.category)}>
              <Text style={styles.featuredMeta}>{item.category}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onAdd(item)} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add to Cart</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function HomeScreen({
  onBrowseMenu,
  onOpenCart,
  onSearchMenu,
  onSelectCategory,
}: {
  onBrowseMenu: () => void;
  onOpenCart: () => void;
  onSearchMenu: (query: string) => void;
  onSelectCategory: (category: string) => void;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const { addItem } = useCart();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
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

    return [...uniqueCategories.values()]
      .filter(showCategoryOnHome)
      .sort((left, right) => {
        const leftIndex = HOME_CATEGORY_ORDER.indexOf(categoryKey(left));
        const rightIndex = HOME_CATEGORY_ORDER.indexOf(categoryKey(right));

        if (leftIndex === -1 && rightIndex === -1) {
          return left.localeCompare(right);
        }

        if (leftIndex === -1) {
          return 1;
        }

        if (rightIndex === -1) {
          return -1;
        }

        return leftIndex - rightIndex;
      });
  }, [items]);
  const featuredItems = useMemo(() => items.slice(0, 4), [items]);

  const loadHomeMenu = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextItems = await fetchMenuItems();
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load featured meals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomeMenu();
  }, [loadHomeMenu]);

  function submitSearch() {
    const query = search.trim();

    if (query) {
      onSearchMenu(query);
      return;
    }

    onBrowseMenu();
  }

  return (
    <ScrollView contentContainerStyle={[styles.screen, isDesktop && styles.desktopScreen]}>
      <ImageBackground
        imageStyle={styles.heroImage}
        source={{ uri: HOME_HERO_IMAGE }}
        style={[styles.hero, isDesktop && styles.desktopHero]}
      >
        <View style={styles.heroOverlay}>
          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, isDesktop && styles.desktopHeroTitle]}>Bean & Dash</Text>
            <Text style={[styles.heroAccent, isDesktop && styles.desktopHeroAccent]}>
              Fast Delivery Near You
            </Text>
            <Text style={styles.heroCopy}>
              Fresh meals, simple checkout, and live rider tracking.
            </Text>

            <View style={styles.heroSearchRow}>
              <View style={styles.heroSearchInput}>
                <Text style={styles.searchGlyph}>⌕</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setSearch}
                  onSubmitEditing={submitSearch}
                  placeholder="Search for coffee, drinks, snacks..."
                  placeholderTextColor="#c7d2cb"
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={search}
                />
              </View>
              <Pressable onPress={submitSearch} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>Search</Text>
              </Pressable>
            </View>

            <View style={styles.heroFeatureRow}>
              <HeroFeature icon="⌖" label="Live GPS Tracking" />
              <HeroFeature icon="◷" label="20-35 min delivery" />
              <HeroFeature icon="☆" label="4.8 rated" />
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={[styles.contentBand, isDesktop && styles.desktopContentBand]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Pressable onPress={onBrowseMenu}>
            <Text style={styles.textButton}>{'View all >'}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.inlineState}>
            <ActivityIndicator color="#176b52" />
            <Text style={styles.stateText}>Loading menu...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <Pressable
                key={category}
                onPress={() => onSelectCategory(category)}
                style={[styles.categoryCard, isDesktop && styles.desktopCategoryCard]}
              >
                <Text style={styles.categoryIconText}>{categoryIcon(category)}</Text>
                <Text style={styles.categoryChipText}>{categoryLabel(category)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.featuredHeader}>
          <Text style={styles.sectionTitle}>Featured Meals</Text>
          <Pressable onPress={onBrowseMenu}>
            <Text style={styles.textButton}>{'Full menu >'}</Text>
          </Pressable>
        </View>

        <View style={[styles.featuredGrid, isDesktop && styles.desktopFeaturedGrid]}>
          {featuredItems.map((item) => (
            <FeaturedMeal
              desktop={isDesktop}
              item={item}
              key={item.id}
              onAdd={addItem}
              onOpenMenu={onSelectCategory}
            />
          ))}
        </View>
      </View>

      <ImageBackground
        imageStyle={styles.aboutImage}
        source={{ uri: ABOUT_BACKGROUND_IMAGE }}
        style={[styles.aboutBand, { width }]}
      >
        <View style={styles.aboutOverlay}>
          <View style={[styles.aboutInner, isDesktop && styles.desktopAboutInner]}>
            <View style={styles.aboutCopy}>
              <Text style={styles.aboutKicker}>Know About Us</Text>
              <Text style={[styles.aboutTitle, isDesktop && styles.desktopAboutTitle]}>
                Fresh cafe meals, delivered with care.
              </Text>
              <Text style={styles.aboutText}>
                Bean & Dash is built for customers who want fresh breakfast, coffee, drinks,
                snacks, and full meals without waiting in long lines. Orders are prepared at our
                Juja cafe, packed neatly, and tracked from the kitchen to your delivery point.
              </Text>
              <Text style={styles.aboutText}>
                Staff can accept your order, assign an available rider, and update each stage so
                you know when your meal is being prepared, picked up, and delivered.
              </Text>
              <Pressable onPress={onBrowseMenu} style={styles.aboutButton}>
                <Text style={styles.aboutButtonText}>Explore menu</Text>
              </Pressable>
            </View>

            <View style={styles.aboutDetails}>
              <View style={styles.aboutStats}>
                <View style={styles.aboutStatCard}>
                  <Text style={styles.aboutStatValue}>20-35</Text>
                  <Text style={styles.aboutStatLabel}>minute delivery</Text>
                </View>
                <View style={styles.aboutStatCard}>
                  <Text style={styles.aboutStatValue}>Live</Text>
                  <Text style={styles.aboutStatLabel}>GPS tracking</Text>
                </View>
                <View style={styles.aboutStatCard}>
                  <Text style={styles.aboutStatValue}>Juja</Text>
                  <Text style={styles.aboutStatLabel}>local cafe</Text>
                </View>
              </View>

              <View style={styles.aboutProcessCard}>
                <Text style={styles.aboutProcessTitle}>How it works</Text>
                <View style={styles.aboutStep}>
                  <Text style={styles.aboutStepNumber}>01</Text>
                  <Text style={styles.aboutStepText}>Choose your meal and checkout.</Text>
                </View>
                <View style={styles.aboutStep}>
                  <Text style={styles.aboutStepNumber}>02</Text>
                  <Text style={styles.aboutStepText}>Staff accepts and prepares the order.</Text>
                </View>
                <View style={styles.aboutStep}>
                  <Text style={styles.aboutStepNumber}>03</Text>
                  <Text style={styles.aboutStepText}>A rider collects it and shares live tracking.</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>

      <PublicFooter onBrowseMenu={onBrowseMenu} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#fbfaf8',
    flexGrow: 1,
    paddingBottom: 36,
  },
  desktopScreen: {
    paddingBottom: 48,
  },
  searchInput: {
    color: '#c7d2cb',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 44,
    padding: 0,
  },
  hero: {
    minHeight: 430,
    overflow: 'hidden',
  },
  desktopHero: {
    minHeight: 430,
  },
  heroImage: {
    borderRadius: 0,
  },
  heroOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 70, 45, 0.84)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 48,
  },
  heroContent: {
    alignItems: 'center',
    maxWidth: 760,
    width: '100%',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
    textAlign: 'center',
  },
  desktopHeroTitle: {
    fontSize: 56,
    lineHeight: 62,
  },
  heroAccent: {
    color: '#ff741f',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    marginTop: 4,
    textAlign: 'center',
  },
  desktopHeroAccent: {
    fontSize: 50,
    lineHeight: 56,
  },
  heroCopy: {
    color: '#f2f5f0',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 20,
    maxWidth: 680,
    textAlign: 'center',
  },
  heroSearchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
    maxWidth: 560,
    width: '100%',
  },
  heroSearchInput: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchGlyph: {
    color: '#8fa99b',
    fontSize: 18,
    fontWeight: '900',
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#ff741f',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 20,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  heroFeatureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 22,
    justifyContent: 'center',
    marginTop: 28,
  },
  heroFeature: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  heroFeatureIcon: {
    color: '#ff741f',
    fontSize: 15,
    fontWeight: '900',
  },
  heroFeatureText: {
    color: '#f2f5f0',
    fontSize: 13,
    fontWeight: '800',
  },
  contentBand: {
    alignSelf: 'center',
    gap: 22,
    paddingHorizontal: 18,
    paddingTop: 40,
    width: '100%',
  },
  desktopContentBand: {
    maxWidth: 960,
    paddingTop: 44,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#151815',
    fontSize: 22,
    fontWeight: '900',
  },
  textButton: {
    color: '#ff741f',
    fontSize: 13,
    fontWeight: '900',
  },
  inlineState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stateText: {
    color: '#4c554c',
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '46%',
    flexGrow: 0,
    gap: 8,
    justifyContent: 'center',
    minHeight: 78,
    padding: 12,
  },
  desktopCategoryCard: {
    flexBasis: 'auto',
    minHeight: 78,
    width: 86,
  },
  categoryIconText: {
    fontSize: 22,
  },
  categoryChipText: {
    color: '#08110d',
    fontSize: 13,
    fontWeight: '900',
  },
  featuredHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 26,
  },
  featuredGrid: {
    gap: 14,
  },
  desktopFeaturedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featuredCard: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  desktopFeaturedCard: {
    flexBasis: '31%',
    flexGrow: 1,
  },
  foodImage: {
    height: 190,
    width: '100%',
  },
  featuredBody: {
    gap: 8,
    padding: 12,
  },
  featuredTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  featuredName: {
    color: '#151815',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  featuredRating: {
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    color: '#176b52',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  featuredDescription: {
    color: '#5f675f',
    fontSize: 13,
    lineHeight: 19,
  },
  featuredFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featuredMeta: {
    color: '#176b52',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  featuredPrice: {
    color: '#a34f16',
    fontSize: 16,
    fontWeight: '900',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#075f46',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  aboutBand: {
    alignSelf: 'stretch',
    marginTop: 42,
    minHeight: 430,
  },
  aboutImage: {
    borderRadius: 0,
  },
  aboutOverlay: {
    backgroundColor: 'rgba(7, 52, 37, 0.78)',
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 46,
  },
  aboutInner: {
    alignSelf: 'center',
    gap: 18,
    maxWidth: 1100,
    width: '100%',
  },
  desktopAboutInner: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aboutCopy: {
    flex: 1,
    gap: 12,
  },
  aboutKicker: {
    color: '#ffb37e',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  aboutTitle: {
    color: '#ffffff',
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 38,
  },
  desktopAboutTitle: {
    fontSize: 44,
    lineHeight: 52,
  },
  aboutText: {
    color: '#edf5ef',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    maxWidth: 620,
  },
  aboutButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ff741f',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  aboutButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  aboutDetails: {
    flex: 1,
    gap: 12,
  },
  aboutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  aboutStatCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 112,
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  aboutStatValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  aboutStatLabel: {
    color: '#d8e7dd',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  aboutProcessCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 15,
  },
  aboutProcessTitle: {
    color: '#075f46',
    fontSize: 18,
    fontWeight: '900',
  },
  aboutStep: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  aboutStepNumber: {
    backgroundColor: '#fff3ec',
    borderRadius: 8,
    color: '#b14a32',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  aboutStepText: {
    color: '#263129',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
});
