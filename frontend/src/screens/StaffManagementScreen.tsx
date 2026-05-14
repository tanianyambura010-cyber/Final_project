import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { createUserAccount, fetchUsers, type ManagedUser } from '../services/users';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StaffCard({ user }: { user: ManagedUser }) {
  return (
    <View style={styles.staffCard}>
      <View style={styles.staffHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.staffCopy}>
          <Text style={styles.staffName}>{user.name}</Text>
          <Text style={styles.staffMeta}>{user.email}</Text>
        </View>
        <Text style={[styles.statusBadge, !user.isActive && styles.inactiveBadge]}>
          {user.isActive ? 'Active' : 'Inactive'}
        </Text>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>Staff</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user.phone}</Text>
        </View>
      </View>
    </View>
  );
}

export function StaffManagementScreen() {
  const { session } = useAuth();
  const [staff, setStaff] = useState<ManagedUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const summary = useMemo(() => {
    const active = staff.filter((user) => user.isActive).length;
    const inactive = staff.filter((user) => !user.isActive).length;

    return { active, inactive, total: staff.length };
  }, [staff]);

  const loadStaff = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setStaff(await fetchUsers(session.token, 'staff'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load staff');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function addStaff() {
    if (!session?.token || saving) {
      return;
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      role: 'staff' as const,
    };

    if (
      !payload.name ||
      !payload.email ||
      !payload.phone ||
      !payload.password ||
      payload.password.length < 8
    ) {
      setError('Enter staff name, email, phone, and password.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createUserAccount(session.token, payload);
      setSuccess(`${payload.name} can now log in as Staff using ${payload.email}.`);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setShowForm(false);
      await loadStaff();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add staff');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Admin</Text>
          <Text style={styles.title}>Staff Management</Text>
        </View>
        <Pressable onPress={loadStaff} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <StatCard label="Active Staff" value={String(summary.active)} />
        <StatCard label="Inactive" value={String(summary.inactive)} />
        <StatCard label="Total Staff" value={String(summary.total)} />
      </View>

      <Pressable onPress={() => setShowForm((value) => !value)} style={styles.addButton}>
        <Text style={styles.addButtonText}>{showForm ? 'Close form' : '+ Add New Staff'}</Text>
      </Pressable>

      {showForm ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create staff account</Text>
          <Text style={styles.helperText}>The staff member will use these credentials with the Staff login role.</Text>
          <TextInput
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={name}
          />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={email}
          />
          <TextInput
            keyboardType="phone-pad"
            onChangeText={setPhone}
            placeholder="Phone"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={phone}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Temporary password"
            placeholderTextColor="#8b948b"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Pressable disabled={saving} onPress={addStaff} style={[styles.saveButton, saving && styles.disabledAction]}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>Save staff</Text>}
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#176b52" />
          <Text style={styles.stateText}>Loading staff...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={staff}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <StaffCard user={item} />}
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
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  kicker: {
    color: '#176b52',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#151815',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: '#075f46',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  statValue: {
    color: '#a34f16',
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: '#5f675f',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#ff7a1a',
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 46,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
    padding: 14,
  },
  formTitle: {
    color: '#151815',
    fontSize: 16,
    fontWeight: '900',
  },
  helperText: {
    color: '#6b736b',
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151815',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#075f46',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  errorText: {
    color: '#b14a32',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  successText: {
    color: '#075f46',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  list: {
    paddingBottom: 26,
  },
  separator: {
    height: 10,
  },
  staffCard: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  staffHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#075f46',
    borderColor: '#ff7a1a',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  staffCopy: {
    flex: 1,
  },
  staffName: {
    color: '#151815',
    fontSize: 16,
    fontWeight: '900',
  },
  staffMeta: {
    color: '#6b736b',
    fontSize: 12,
    marginTop: 3,
  },
  statusBadge: {
    backgroundColor: '#e8f0ec',
    borderRadius: 8,
    color: '#176b52',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  inactiveBadge: {
    backgroundColor: '#edf0ec',
    color: '#6b736b',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  infoCell: {
    backgroundColor: '#f4f6f3',
    borderRadius: 8,
    flex: 1,
    padding: 9,
  },
  infoLabel: {
    color: '#8b948b',
    fontSize: 10,
    fontWeight: '900',
  },
  infoValue: {
    color: '#151815',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  stateText: {
    color: '#4c554c',
    marginTop: 12,
  },
  disabledAction: {
    opacity: 0.55,
  },
});
