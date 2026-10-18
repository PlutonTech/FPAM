import { api } from './client';
import type { Asset } from '../types';

const enc = encodeURIComponent;

// ── Approvals ─────────────────────────────────────────────────────────────────
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'all';

export const listApprovals = (status: ApprovalStatus = 'Pending', limit = 200) =>
  api<{ assets: Asset[] }>(`/assets/approvals?status=${enc(status)}&limit=${limit}`).then(r => r.assets || []);

export const approvalsSummary = () =>
  api<{ pending: number; approved: number; rejected: number }>('/assets/approvals/summary');

export const approveAsset = (id: string) => api(`/assets/${enc(id)}/approve`, { method: 'POST' });
export const rejectAsset  = (id: string, reason: string) =>
  api(`/assets/${enc(id)}/reject`, { method: 'POST', body: { reason } });

// ── Audit feed ────────────────────────────────────────────────────────────────
export interface AuditEntry {
  _id: string;
  action: string;
  entityId?: string;
  entityType?: string;
  detail?: string;
  performedBy?: { name?: string; email?: string } | string | null;
  ts?: string;
  createdAt?: string;
}
export const recentAudit = (limit = 6) =>
  api<{ logs: AuditEntry[] }>(`/audit?limit=${limit}`).then(r => r.logs || []);

// ── Inspections ───────────────────────────────────────────────────────────────
export interface InspectionSummary { total: number; overdue: number; pending: number; approved: number; upcoming: number }
export const inspectionSummary = () => api<InspectionSummary>('/inspections/summary');
