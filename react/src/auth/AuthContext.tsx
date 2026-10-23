import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as assetsApi from '../api/assets';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import type { User } from '../types';
import { permsFor, type Perm } from './permissions';

interface AuthState {
  user: User | null;
  /** Resolves to the user, or to { mfaToken } when a two-step code is still needed. */
  login: (email: string, password: string) => Promise<User | { mfaToken: string }>;
  /** Store a session (after two-step verification, or a fresh token after a password change). */
  finishLogin: (token: string, user?: User) => void;
  logout: () => Promise<void>;
  can: (perm: Perm) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Uses the same localStorage keys as the legacy dashboard (as_token / as_user).
  const [user, setUser] = useState<User | null>(() => (tokenStore.get() ? tokenStore.getUser() : null));

  useEffect(() => {
    setUnauthorizedHandler(() => { tokenStore.clear(); setUser(null); });
  }, []);

  const finishLogin = useCallback((token: string, u?: User) => {
    tokenStore.set(token);
    if (u) { tokenStore.setUser(u); setUser(u); }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await assetsApi.login(email, password);
    if (r.mfaRequired) return { mfaToken: r.mfaToken };
    finishLogin(r.token, r.user);
    return r.user;
  }, [finishLogin]);

  const logout = useCallback(async () => {
    await assetsApi.logout();
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const perms = permsFor(user);
    return { user, login, finishLogin, logout, can: p => perms[p] === true };
  }, [user, login, finishLogin, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
