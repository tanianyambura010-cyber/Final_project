import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchCurrentUser, login, register, type AuthSession, type UserRole } from '../services/auth';
import { clearSession, loadSession, saveSession } from '../storage/sessionStorage';

type AuthContextValue = {
  session: AuthSession | null;
  initializing: boolean;
  signIn: (email: string, password: string, role?: UserRole) => Promise<void>;
  signUp: (name: string, email: string, phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const storedSession = await loadSession();

        if (!storedSession) {
          return;
        }

        const user = await fetchCurrentUser(storedSession.token);

        if (mounted) {
          setSession({ token: storedSession.token, user });
        }
      } catch {
        await clearSession();
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, role?: UserRole) => {
    const nextSession = await login(email, password, role);
    await saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const signUp = useCallback(async (name: string, email: string, phone: string, password: string) => {
    const nextSession = await register(name, email, phone, password);
    await saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      initializing,
      signIn,
      signUp,
      signOut,
    }),
    [initializing, session, signIn, signOut, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
