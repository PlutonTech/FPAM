import { api, authedBlobUrl, downloadFile } from './client';

const enc = encodeURIComponent;

export const FORM_STATUSES = ['Draft', 'Submitted', 'UnderReview', 'Approved', 'Deferred', 'Rejected'] as const;
export type FormStatus = typeof FORM_STATUSES[number];

export interface FormAttachment { _id: string; originalname?: string; filename?: string; contentType?: string; sizeBytes?: number; label?: string; uploadedAt?: string }

export interface FormRequest {
  _id: string;
  formType: string;
  mda: string;
  status: FormStatus;
  linkedAssetId?: string | null;
  submittedBy?: { _id: string; name?: string; email?: string } | null;
  reviewedBy?: { _id: string; name?: string } | null;
  reviewedAt?: string;
  reviewRemarks?: string;
  attachments?: FormAttachment[];
  certificateIssued?: boolean;
  certificateNumber?: string;
  certificateIssuedAt?: string;
  physicalCopyIssued?: boolean;
  physicalCopyIssuedAt?: string;
  createdAt?: string;
  [dataField: string]: unknown;
}

export const listFormRequests = () =>
  api<{ requests: FormRequest[] }>('/form-requests').then(r => r.requests || []);
export const getFormRequest = (id: string) =>
  api<{ request: FormRequest }>(`/form-requests/${enc(id)}`).then(r => r.request);
export const createFormRequest = (body: Record<string, unknown>) =>
  api<{ request: FormRequest }>('/form-requests', { method: 'POST', body }).then(r => r.request);
export const reviewFormRequest = (id: string, body: { status?: FormStatus; reviewRemarks?: string }) =>
  api<{ request: FormRequest }>(`/form-requests/${enc(id)}`, { method: 'PATCH', body }).then(r => r.request);
/** Owner edits to their own Draft (form data, linked asset, or status: 'Submitted'). */
export const updateDraft = (id: string, body: Record<string, unknown>) =>
  api<{ request: FormRequest }>(`/form-requests/${enc(id)}`, { method: 'PATCH', body }).then(r => r.request);
export const deleteFormRequest = (id: string) => api(`/form-requests/${enc(id)}`, { method: 'DELETE' });

export function addAttachment(id: string, file: File, label = '') {
  const fd = new FormData(); fd.append('file', file); if (label) fd.append('label', label);
  return api(`/form-requests/${enc(id)}/attachments`, { method: 'POST', body: fd });
}
export const openAttachment = (id: string, attId: string) => authedBlobUrl(`/form-requests/${enc(id)}/attachments/${enc(attId)}`);
export const downloadAttachment = (id: string, attId: string, name: string) =>
  downloadFile(`/form-requests/${enc(id)}/attachments/${enc(attId)}`, name);

export function issueCertificate(id: string, pdf: Blob, certificateNumber: string) {
  const fd = new FormData();
  fd.append('certificate', pdf, `certificate-${id}.pdf`);
  fd.append('certificateNumber', certificateNumber);
  return api<{ request: FormRequest }>(`/form-requests/${enc(id)}/issue-certificate`, { method: 'POST', body: fd }).then(r => r.request);
}
export const markPhysicalIssued = (id: string) =>
  api<{ request: FormRequest }>(`/form-requests/${enc(id)}/mark-physical-issued`, { method: 'POST' }).then(r => r.request);
export const downloadCertificate = (id: string, name: string) => downloadFile(`/form-requests/${enc(id)}/certificate`, name);
