import { api } from './client';

export interface DqSummary {
  total: number;
  issues: { type: string; label: string; count: number }[];
  badStates: { value: string; count: number; suggestion: string | null }[];
  badMdas: { value: string; count: number }[];
  workflow: { assignedOpen: number; verified: number };
  states: string[];
}
export interface DqAsset {
  _id: string; assetId: string; assetCode?: string; name: string; type?: string; state?: string; mda?: string;
  condition?: string; nextInspection?: string; location?: { coordinates?: number[] };
  dataQuality?: { assignedTo?: { _id: string; name: string } | null; assignedAt?: string; note?: string; verifiedBy?: { name: string } | null; verifiedAt?: string | null };
}

const qs = (p: Record<string, string | number | undefined>) =>
  Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

export const summary = () => api<DqSummary>('/data-quality/summary');
export const issues = (p: { type?: string; value?: string; mine?: boolean; page?: number }) =>
  api<{ assets: DqAsset[]; total: number; page: number; pages: number }>(`/data-quality/issues?${qs({ type: p.type, value: p.value, mine: p.mine ? 1 : undefined, page: p.page })}`);
export const fixState = (from: string, to: string) => api<{ updated: number; skipped: string[] }>('/data-quality/fix-state', { method: 'POST', body: { from, to } });
export const fixMda = (from: string, to: string) => api<{ updated: number; skipped: string[] }>('/data-quality/fix-mda', { method: 'POST', body: { from, to } });
export const assign = (assetIds: string[], userId: string, note: string) => api<{ assigned: number }>('/data-quality/assign', { method: 'POST', body: { assetIds, userId, note } });
export const verify = (assetIds: string[]) => api<{ verified: number; skipped: number }>('/data-quality/verify', { method: 'POST', body: { assetIds } });
export const assignees = () => api<{ users: { _id: string; name: string; role: string; division?: string }[] }>('/data-quality/assignees').then(r => r.users);
