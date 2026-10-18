import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as assetsApi from '../api/assets';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import type { User } from '../types';
import { permsFor, type Perm } from './permissions';

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
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

  const login = useCallback(async (email: string, password: string) => {
    const r = await assetsApi.login(email, password);
    tokenStore.set(r.token);
    tokenStore.setUser(r.user);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    await assetsApi.logout();
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const perms = permsFor(user);
    return { user, login, logout, can: p => perms[p] === true };
  }, [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
