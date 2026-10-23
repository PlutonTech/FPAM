import { api } from './client';

const enc = encodeURIComponent;

export const INSPECTION_TYPES = ['Routine', 'Condition Assessment', 'Post-Maintenance', 'Emergency', 'Annual'] as const;
export const INSPECTION_STATUSES = ['Scheduled', 'Assigned', 'In Progress', 'Submitted', 'Approved', 'Rejected'] as const;
export type InspectionStatus = typeof INSPECTION_STATUSES[number];

export interface Inspection {
  _id: string;
  inspectionId: string;
  inspectionCode?: string | null;
  visitSeq?: number | null;
  assetId: string;
  assetName?: string;
  type: string;
  scheduledDate: string;
  assignedTo?: string | null;
  notes?: string;
  status: InspectionStatus;
  report?: {
    condition?: string; date?: string; findings?: string; recommendations?: string;
    submittedAt?: string; submittedBy?: string;
  };
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  history?: { status: string; at: string; by?: string; note?: string }[];
  createdBy?: string;
  createdAt?: string;
}

export const listInspections = (params: { status?: string; assetId?: string; limit?: number } = {}) => {
  const qs = new URLSearchParams({ limit: String(params.limit ?? 500) });
  if (params.status) qs.set('status', params.status);
  if (params.assetId) qs.set('assetId', params.assetId);
  return api<{ inspections: Inspection[]; total: number }>(`/inspections?${qs}`).then(r => r.inspections || []);
};

export const scheduleInspection = (body: { assetId: string; type: string; scheduledDate: string; assignedTo?: string; notes?: string }) =>
  api<{ inspection: Inspection }>('/inspections', { method: 'POST', body }).then(r => r.inspection);

export const updateInspection = (id: string, body: { status?: string; assignedTo?: string; notes?: string; scheduledDate?: string }) =>
  api<{ inspection: Inspection }>(`/inspections/${enc(id)}`, { method: 'PUT', body }).then(r => r.inspection);

export const submitReport = (id: string, body: { condition: string; date: string; findings: string; recommendations?: string }) =>
  api<{ inspection: Inspection }>(`/inspections/${enc(id)}/submit`, { method: 'POST', body }).then(r => r.inspection);

export const approveInspection = (id: string) =>
  api<{ inspection: Inspection }>(`/inspections/${enc(id)}/approve`, { method: 'POST' }).then(r => r.inspection);

export const rejectInspection = (id: string, reason: string) =>
  api<{ inspection: Inspection }>(`/inspections/${enc(id)}/reject`, { method: 'POST', body: { reason } }).then(r => r.inspection);

export const deleteInspection = (id: string) => api(`/inspections/${enc(id)}`, { method: 'DELETE' });
