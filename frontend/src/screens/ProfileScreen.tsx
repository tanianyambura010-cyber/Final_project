import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { useAuth } from '../context/AuthContext';

function SettingRow({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress?: () => void;
  value?: string;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      {value ? <Text style={styles.settingValue}>{value}</Text> : <Text style={styles.chevron}>{'>'}</Text>}
    </Pressable>
  );
}

function SupportCategory({
  accent,
  description,
  icon,
  title,
}: {
  accent: 'orange' | 'green';
  description: string;
  icon: string;
  title: string;
}) {
  return (
    <View style={[styles.supportCard, accent === 'orange' ? styles.supportCardOrange : styles.supportCardGreen]}>
      <View style={[styles.supportIcon, accent === 'orange' ? styles.supportIconOrange : styles.supportIconGreen]}>
        <Text style={[styles.supportIconText, accent === 'orange' ? styles.supportIconTextOrange : styles.supportIconTextGreen]}>
          {icon}
        </Text>
      </View>
      <Text style={styles.supportCardTitle}>{title}</Text>
      <Text style={styles.supportCardDescription}>{description}</Text>
    </View>
  );
}

function HelpSupportScreen({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.supportScreen}>
      <View style={styles.supportHeader}>
        <BackButton onPress={onBack} />
        <View style={styles.supportBrand}>
          <Text style={styles.supportBrandText}>Bean & Dash</Text>
        </View>
        <View style={styles.supportHeaderSpacer} />
      </View>

      <View style={styles.supportHero}>
        <Text style={styles.supportTitle}>How can we help you?</Text>
        <Text style={styles.supportSubtitle}>
          Find answers to your questions about orders, payments, and delivery, or reach out to our dedicated support team.
        </Text>
      </View>

      <View style={styles.supportSearch}>
        <Text style={styles.supportSearchIcon}>S</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setSearch}
          placeholder="Search for help topics..."
          placeholderTextColor="#9ba49b"
          style={styles.supportSearchInput}
          value={search}
        />
      </View>

      <Text style={styles.popularTitle}>Popular Categories</Text>

      <View style={styles.supportCardList}>
        <SupportCategory
          accent="orange"
          description="Track your live orders or view history."
          icon="O"
          title="Order Status"
        />
        <SupportCategory
          accent="green"
          description="Refunds, demo payments, and checkout questions."
          icon="P"
          title="Payments"
        />
        <SupportCategory
          accent="green"
          description="Delivery times, fees, and rider information."
          icon="D"
          title="Delivery"
        />
      </View>

      <View style={styles.needHelpCard}>
        <Text style={styles.needHelpTitle}>Still need help?</Text>
        <Text style={styles.needHelpText}>
          Our support team is available 24/7 to ensure your Bean & Dash experience is smooth.
        </Text>
        <View style={styles.supportActions}>
          <Pressable style={styles.liveChatButton}>
            <Text style={styles.liveChatText}>Live Chat</Text>
          </Pressable>
          <Pressable style={styles.callButton}>
            <Text style={styles.callText}>Call Us</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

export function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  if (!session) {
    return null;
  }

  const initial = session.user.name.trim().charAt(0).toUpperCase() || 'U';

  if (showSupport) {
    return <HelpSupportScreen onBack={() => setShowSupport(false)} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.name}>{session.user.name}</Text>
          <Text style={styles.role}>{session.user.role} account</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <SettingRow label="Email" value={session.user.email} />
        <SettingRow label="Phone" value={session.user.phone} />
        <SettingRow label="Notification Settings" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Switch
            onValueChange={setDarkMode}
            thumbColor={darkMode ? '#176b52' : '#f4f3f4'}
            value={darkMode}
          />
        </View>
        <SettingRow label="Help & Support" onPress={() => setShowSupport(true)} />
      </View>

      <Pressable onPress={signOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.version}>Bean & Dash v2.4.12</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    gap: 14,
    paddingBottom: 26,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#176b52',
    borderColor: '#ff7a1a',
    borderRadius: 35,
    borderWidth: 3,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
  },
  name: {
    color: '#151815',
    fontSize: 23,
    fontWeight: '900',
  },
  role: {
    color: '#a34f16',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: '#5f675f',
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  settingRow: {
    alignItems: 'center',
    borderBottomColor: '#edf0ec',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  settingLabel: {
    color: '#3d453d',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  settingValue: {
    color: '#6b736b',
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  chevron: {
    color: '#9ca39c',
    fontSize: 24,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: '#fff3ec',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutText: {
    color: '#b14a32',
    fontSize: 15,
    fontWeight: '900',
  },
  version: {
    color: '#a2aaa2',
    fontSize: 11,
    textAlign: 'center',
  },
  supportScreen: {
    backgroundColor: '#f7f8f6',
    flexGrow: 1,
    gap: 16,
    paddingBottom: 26,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  supportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  backText: {
    color: '#3d453d',
    fontSize: 24,
    fontWeight: '900',
  },
  supportBrand: {
    alignItems: 'center',
    flex: 1,
  },
  supportHeaderSpacer: {
    width: 42,
  },
  supportBrandText: {
    color: '#a34f16',
    fontSize: 18,
    fontWeight: '900',
  },
  supportHero: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  supportTitle: {
    color: '#176b52',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 30,
    maxWidth: 280,
    textAlign: 'center',
  },
  supportSubtitle: {
    color: '#5f675f',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  supportSearch: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  supportSearchIcon: {
    color: '#9ba49b',
    fontSize: 12,
    fontWeight: '900',
  },
  supportSearchInput: {
    color: '#151815',
    flex: 1,
    fontSize: 13,
    minHeight: 42,
  },
  popularTitle: {
    color: '#176b52',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  supportCardList: {
    gap: 14,
  },
  supportCard: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 16,
  },
  supportCardOrange: {
    borderBottomColor: '#ff741f',
    borderBottomWidth: 3,
  },
  supportCardGreen: {
    borderBottomColor: '#176b52',
    borderBottomWidth: 3,
  },
  supportIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  supportIconOrange: {
    backgroundColor: '#fff3ec',
  },
  supportIconGreen: {
    backgroundColor: '#e8f0ec',
  },
  supportIconText: {
    fontSize: 13,
    fontWeight: '900',
  },
  supportIconTextOrange: {
    color: '#ff741f',
  },
  supportIconTextGreen: {
    color: '#176b52',
  },
  supportCardTitle: {
    color: '#151815',
    fontSize: 15,
    fontWeight: '900',
  },
  supportCardDescription: {
    color: '#5f675f',
    fontSize: 12,
    lineHeight: 18,
  },
  needHelpCard: {
    backgroundColor: '#176b52',
    borderRadius: 8,
    gap: 12,
    marginTop: 4,
    padding: 18,
  },
  needHelpTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
  },
  needHelpText: {
    color: '#d9e7df',
    fontSize: 13,
    lineHeight: 19,
  },
  supportActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  liveChatButton: {
    alignItems: 'center',
    backgroundColor: '#ff741f',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  liveChatText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  callButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  callText: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '900',
  },
});
