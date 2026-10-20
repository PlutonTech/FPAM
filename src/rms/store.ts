import { useSyncExternalStore } from 'react';
import type { RmsDb } from './types';
import { buildSeed } from './seed';

// The whole RMS database lives in one localStorage entry. Every change goes
// through tx(): it works on a copy and only saves if the whole operation
// succeeds — the browser-only stand-in for a MongoDB transaction.

const KEY = 'fpam_rms_db_v1';

let db: RmsDb = load();
const listeners = new Set<() => void>();

function load(): RmsDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RmsDb;
      if (parsed.version === 1) return parsed;
    }
  } catch { /* corrupted or blocked storage: start fresh */ }
  const seeded = buildSeed();
  persist(seeded);
  return seeded;
}

function persist(next: RmsDb) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { throw new Error('Could not save — browser storage is full or blocked. Remove some attachments or reset the demo data.'); }
}

function emit() { listeners.forEach(l => l()); }

/** Run a change atomically. Throws (and changes nothing) if `fn` throws. */
export function tx<T>(fn: (draft: RmsDb) => T): T {
  const draft = structuredClone(db);
  const result = fn(draft);
  persist(draft);
  db = draft;
  emit();
  return result;
}

export const getDb = () => db;

export function useRms(): RmsDb {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => db,
  );
}

export function resetDemoData() {
  db = buildSeed();
  persist(db);
  emit();
}

// Another tab changed the data: pick it up.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { db = JSON.parse(e.newValue); emit(); } catch { /* ignore */ }
  });
}
