import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { BackButton } from '../components/BackButton';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../services/auth';

type AuthMode = 'login' | 'register';

const loginRoles: Array<{ label: string; value: UserRole }> = [
  { label: 'Customer', value: 'customer' },
  { label: 'Staff', value: 'staff' },
  { label: 'Rider', value: 'rider' },
  { label: 'Admin', value: 'admin' },
];

const demoAccounts = [
  { label: 'Customer', email: 'customer@cafefresh.test' },
  { label: 'Staff', email: 'staff@cafefresh.test' },
  { label: 'Rider', email: 'rider@cafefresh.test' },
  { label: 'Admin', email: 'admin@cafefresh.test' },
];

function Field({
  keyboardType,
  label,
  onChangeText,
  placeholder,
  secureTextEntry,
  value,
}: {
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8f948f"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

export function AuthScreen({
  initialMode = 'login',
  onBack,
}: {
  initialMode?: AuthMode;
  onBack?: () => void;
}) {
  const { width } = useWindowDimensions();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginRole, setLoginRole] = useState<UserRole>('customer');
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDesktop = width >= 780;
  const isRegister = mode === 'register';
  const selectedLoginRole = loginRoles.find((role) => role.value === loginRole) ?? loginRoles[0];
  const title = isRegister ? 'Create Account' : 'Welcome Back';
  const subtitle = isRegister ? 'Create your Bean & Dash customer account' : 'Login to continue to your account';
  const actionLabel = isRegister ? 'Register' : 'Login';
  const switchLabel = isRegister ? 'Login' : 'Register';

  useEffect(() => {
    setMode(initialMode);
    setRoleMenuOpen(false);
  }, [initialMode]);

  // Check that the form has enough details before allowing submission.
  const formValid = useMemo(() => {
    if (!email.trim() || password.length < 8) {
      return false;
    }

    if (isRegister) {
      return name.trim().length >= 2 && phone.trim().length >= 7;
    }

    return true;
  }, [email, isRegister, name, password, phone]);

  async function submit() {
    if (!formValid || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Register new customers, otherwise log in using the selected role.
      if (isRegister) {
        await signUp(name.trim(), email.trim(), phone.trim(), password);
      } else {
        await signIn(email.trim(), password, loginRole);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.authShell, isDesktop && styles.desktopAuthShell]}>
          <View style={[styles.brandPanel, !isDesktop && styles.mobileBrandPanel]}>
            <View style={styles.orangeCircle} />
            <View style={styles.greenCircle} />
            <View style={styles.brandPanelContent}>
              <Text style={styles.brandName}>Bean & Dash</Text>
              <Text style={styles.brandTagline}>
                Food Delivery Optimization System Using GPS/GPRS
              </Text>
              <Text style={styles.brandFeatureLine}>
                Fast ordering • Live rider tracking
              </Text>
              <Text style={styles.brandFeatureLine}>
                Secure payment • Smart delivery
              </Text>
            </View>
          </View>

          <View style={styles.formSide}>
            <View style={styles.authCard}>
              {onBack ? (
                <View style={styles.backRow}>
                  <BackButton onPress={onBack} />
                </View>
              ) : null}

              <View style={styles.cardHeader}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              <View style={styles.form}>
                {isRegister ? (
                  <Field
                    label="Full Name"
                    onChangeText={setName}
                    placeholder="Your name"
                    value={name}
                  />
                ) : (
                  <View style={styles.field}>
                    <Text style={styles.label}>Role</Text>
                    <Pressable
                      onPress={() => setRoleMenuOpen((open) => !open)}
                      style={styles.roleSelect}
                    >
                      <Text style={styles.roleSelectText}>{selectedLoginRole.label}</Text>
                      <Text style={styles.roleSelectArrow}>{roleMenuOpen ? '^' : 'v'}</Text>
                    </Pressable>
                    {roleMenuOpen ? (
                      <View style={styles.roleMenu}>
                        {loginRoles.map((role) => {
                          const active = loginRole === role.value;

                          return (
                            <Pressable
                              key={role.value}
                              onPress={() => {
                                setLoginRole(role.value);
                                setRoleMenuOpen(false);
                              }}
                              style={[styles.roleOption, active && styles.roleOptionActive]}
                            >
                              <Text style={[styles.roleOptionText, active && styles.roleOptionTextActive]}>
                                {role.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                )}

                <Field
                  keyboardType="email-address"
                  label="Email Address"
                  onChangeText={setEmail}
                  placeholder="customer@example.com"
                  value={email}
                />

                {isRegister ? (
                  <Field
                    keyboardType="phone-pad"
                    label="Phone Number"
                    onChangeText={setPhone}
                    placeholder="+254700000000"
                    value={phone}
                  />
                ) : null}

                <Field
                  label="Password"
                  onChangeText={setPassword}
                  placeholder="password123"
                  secureTextEntry
                  value={password}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  disabled={!formValid || submitting}
                  onPress={submit}
                  style={[styles.primaryButton, (!formValid || submitting) && styles.disabledButton]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{actionLabel}</Text>
                  )}
                </Pressable>

                <View style={styles.linkRow}>
                  {!isRegister ? <Text style={styles.linkText}>Forgot password?</Text> : null}
                  <Pressable
                    onPress={() => {
                      setMode(isRegister ? 'login' : 'register');
                      setError(null);
                      setRoleMenuOpen(false);
                    }}
                  >
                    <Text style={styles.linkText}>{isRegister ? 'Back to login' : 'Create account'}</Text>
                  </Pressable>
                </View>

                {onBack ? (
                  <Pressable onPress={onBack} style={styles.homeLinkButton}>
                    <Text style={styles.homeLinkText}>Back to home</Text>
                  </Pressable>
                ) : null}

                {!isRegister ? (
                  <View style={styles.demoBox}>
                    <Text style={styles.demoTitle}>Demo credentials</Text>
                    {demoAccounts.map((account) => (
                      <Text key={account.label} style={styles.demoLine}>
                        {account.label}: {account.email} / password123
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f4f6f3',
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  authShell: {
    backgroundColor: '#ffffff',
    borderColor: '#e0ddd8',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 980,
    overflow: 'hidden',
    shadowColor: '#151815',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    width: '100%',
  },
  desktopAuthShell: {
    flexDirection: 'row',
    minHeight: 560,
  },
  brandPanel: {
    backgroundColor: '#11543b',
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
    padding: 46,
    position: 'relative',
  },
  mobileBrandPanel: {
    minHeight: 230,
    padding: 28,
  },
  orangeCircle: {
    backgroundColor: '#f98b23',
    borderRadius: 130,
    height: 260,
    position: 'absolute',
    right: -40,
    top: -110,
    width: 260,
  },
  greenCircle: {
    backgroundColor: '#1a7354',
    borderRadius: 120,
    bottom: -70,
    height: 240,
    left: -62,
    position: 'absolute',
    width: 240,
  },
  brandPanelContent: {
    justifyContent: 'center',
    maxWidth: 380,
    minHeight: 240,
    zIndex: 1,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  brandTagline: {
    color: '#dcece4',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 10,
  },
  brandFeatureLine: {
    color: '#e9f4ee',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 34,
  },
  formSide: {
    alignItems: 'center',
    backgroundColor: '#f7f8f6',
    flex: 1.35,
    justifyContent: 'center',
    padding: 28,
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ddd9d4',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 420,
    padding: 28,
    width: '100%',
  },
  backRow: {
    marginBottom: 8,
    marginLeft: -10,
  },
  cardHeader: {
    marginBottom: 22,
  },
  title: {
    color: '#173c2d',
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: '#646d66',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 7,
  },
  label: {
    color: '#343b35',
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderColor: '#d7d7d7',
    borderRadius: 8,
    borderWidth: 1,
    color: '#171a17',
    fontSize: 15,
    minHeight: 42,
    paddingHorizontal: 13,
  },
  roleSelect: {
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderColor: '#d7d7d7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 13,
  },
  roleSelectText: {
    color: '#173c2d',
    fontSize: 15,
    fontWeight: '900',
  },
  roleSelectArrow: {
    color: '#f98b23',
    fontSize: 14,
    fontWeight: '900',
  },
  roleMenu: {
    backgroundColor: '#ffffff',
    borderColor: '#d7d7d7',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  roleOption: {
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 13,
  },
  roleOptionActive: {
    backgroundColor: '#eef5f0',
  },
  roleOptionText: {
    color: '#414a43',
    fontSize: 14,
    fontWeight: '800',
  },
  roleOptionTextActive: {
    color: '#11543b',
  },
  errorText: {
    color: '#b14a32',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#f98b23',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 46,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  linkText: {
    color: '#11543b',
    fontSize: 13,
    fontWeight: '800',
  },
  homeLinkButton: {
    alignItems: 'center',
  },
  homeLinkText: {
    color: '#5f675f',
    fontSize: 14,
    fontWeight: '800',
  },
  demoBox: {
    backgroundColor: '#f1ede8',
    borderRadius: 8,
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  demoTitle: {
    color: '#4e554e',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  demoLine: {
    color: '#5f675f',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
});
