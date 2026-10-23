import type { LoginResult } from './security';
import { api, downloadFile } from './client';
import type { Asset, AssetListResponse, MaintenanceLog, Valuation } from '../types';

const enc = encodeURIComponent;

// ── Auth ──────────────────────────────────────────────────────────────────────
/** Returns { token, user }, or { mfaRequired, mfaToken } when two-step sign-in is on. */
export const login  = (email: string, password: string) =>
  api<LoginResult>('/auth/login', { method: 'POST', body: { email, password } });
export const logout = () => api('/auth/logout', { method: 'POST' }).catch(() => {});

// ── Assets ────────────────────────────────────────────────────────────────────
export function listAssets(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return api<AssetListResponse>(`/assets${qs ? `?${qs}` : ''}`);
}

/**
 * The backend caps each request at 200 rows, so fetch page 1 to learn the
 * page count, then fetch the rest in parallel.
 */
export async function fetchAllAssets(params: Record<string, string> = {}): Promise<Asset[]> {
  const LIMIT = 200, MAX_PAGES = 50;
  const first = await listAssets({ ...params, page: 1, limit: LIMIT });
  const pages = Math.min(first.pages || 1, MAX_PAGES);
  const rest = pages > 1
    ? await Promise.all(Array.from({ length: pages - 1 }, (_, i) => listAssets({ ...params, page: i + 2, limit: LIMIT })))
    : [];
  return [first, ...rest].flatMap(r => r.assets || []);
}

export const createAsset = (data: Record<string, unknown>) =>
  api<{ asset: Asset }>('/assets', { method: 'POST', body: data }).then(r => r.asset);
export const getAsset    = (id: string) => api<{ asset: Asset }>(`/assets/${enc(id)}`).then(r => r.asset);
export const updateAsset = (id: string, data: Record<string, unknown>) =>
  api<{ asset: Asset }>(`/assets/${enc(id)}`, { method: 'PUT', body: data }).then(r => r.asset);
export const deleteAsset = (id: string) => api(`/assets/${enc(id)}`, { method: 'DELETE' });
export const searchAssets = (q: string) => api<{ assets: Asset[] }>(`/assets/search?q=${enc(q)}`).then(r => r.assets);

// ── Files ─────────────────────────────────────────────────────────────────────
export const photoPath    = (assetId: string, fileId: string) => `/assets/${enc(assetId)}/photos/${enc(fileId)}`;
export const documentPath = (assetId: string, fileId: string) => `/assets/${enc(assetId)}/documents/${enc(fileId)}`;

export function uploadPhoto(assetId: string, file: File) {
  const fd = new FormData(); fd.append('photo', file);
  return api(`/assets/${enc(assetId)}/photos`, { method: 'POST', body: fd });
}
export const deletePhoto = (assetId: string, fileId: string) => api(photoPath(assetId, fileId), { method: 'DELETE' });

export function uploadDocument(assetId: string, file: File) {
  const fd = new FormData(); fd.append('file', file);
  return api(`/assets/${enc(assetId)}/documents`, { method: 'POST', body: fd });
}
export const deleteDocument = (assetId: string, fileId: string) => api(documentPath(assetId, fileId), { method: 'DELETE' });

export function uploadSpreadsheet(assetId: string, file: File) {
  const fd = new FormData(); fd.append('file', file);
  return api(`/assets/${enc(assetId)}/excel`, { method: 'POST', body: fd });
}

// ── Maintenance / valuation ───────────────────────────────────────────────────
export const addMaintenance = (assetId: string, log: Omit<MaintenanceLog, '_id'>) =>
  api<{ asset: Asset }>(`/assets/${enc(assetId)}/maintenance`, { method: 'POST', body: { ...log } }).then(r => r.asset);
export const deleteMaintenance = (assetId: string, logId: string) =>
  api<{ asset: Asset }>(`/assets/${enc(assetId)}/maintenance/${enc(logId)}`, { method: 'DELETE' }).then(r => r.asset);
export const updateValuation = (assetId: string, v: Valuation) =>
  api<{ asset: Asset }>(`/assets/${enc(assetId)}/valuation`, { method: 'PUT', body: { ...v } }).then(r => r.asset);

// ── MDAs ──────────────────────────────────────────────────────────────────────
let mdaCache: string[] | null = null;
export async function getMdaNames(): Promise<string[]> {
  if (mdaCache) return mdaCache;
  try {
    const r = await api<{ mdas: { name: string }[] }>('/mdas');
    mdaCache = (r.mdas || []).map(m => m.name);
  } catch { mdaCache = []; }
  return mdaCache;
}

// ── Export ────────────────────────────────────────────────────────────────────
export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'geojson' | 'json';

/** Full export narrowed by registry filters (backend applies the same gate). */
export function exportFiltered(format: ExportFormat, filters: Record<string, string>) {
  const qs = new URLSearchParams({ format, ...filters });
  return downloadFile(`/assets/export?${qs}`, `assets_export.${format}`);
}

/** Export an explicit set of assets (POST so thousands of IDs fit). */
export function exportIds(format: ExportFormat, ids: string[]) {
  return downloadFile('/assets/export/bulk', `assets_export.${format}`, { method: 'POST', body: { ids, format } });
}
