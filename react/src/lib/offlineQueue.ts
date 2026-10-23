import { useSyncExternalStore } from 'react';
import * as assetsApi from '../api/assets';
import { ApiError, errorMessage } from '../api/client';

// Offline field capture. When a capture can't reach the server it is saved in
// the browser (IndexedDB — photos included) and uploaded automatically when the
// connection returns: on the browser's "online" event, when the app opens, and
// every minute while anything is waiting. Nothing leaves the device until then.

export type FileKind = 'photo' | 'document' | 'spreadsheet';
export interface QueuedCapture {
  id: string;
  payload: Record<string, unknown>;
  files: { kind: FileKind; name: string; type: string; blob: Blob }[];
  createdAt: string;
  attempts: number;
  lastError?: string;
  /** Set once the asset exists on the server, so a retry only re-sends files. */
  assetId?: string;
}

const DB = 'fpamas-offline', STORE = 'captures';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Small store so components can show the waiting count ────────────────────
let state = { count: 0, syncing: false, lastResult: '' };
const listeners = new Set<() => void>();
const emit = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
export function useOfflineQueue() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state);
}

export const listQueued = () => tx<QueuedCapture[]>('readonly', s => s.getAll() as IDBRequest<QueuedCapture[]>);
async function refreshCount() { try { emit({ count: (await listQueued()).length }); } catch { /* IndexedDB unavailable */ } }

export async function enqueueCapture(payload: Record<string, unknown>, files: QueuedCapture['files']) {
  const item: QueuedCapture = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, payload, files, createdAt: new Date().toISOString(), attempts: 0 };
  await tx('readwrite', s => s.put(item));
  await refreshCount();
  return item;
}
export async function removeQueued(id: string) { await tx('readwrite', s => s.delete(id)); await refreshCount(); }

const UPLOAD: Record<FileKind, (id: string, f: File) => Promise<unknown>> = {
  photo: assetsApi.uploadPhoto, document: assetsApi.uploadDocument, spreadsheet: assetsApi.uploadSpreadsheet,
};

/** Upload everything waiting. Returns a short summary for a toast. */
export async function syncQueue(): Promise<string> {
  if (state.syncing || !navigator.onLine) return '';
  emit({ syncing: true });
  let sent = 0, failed = 0;
  try {
    for (const item of await listQueued()) {
      try {
        if (!item.assetId) {
          const asset = await assetsApi.createAsset(item.payload);
          item.assetId = asset.assetId;
          await tx('readwrite', s => s.put(item));          // don't create it twice if a file upload fails
        }
        const remaining: QueuedCapture['files'] = [];
        for (const f of item.files) {
          try { await UPLOAD[f.kind](item.assetId!, new File([f.blob], f.name, { type: f.type })); }
          catch (err) { if (err instanceof TypeError) throw err; remaining.push(f); }   // offline again: stop; rejected file: keep for review
        }
        if (remaining.length) {
          await tx('readwrite', s => s.put({ ...item, files: remaining, attempts: item.attempts + 1, lastError: 'Some files were rejected — open the asset to add them again' }));
          failed++;
        } else { await removeQueued(item.id); sent++; }
      } catch (err) {
        if (err instanceof TypeError) break;                 // still offline
        // The server refused it (e.g. a duplicate or invalid field): keep it and show why.
        await tx('readwrite', s => s.put({ ...item, attempts: item.attempts + 1, lastError: err instanceof ApiError ? err.message : errorMessage(err) }));
        failed++;
      }
    }
  } finally {
    await refreshCount();
    emit({ syncing: false });
  }
  const msg = [sent && `${sent} offline capture${sent === 1 ? '' : 's'} uploaded`, failed && `${failed} need attention`].filter(Boolean).join(' · ');
  if (msg) emit({ lastResult: msg });
  return msg;
}

let started = false;
/** Call once at startup. */
export function startOfflineSync(onResult?: (msg: string) => void) {
  if (started || typeof indexedDB === 'undefined') return;
  started = true;
  const run = () => syncQueue().then(m => { if (m) onResult?.(m); }).catch(() => {});
  refreshCount().then(run);
  window.addEventListener('online', run);
  setInterval(() => { if (state.count && navigator.onLine) run(); }, 60000);
}
