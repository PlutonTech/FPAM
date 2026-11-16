import { api } from './client';

const enc = encodeURIComponent;

export const REPORT_STATUSES = ['New', 'Acknowledged', 'In progress', 'Resolved', 'Dismissed'] as const;
export type ReportStatus = typeof REPORT_STATUSES[number];

export interface PublicAsset { assetId: string; assetCode: string | null; name: string; type: string; mda: string; state: string; lga: string }
export interface PublicReport {
  _id: string; ref: string; assetId: string; assetName: string; mda: string; state: string;
  category: string; severity: 'Low' | 'Medium' | 'High'; description: string;
  reporter: { name?: string; phone?: string; email?: string };
  location?: { lat: number; lng: number };
  status: ReportStatus;
  history: { status: ReportStatus; note: string; by: string; at: string }[];
  workOrderId: string | null;
  createdAt: string;
}

// Public (no sign-in): what a scanned QR label shows, and the report form.
export const getPublicAsset = (id: string) =>
  api<{ asset: PublicAsset; categories: string[] }>(`/public/assets/${enc(id)}`);
export const submitReport = (id: string, body: Record<string, unknown>) =>
  api<{ ref: string }>(`/public/assets/${enc(id)}/reports`, { method: 'POST', body });

// Signed in: the queue (MDA Agents get only their MDA's reports).
export const listReports = (params: { status?: string; assetId?: string } = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return api<{ reports: PublicReport[]; counts: Record<string, number>; canHandle: boolean }>(`/reports${q ? `?${q}` : ''}`);
};
export const updateReport = (id: string, status: ReportStatus, note: string) =>
  api<{ report: PublicReport }>(`/reports/${enc(id)}`, { method: 'PATCH', body: { status, note } });
