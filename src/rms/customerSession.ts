import { useSyncExternalStore } from 'react';
import { useRms } from './store';
import type { Customer } from './types';

// Public customers sign in separately from staff (own key, own records): a
// customer session can never reach the staff dashboard, and vice versa.
const KEY = 'fpam_rms_customer';
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
let currentId = read();

export function signInCustomer(id: string) {
  currentId = id;
  try { localStorage.setItem(KEY, id); } catch { /* session only for this page load */ }
  listeners.forEach(l => l());
}
export const signOutCustomer = () => signInCustomer('');

export function useCustomer(): Customer | null {
  const db = useRms();
  const id = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => currentId);
  return db.customers.find(c => c.id === id) || null;
}
