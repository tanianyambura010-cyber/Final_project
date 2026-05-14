import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import {
  createRiderProfile,
  fetchRiders,
  type CreateRiderPayload,
  type Rider,
} from '../services/riders';

type SuccessState = {
  name: string;
  email: string;
  password: string;
};

const vehicleOptions = ['Motorbike', 'Scooter', 'Bicycle', 'Car'];

function generateTemporaryPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$';
  const pool = letters + numbers + symbols;
  const body = Array.from({ length: 9 }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
  return `CF${body}7!`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readableStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b948b"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RiderCard({ rider }: { rider: Rider }) {
  const online = rider.currentStatus !== 'offline';

  return (
    <View style={styles.riderCard}>
      <View style={styles.riderHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{rider.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.riderCopy}>
          <Text style={styles.riderName}>{rider.name}</Text>
          <Text style={styles.riderMeta}>{rider.email}</Text>
        </View>
        <Text style={[styles.statusBadge, !online && styles.offlineBadge]}>
          {readableStatus(rider.currentStatus)}
        </Text>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Vehicle</Text>
          <Text style={styles.infoValue}>{rider.vehicleType}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Plate</Text>
          <Text style={styles.infoValue}>{rider.plateNumber ?? 'Not set'}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{rider.phone}</Text>
        </View>
      </View>
    </View>
  );
}

export function RiderManagementScreen() {
  const { session } = useAuth();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [vehicleType, setVehicleType] = useState('Motorbike');
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const summary = useMemo(() => {
    const online = riders.filter((rider) => rider.currentStatus !== 'offline').length;
    const busy = riders.filter((rider) => rider.currentStatus === 'busy').length;
    const offline = riders.filter((rider) => rider.currentStatus === 'offline').length;

    return { online, busy, offline };
  }, [riders]);

  const formValid = useMemo(
    () =>
      name.trim().length >= 2 &&
      isValidEmail(email.trim()) &&
      phone.trim().length >= 7 &&
      password.length >= 8 &&
      password === confirmPassword &&
      vehicleType.trim().length >= 2,
    [confirmPassword, email, name, password, phone, vehicleType]
  );

  const formHint = useMemo(() => {
    if (formValid) {
      return null;
    }

    if (name.trim().length < 2) {
      return 'Full name must have at least 2 characters.';
    }

    if (!isValidEmail(email.trim())) {
      return 'Enter a valid email address.';
    }

    if (phone.trim().length < 7) {
      return 'Phone number must have at least 7 characters.';
    }

    if (password.length < 8) {
      return 'Temporary password must have at least 8 characters.';
    }

    if (password !== confirmPassword) {
      return 'Password and confirmation must match.';
    }

    if (vehicleType.trim().length < 2) {
      return 'Choose or enter the rider vehicle type.';
    }

    return null;
  }, [confirmPassword, email, formValid, name, password, phone, vehicleType]);

  function clearForm() {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setVehicleType('Motorbike');
    setPlateNumber('');
  }

  function fillGeneratedPassword() {
    const nextPassword = generateTemporaryPassword();
    setPassword(nextPassword);
    setConfirmPassword(nextPassword);
    setShowPassword(true);
    setError(null);
    setSuccess(null);
  }

  const loadRiders = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setRiders(await fetchRiders(session.token));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load riders');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadRiders();
  }, [loadRiders]);

  async function addRider() {
    if (!session?.token || saving) {
      return;
    }

    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();
    const nextPhone = phone.trim();
    const nextVehicleType = vehicleType.trim();
    const payload: CreateRiderPayload = {
      name: nextName,
      email: nextEmail,
      phone: nextPhone,
      password,
      vehicleType: nextVehicleType,
      plateNumber: plateNumber.trim() || undefined,
    };

    if (!nextName || !nextPhone || !nextVehicleType) {
      setError('Enter rider name, phone, and vehicle details.');
      return;
    }

    if (!isValidEmail(nextEmail)) {
      setError('Enter a valid rider email address.');
      return;
    }

    if (password.length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Temporary password and confirmation must match.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createRiderProfile(session.token, payload);
      setSuccess({ name: nextName, email: nextEmail, password });
      clearForm();
      setShowForm(false);
      await loadRiders();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add rider');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, showForm && styles.scrollContentWithDock]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Admin</Text>
          <Text style={styles.title}>Rider Management</Text>
        </View>
        <View style={styles.headerButtonGroup}>
          <Pressable
            onPress={() => {
              setShowForm(true);
              setError(null);
              setSuccess(null);
            }}
            style={styles.headerAddButton}
          >
            <Text style={styles.headerAddText}>+ Rider</Text>
          </Pressable>
          <Pressable onPress={loadRiders} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

        <View style={styles.summaryGrid}>
        <StatCard label="Online Riders" value={String(summary.online)} />
        <StatCard label="Busy Riders" value={String(summary.busy)} />
        <StatCard label="Offline Riders" value={String(summary.offline)} />
      </View>

        <Pressable
        onPress={() => {
          setShowForm((value) => !value);
          setError(null);
        }}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>{showForm ? 'Close form' : '+ Add New Rider'}</Text>
      </Pressable>

        {showForm ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create rider account</Text>
          <Text style={styles.helperText}>The rider will use these credentials with the Rider login role.</Text>
          <TextInput
            onChangeText={setName}
            placeholder="Full name e.g. Marcus Thorne"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={name}
          />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email e.g. marcus@beananddash.test"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={email}
          />
          <TextInput
            keyboardType="phone-pad"
            onChangeText={setPhone}
            placeholder="Phone e.g. +254700000000"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={phone}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Temporary password, minimum 8 characters"
            placeholderTextColor="#8b948b"
            secureTextEntry={!showPassword}
            style={styles.input}
            value={password}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setConfirmPassword}
            placeholder="Confirm the same password"
            placeholderTextColor="#8b948b"
            secureTextEntry={!showPassword}
            style={styles.input}
            value={confirmPassword}
          />
          <View style={styles.passwordActions}>
            <Pressable onPress={fillGeneratedPassword} style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>Generate Password</Text>
            </Pressable>
            <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <View style={styles.vehicleGrid}>
            {vehicleOptions.map((option) => {
              const active = vehicleType === option;

              return (
                <Pressable
                  key={option}
                  onPress={() => setVehicleType(option)}
                  style={[styles.vehicleChip, active && styles.vehicleChipActive]}
                >
                  <Text style={[styles.vehicleChipText, active && styles.vehicleChipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            onChangeText={setPlateNumber}
            placeholder="Plate number e.g. KDA 123A"
            placeholderTextColor="#8b948b"
            style={styles.input}
            value={plateNumber}
          />
          {formHint ? <Text style={styles.formHint}>{formHint}</Text> : null}

          <Pressable disabled={saving} onPress={addRider} style={[styles.saveButton, saving && styles.disabledAction]}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Create rider account</Text>
            )}
          </Pressable>
        </View>
      ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>{success.name} is ready to log in</Text>
          <Text style={styles.successText}>Role: Rider</Text>
          <Text style={styles.successText}>Email: {success.email}</Text>
          <Text style={styles.successText}>Password: {success.password}</Text>
        </View>
      ) : null}

        {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#176b52" />
          <Text style={styles.stateText}>Loading riders...</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {riders.map((rider, index) => (
            <View key={rider.id}>
              <RiderCard rider={rider} />
              {index < riders.length - 1 ? <View style={styles.separator} /> : null}
            </View>
          ))}
        </View>
      )}
      </ScrollView>
      {showForm ? (
        <View style={styles.stickyFormActions}>
          {formHint ? <Text style={styles.stickyHint}>{formHint}</Text> : null}
          <View style={styles.stickyButtonRow}>
            <Pressable
              onPress={() => {
                setShowForm(false);
                setError(null);
              }}
              style={styles.stickySecondaryButton}
            >
              <Text style={styles.stickySecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={addRider} style={[styles.stickyPrimaryButton, saving && styles.disabledAction]}>
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.stickyPrimaryText}>Create Rider</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setShowForm(true);
            setError(null);
          }}
          style={styles.floatingAddButton}
        >
          <Text style={styles.floatingAddText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 96,
  },
  scrollContentWithDock: {
    paddingBottom: 150,
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
  headerButtonGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  headerAddButton: {
    alignItems: 'center',
    backgroundColor: '#ff7a1a',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  headerAddText: {
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
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: '#3d453d',
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151815',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 8,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: '#075f46',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  outlineButtonText: {
    color: '#075f46',
    fontSize: 12,
    fontWeight: '900',
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleChip: {
    alignItems: 'center',
    backgroundColor: '#f4f6f3',
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 38,
    minWidth: 92,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  vehicleChipActive: {
    backgroundColor: '#075f46',
    borderColor: '#075f46',
  },
  vehicleChipText: {
    color: '#4c554c',
    fontSize: 12,
    fontWeight: '900',
  },
  vehicleChipTextActive: {
    color: '#ffffff',
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
  formHint: {
    color: '#a34f16',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  successCard: {
    backgroundColor: '#e9f6ef',
    borderColor: '#b9e3cb',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    marginBottom: 10,
    padding: 12,
  },
  successTitle: {
    color: '#075f46',
    fontSize: 14,
    fontWeight: '900',
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
  riderCard: {
    backgroundColor: '#ffffff',
    borderColor: '#edf0ec',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  riderHeader: {
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
  riderCopy: {
    flex: 1,
  },
  riderName: {
    color: '#151815',
    fontSize: 16,
    fontWeight: '900',
  },
  riderMeta: {
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
    textTransform: 'capitalize',
  },
  offlineBadge: {
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
  floatingAddButton: {
    alignItems: 'center',
    backgroundColor: '#ff7a1a',
    borderColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 3,
    bottom: 18,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    width: 56,
    zIndex: 20,
  },
  floatingAddText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  stickyFormActions: {
    backgroundColor: '#ffffff',
    borderColor: '#d7ded6',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 8,
    left: 12,
    padding: 10,
    position: 'absolute',
    right: 12,
    zIndex: 30,
  },
  stickyHint: {
    color: '#a34f16',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
  },
  stickyButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stickySecondaryButton: {
    alignItems: 'center',
    borderColor: '#075f46',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  stickySecondaryText: {
    color: '#075f46',
    fontSize: 13,
    fontWeight: '900',
  },
  stickyPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#075f46',
    borderRadius: 8,
    flex: 1.4,
    justifyContent: 'center',
    minHeight: 44,
  },
  stickyPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
