import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession } from '../services/auth';

const SESSION_KEY = 'cafe-direct-session';

export async function saveSession(session: AuthSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  const value = await AsyncStorage.getItem(SESSION_KEY);
  return value ? (JSON.parse(value) as AuthSession) : null;
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

