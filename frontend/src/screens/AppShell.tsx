import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CartProvider, useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { loadActiveTab, saveActiveTab } from '../storage/navigationStorage';
import { AnalyticsDashboardScreen } from './AnalyticsDashboardScreen';
import { AuthScreen } from './AuthScreen';
import { CartScreen } from './CartScreen';
import { CheckoutScreen } from './CheckoutScreen';
import { HomeScreen } from './HomeScreen';
import { MenuManagementScreen } from './MenuManagementScreen';
import { MenuScreen } from './MenuScreen';
import { OrdersScreen } from './OrdersScreen';
import { ProfileScreen } from './ProfileScreen';
import { RiderDashboardScreen } from './RiderDashboardScreen';
import { RiderEarningsScreen } from './RiderEarningsScreen';
import { RiderManagementScreen } from './RiderManagementScreen';
import { StaffManagementScreen } from './StaffManagementScreen';
import { StaffOrdersScreen } from './StaffOrdersScreen';

type AppTab =
  | 'auth'
  | 'home'
  | 'menu'
  | 'cart'
  | 'checkout'
  | 'orders'
  | 'staff'
  | 'staffUsers'
  | 'rider'
  | 'riders'
  | 'manage'
  | 'analytics'
  | 'profile'
  | 'earnings';

type NavItem = {
  icon: string;
  label: string;
  tab: AppTab;
};

const GUEST_TABS: AppTab[] = ['home', 'menu', 'auth'];
const CUSTOMER_TABS: AppTab[] = ['home', 'menu', 'orders', 'profile', 'cart', 'checkout'];
const STAFF_TABS: AppTab[] = ['staff', 'manage', 'analytics', 'profile'];
const ADMIN_TABS: AppTab[] = ['manage', 'riders', 'staffUsers', 'analytics', 'profile'];
const RIDER_TABS: AppTab[] = ['rider', 'earnings'];

function tabsForRole(role?: string): AppTab[] {
  if (role === 'admin') {
    return ADMIN_TABS;
  }

  if (role === 'staff') {
    return STAFF_TABS;
  }

  if (role === 'rider') {
    return RIDER_TABS;
  }

  return CUSTOMER_TABS;
}

function Navigation({
  activeTab,
  isDesktop,
  items,
  onSelect,
  variant = 'default',
}: {
  activeTab: string;
  isDesktop: boolean;
  items: NavItem[];
  onSelect: (item: NavItem) => void;
  variant?: 'default' | 'rider';
}) {
  return (
    <View style={[isDesktop ? styles.sideNav : styles.bottomNav, variant === 'rider' && styles.riderBottomNav]}>
      {items.map((item) => {
        const active = activeTab === item.tab;

        return (
          <Pressable
            key={item.tab}
            onPress={() => onSelect(item)}
            style={[
              styles.navItem,
              variant === 'rider' && !isDesktop && styles.riderNavItem,
              variant === 'rider' && !isDesktop && active && styles.riderNavItemActive,
              isDesktop && styles.sideNavItem,
              isDesktop && active && styles.sideNavItemActive,
            ]}
          >
            {!isDesktop ? (
              <View
                style={[
                  styles.navIcon,
                  active && styles.navIconActive,
                  variant === 'rider' && styles.riderNavIcon,
                  variant === 'rider' && active && styles.riderNavIconActive,
                ]}
              >
                <Text
                  style={[
                    styles.navIconText,
                    active && styles.navIconTextActive,
                    variant === 'rider' && styles.riderNavIconText,
                    variant === 'rider' && active && styles.riderNavIconTextActive,
                  ]}
                >
                  {item.icon}
                </Text>
              </View>
            ) : null}
            <Text
              style={[
                styles.navLabel,
                isDesktop && styles.sideNavLabel,
                active && styles.navLabelActive,
                variant === 'rider' && styles.riderNavLabel,
                variant === 'rider' && active && styles.riderNavLabelActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CartIcon({ color = '#075f46', count }: { color?: string; count: number }) {
  return (
    <View style={styles.cartIcon}>
      <View style={[styles.cartHandle, { backgroundColor: color }]} />
      <View style={[styles.cartBasket, { borderColor: color }]} />
      <View style={styles.cartWheels}>
        <View style={[styles.cartWheel, { backgroundColor: color }]} />
        <View style={[styles.cartWheel, { backgroundColor: color }]} />
      </View>
      {count > 0 ? (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function AccountBrand({
  action,
  brandLabel = 'Bean & Dash',
  desktop,
  initial,
  subtitle,
  variant = 'default',
}: {
  action?: ReactNode;
  brandLabel?: string;
  desktop: boolean;
  initial: string;
  subtitle: string;
  variant?: 'default' | 'rider';
}) {
  if (desktop) {
    return (
      <View style={styles.desktopAccountBar}>
        <View style={styles.desktopBrandRow}>
          <View style={[styles.avatar, variant === 'rider' && styles.riderAvatar]}>
            <Text style={[styles.avatarText, variant === 'rider' && styles.riderAvatarText]}>{initial}</Text>
          </View>
          <View style={styles.accountTextBlock}>
            <Text style={[styles.brand, variant === 'rider' && styles.riderBrand]} numberOfLines={1}>
              {brandLabel}
            </Text>
            <Text style={[styles.role, variant === 'rider' && styles.riderRole]}>{subtitle}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.accountBar, variant === 'rider' && styles.riderAccountBar]}>
      <View style={[styles.avatar, variant === 'rider' && styles.riderAvatar]}>
        <Text style={[styles.avatarText, variant === 'rider' && styles.riderAvatarText]}>{initial}</Text>
      </View>
      <View style={styles.accountTextBlock}>
        <Text style={[styles.brand, variant === 'rider' && styles.riderBrand]} numberOfLines={1}>
          {brandLabel}
        </Text>
        <Text style={[styles.role, variant === 'rider' && styles.riderRole]}>{subtitle}</Text>
      </View>
      {action}
    </View>
  );
}

function GuestShell() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 760;
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'auth'>('home');
  const [previousTab, setPreviousTab] = useState<'home' | 'menu'>('home');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [menuCategory, setMenuCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const { itemCount } = useCart();
  const allowedTabs = GUEST_TABS;
  const navItems: NavItem[] = [
    { icon: 'H', label: 'Home', tab: 'home' },
    { icon: 'M', label: 'Menu', tab: 'menu' },
  ];

  useEffect(() => {
    let mounted = true;

    loadActiveTab('guest').then((savedTab) => {
      if (mounted && allowedTabs.includes(savedTab as AppTab)) {
        setActiveTab(savedTab as 'home' | 'menu' | 'auth');
      }
    });

    return () => {
      mounted = false;
    };
  }, [allowedTabs]);

  useEffect(() => {
    void saveActiveTab('guest', activeTab);
  }, [activeTab]);

  function selectGuestTab(item: NavItem) {
    if (item.tab === 'menu') {
      setMenuCategory('All');
      setMenuSearch('');
    }
    setActiveTab(item.tab as 'home' | 'menu' | 'auth');
  }

  function openAuth(mode: 'login' | 'register' = 'login') {
    setAuthMode(mode);

    if (activeTab !== 'auth') {
      setPreviousTab(activeTab);
    }

    setActiveTab('auth');
  }

  const accountAction = (
    <View style={styles.guestHeaderActions}>
      <Pressable
        onPress={() => openAuth('login')}
        style={styles.signInButton}
      >
        <Text style={styles.signInText}>Sign In</Text>
      </Pressable>
      <Pressable
        onPress={() => openAuth('register')}
        style={styles.registerButton}
      >
        <Text style={styles.registerText}>Register</Text>
      </Pressable>
      <Pressable onPress={() => openAuth('login')} style={styles.guestCartCircle}>
        <CartIcon color="#ffffff" count={itemCount} />
      </Pressable>
    </View>
  );

  const content = (
    <View style={[styles.content, isDesktop && styles.desktopContent]}>
      {activeTab === 'home' ? (
        <HomeScreen
          onBrowseMenu={() => {
            setMenuCategory('All');
            setMenuSearch('');
            setActiveTab('menu');
          }}
          onOpenCart={() => openAuth('login')}
          onSearchMenu={(query) => {
            setMenuCategory('All');
            setMenuSearch(query);
            setActiveTab('menu');
          }}
          onSelectCategory={(category) => {
            setMenuCategory(category);
            setMenuSearch('');
            setActiveTab('menu');
          }}
        />
      ) : null}
      {activeTab === 'menu' ? (
        <MenuScreen initialCategory={menuCategory} initialSearch={menuSearch} />
      ) : null}
      {activeTab === 'auth' ? (
        <AuthScreen initialMode={authMode} onBack={() => setActiveTab(previousTab)} />
      ) : null}
    </View>
  );

  return (
    <View style={styles.shell}>
      {isDesktop ? (
        <View style={styles.desktopBody}>
          <View style={styles.desktopNavBar}>
            <AccountBrand action={accountAction} desktop={isDesktop} initial="C" subtitle="Fast delivery near you" />
            <Navigation
              activeTab={activeTab}
              isDesktop={isDesktop}
              items={navItems}
              onSelect={selectGuestTab}
            />
            {accountAction ? <View style={styles.desktopAccountActions}>{accountAction}</View> : null}
          </View>
          {content}
        </View>
      ) : (
        <>
          <AccountBrand action={accountAction} desktop={isDesktop} initial="C" subtitle="Fast delivery near you" />
          <View style={styles.mobileBody}>{content}</View>
          <Navigation
            activeTab={activeTab}
            isDesktop={isDesktop}
            items={navItems}
            onSelect={selectGuestTab}
          />
        </>
      )}
    </View>
  );
}

function AuthenticatedShell() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 760;
  const { session, signOut } = useAuth();
  const { itemCount } = useCart();
  const isAdminUser = session?.user.role === 'admin';
  const isStaffUser = session?.user.role === 'staff';
  const isRiderUser = session?.user.role === 'rider';
  const initialTab = isAdminUser ? 'manage' : isStaffUser ? 'staff' : isRiderUser ? 'rider' : 'home';
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [previousTab, setPreviousTab] = useState<AppTab>(initialTab);
  const [menuCategory, setMenuCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const allowedTabs = useMemo(() => tabsForRole(session?.user.role), [session?.user.role]);
  const tabStorageScope = session ? `user-${session.user.id}-${session.user.role}` : null;

  useEffect(() => {
    if (!tabStorageScope) {
      return undefined;
    }

    let mounted = true;

    loadActiveTab(tabStorageScope).then((savedTab) => {
      if (mounted && allowedTabs.includes(savedTab as AppTab)) {
        // Restore the same page after refresh.
        setActiveTab(savedTab as AppTab);
        setPreviousTab(savedTab as AppTab);
      }
    });

    return () => {
      mounted = false;
    };
  }, [allowedTabs, tabStorageScope]);

  useEffect(() => {
    if (tabStorageScope && allowedTabs.includes(activeTab)) {
      // Save current page for the next reload.
      void saveActiveTab(tabStorageScope, activeTab);
    }
  }, [activeTab, allowedTabs, tabStorageScope]);

  if (!session) {
    return null;
  }

  const customerNav: NavItem[] = [
    { icon: 'H', label: 'Home', tab: 'home' },
    { icon: 'M', label: 'Menu', tab: 'menu' },
    { icon: 'O', label: 'Orders', tab: 'orders' },
    { icon: 'P', label: 'Profile', tab: 'profile' },
  ];
  const staffNav: NavItem[] = [
    { icon: 'O', label: 'Orders', tab: 'staff' },
    { icon: 'M', label: 'Menu', tab: 'manage' },
    { icon: 'A', label: 'Stats', tab: 'analytics' },
    { icon: 'P', label: 'Profile', tab: 'profile' },
  ];
  const adminNav: NavItem[] = [
    { icon: 'M', label: 'Menu', tab: 'manage' },
    { icon: 'R', label: 'Riders', tab: 'riders' },
    { icon: 'S', label: 'Staff', tab: 'staffUsers' },
    { icon: 'A', label: 'Analytics', tab: 'analytics' },
    { icon: 'P', label: 'Profile', tab: 'profile' },
  ];
  const riderNav: NavItem[] = [
    { icon: 'D', label: 'Dashboard', tab: 'rider' },
    { icon: 'KES', label: 'Earnings', tab: 'earnings' },
  ];
  // Show navigation based on the logged-in user role.
  const navItems = isAdminUser ? adminNav : isRiderUser ? riderNav : isStaffUser ? staffNav : customerNav;

  function selectTab(item: NavItem) {
    if (item.tab === 'menu') {
      setMenuCategory('All');
      setMenuSearch('');
    }
    if (item.tab !== activeTab) {
      setPreviousTab(activeTab);
    }
    setActiveTab(item.tab);
  }

  function navigateTo(tab: AppTab) {
    if (tab !== activeTab) {
      setPreviousTab(activeTab);
    }
    setActiveTab(tab);
  }

  function cartBackTab() {
    if (previousTab === 'cart' || previousTab === 'checkout') {
      return 'home';
    }

    return previousTab;
  }

  const accountAction =
    session.user.role === 'customer' ? (
      <View style={styles.headerActions}>
        <Pressable
          onPress={() => navigateTo('cart')}
          style={styles.headerIconButton}
        >
          <CartIcon count={itemCount} />
        </Pressable>
      </View>
    ) : null;
  const riderAccountAction = (
    <Pressable onPress={signOut} style={styles.riderLogoutButton}>
      <Text style={styles.riderLogoutText}>Logout</Text>
    </Pressable>
  );

  const content = (
    <View style={[styles.content, isDesktop && styles.desktopContent]}>
      {activeTab === 'home' ? (
        <HomeScreen
          onBrowseMenu={() => {
            setMenuCategory('All');
            setMenuSearch('');
            navigateTo('menu');
          }}
          onOpenCart={() => navigateTo('cart')}
          onSearchMenu={(query) => {
            setMenuCategory('All');
            setMenuSearch(query);
            navigateTo('menu');
          }}
          onSelectCategory={(category) => {
            setMenuCategory(category);
            setMenuSearch('');
            navigateTo('menu');
          }}
        />
      ) : null}
      {activeTab === 'menu' ? (
        <MenuScreen initialCategory={menuCategory} initialSearch={menuSearch} />
      ) : null}
      {activeTab === 'cart' ? (
        <CartScreen onBack={() => setActiveTab(cartBackTab())} onCheckout={() => navigateTo('checkout')} />
      ) : null}
      {activeTab === 'checkout' ? (
        <CheckoutScreen
          onBackToCart={() => setActiveTab('cart')}
          onViewOrders={() => setActiveTab(isStaffUser ? 'staff' : 'orders')}
        />
      ) : null}
      {activeTab === 'orders' ? <OrdersScreen /> : null}
      {activeTab === 'staff' ? <StaffOrdersScreen /> : null}
      {activeTab === 'manage' ? <MenuManagementScreen /> : null}
      {activeTab === 'riders' ? <RiderManagementScreen /> : null}
      {activeTab === 'staffUsers' ? <StaffManagementScreen /> : null}
      {activeTab === 'analytics' ? <AnalyticsDashboardScreen /> : null}
      {activeTab === 'rider' ? <RiderDashboardScreen /> : null}
      {activeTab === 'earnings' ? <RiderEarningsScreen /> : null}
      {activeTab === 'profile' ? <ProfileScreen /> : null}
    </View>
  );

  if (isRiderUser) {
    return (
      <View style={styles.shell}>
        <AccountBrand
          action={riderAccountAction}
          brandLabel={session.user.name}
          desktop={false}
          initial={session.user.name.charAt(0).toUpperCase()}
          subtitle="Rider"
          variant="rider"
        />
        <View style={styles.mobileBody}>{content}</View>
        <Navigation
          activeTab={activeTab}
          isDesktop={false}
          items={navItems}
          onSelect={selectTab}
          variant="rider"
        />
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      {isDesktop ? (
        <View style={styles.desktopBody}>
          <View style={styles.desktopNavBar}>
            <AccountBrand
              action={accountAction}
              desktop={isDesktop}
              initial={session.user.name.charAt(0).toUpperCase()}
              subtitle={`${session.user.name} / ${session.user.role}`}
            />
            <Navigation
              activeTab={activeTab}
              isDesktop={isDesktop}
              items={navItems}
              onSelect={selectTab}
            />
            {accountAction ? <View style={styles.desktopAccountActions}>{accountAction}</View> : null}
          </View>
          {content}
        </View>
      ) : (
        <>
          <AccountBrand
            action={accountAction}
            desktop={isDesktop}
            initial={session.user.name.charAt(0).toUpperCase()}
            subtitle={`${session.user.name} / ${session.user.role}`}
          />
          <View style={styles.mobileBody}>{content}</View>
          <Navigation
            activeTab={activeTab}
            isDesktop={isDesktop}
            items={navItems}
            onSelect={selectTab}
          />
        </>
      )}
    </View>
  );
}

export function AppShell() {
  const { initializing, session } = useAuth();

  if (initializing) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color="#176b52" />
      </View>
    );
  }

  if (!session) {
    return (
      <CartProvider>
        <GuestShell />
      </CartProvider>
    );
  }

  return (
    <CartProvider>
      <AuthenticatedShell />
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#f4f6f3',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  accountBar: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#edf0ec',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  riderAccountBar: {
    backgroundColor: '#14543b',
    borderBottomColor: '#14543b',
    minHeight: 58,
    paddingHorizontal: 8,
  },
  desktopNavBar: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#d7ded6',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 20,
    minHeight: 76,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  desktopAccountBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    flexShrink: 0,
    minWidth: 260,
  },
  desktopBrandRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  desktopAccountActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  riderAvatar: {
    backgroundColor: '#5f7b6d',
    borderRadius: 15,
    height: 30,
    marginRight: 10,
    width: 30,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  riderAvatarText: {
    fontSize: 13,
  },
  accountTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  brand: {
    color: '#a34f16',
    fontSize: 21,
    fontWeight: '900',
  },
  riderBrand: {
    color: '#ffffff',
    fontSize: 14,
  },
  role: {
    color: '#176b52',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  riderRole: {
    color: '#ffffff',
    fontSize: 11,
    opacity: 0.94,
  },
  riderLogoutButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 13,
  },
  riderLogoutText: {
    color: '#14543b',
    fontSize: 12,
    fontWeight: '900',
  },
  headerCartButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  headerCartButtonActive: {
    backgroundColor: '#176b52',
  },
  headerCartText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
  headerCartTextActive: {
    color: '#ffffff',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  guestHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 8,
  },
  signInText: {
    color: '#151815',
    fontSize: 13,
    fontWeight: '800',
  },
  registerButton: {
    alignItems: 'center',
    backgroundColor: '#ff741f',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  registerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  guestCartCircle: {
    alignItems: 'center',
    backgroundColor: '#075f46',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerIconButton: {
    alignItems: 'center',
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 38,
    paddingHorizontal: 8,
  },
  cartIcon: {
    height: 22,
    position: 'relative',
    width: 24,
  },
  cartHandle: {
    backgroundColor: '#075f46',
    borderRadius: 2,
    height: 3,
    left: 2,
    position: 'absolute',
    top: 4,
    transform: [{ rotate: '22deg' }],
    width: 8,
  },
  cartBasket: {
    borderColor: '#075f46',
    borderRadius: 3,
    borderWidth: 2,
    height: 10,
    left: 6,
    position: 'absolute',
    top: 7,
    width: 15,
  },
  cartWheels: {
    flexDirection: 'row',
    gap: 8,
    left: 8,
    position: 'absolute',
    top: 18,
  },
  cartWheel: {
    backgroundColor: '#075f46',
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  cartBadge: {
    alignItems: 'center',
    backgroundColor: '#ff7a1a',
    borderRadius: 8,
    minWidth: 15,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -7,
    top: -6,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  content: {
    flex: 1,
  },
  mobileBody: {
    flex: 1,
  },
  desktopBody: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
  },
  desktopContent: {
    minWidth: 0,
  },
  sideNav: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    minWidth: 0,
  },
  bottomNav: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopColor: '#d7ded6',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 8,
  },
  riderBottomNav: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e6ddd4',
    flexShrink: 0,
    gap: 10,
    justifyContent: 'center',
    minHeight: 78,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    zIndex: 10,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  riderNavItem: {
    backgroundColor: '#f7f3ef',
    borderColor: '#e6ddd4',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  riderNavItemActive: {
    backgroundColor: '#14543b',
    borderColor: '#14543b',
  },
  sideNavItem: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 0,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: 16,
  },
  sideNavItemActive: {
    backgroundColor: '#e8f0ec',
  },
  sideNavLabel: {
    flex: 0,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  navIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 30,
    justifyContent: 'center',
    width: 38,
  },
  navIconActive: {
    backgroundColor: '#075f46',
  },
  riderNavIcon: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e7df',
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    width: 42,
  },
  riderNavIconActive: {
    backgroundColor: '#ff741f',
    borderColor: '#ff741f',
  },
  navIconText: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '900',
  },
  riderNavIconText: {
    color: '#14543b',
    fontSize: 12,
    fontWeight: '900',
  },
  navIconTextActive: {
    color: '#ffffff',
  },
  riderNavIconTextActive: {
    color: '#ffffff',
  },
  navLabel: {
    color: '#5f675f',
    fontSize: 11,
    fontWeight: '800',
  },
  navLabelActive: {
    color: '#075f46',
  },
  riderNavLabel: {
    color: '#14543b',
    fontSize: 14,
    fontWeight: '900',
  },
  riderNavLabelActive: {
    color: '#ffffff',
  },
});
