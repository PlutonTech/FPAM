import { api, downloadFile } from './client';

const enc = encodeURIComponent;

// ── Relationships ─────────────────────────────────────────────────────────────
export interface RelatedAsset { assetId: string; name: string; type?: string; condition?: string; status?: string; mda?: string; valuation?: { amount?: number } }
export interface Relationships { parentId: string | null; parent: RelatedAsset | null; childIds: string[]; children: RelatedAsset[] }

export const getRelationships = (id: string) => api<Relationships>(`/assets/${enc(id)}/relationships`);
export const linkChild = (id: string, childId: string) =>
  api<{ childCode?: string }>(`/assets/${enc(id)}/relationships/link`, { method: 'POST', body: { childId } });
export const unlinkChild = (id: string, childId: string) =>
  api<{ newChildCode?: string }>(`/assets/${enc(id)}/relationships/unlink`, { method: 'DELETE', body: { childId } });

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export const LIFECYCLE_STAGES = ['Draft', 'Active', 'Under Maintenance', 'Under Review', 'Scheduled for Disposal', 'Decommissioned'] as const;
export interface Lifecycle {
  stage: string;
  history: { from?: string; to?: string; at?: string; by?: string; note?: string; document?: string | null }[];
  documents: { name: string; stage: string; at?: string }[];
  allowedTransitions: string[];
}
export const getLifecycle = (id: string) => api<Lifecycle>(`/assets/${enc(id)}/lifecycle`);
export const transitionLifecycle = (id: string, stage: string, note: string, document: string) =>
  api(`/assets/${enc(id)}/lifecycle/transition`, { method: 'POST', body: { stage, note, document } });

// ── Inventory ─────────────────────────────────────────────────────────────────
export const INV_CATEGORIES = ['MECHANICAL', 'ELECTRICAL', 'STRUCTURAL', 'OTHER'] as const;
export const INV_LOCATIONS = ['INTERNAL', 'EXTERNAL'] as const;
export interface InventoryItem {
  _id: string;
  location: string; roomName?: string; floorLevel?: string; category: string; item?: string; description?: string;
  roomDimension?: string; brandName?: string; quantity?: number; quantityNotFunctioning?: number;
  dimensionOfDamage?: string; hasDefect?: boolean; comment?: string; sourceRow?: number;
}
export type InventoryDraft = Omit<InventoryItem, '_id'>;

export const listInventory = (id: string) =>
  api<{ items: InventoryItem[] }>(`/assets/${enc(id)}/inventory`).then(r => r.items || []);
export const addInventoryItem = (id: string, item: Partial<InventoryDraft>) =>
  api<{ item: InventoryItem }>(`/assets/${enc(id)}/inventory`, { method: 'POST', body: item }).then(r => r.item);
export const updateInventoryItem = (id: string, itemId: string, patch: Partial<InventoryDraft>) =>
  api<{ item: InventoryItem }>(`/assets/${enc(id)}/inventory/${enc(itemId)}`, { method: 'PUT', body: patch }).then(r => r.item);
export const deleteInventoryItem = (id: string, itemId: string) =>
  api(`/assets/${enc(id)}/inventory/${enc(itemId)}`, { method: 'DELETE' });
export function previewInventoryImport(id: string, file: File) {
  const fd = new FormData(); fd.append('file', file);
  return api<{ drafts: InventoryDraft[]; warnings: string[]; total: number; filename: string }>(`/assets/${enc(id)}/inventory/import-preview`, { method: 'POST', body: fd });
}
export const commitInventoryImport = (id: string, items: InventoryDraft[], sourceFilename: string) =>
  api<{ inserted: number; total: number }>(`/assets/${enc(id)}/inventory/import-commit`, { method: 'POST', body: { items, sourceFilename } });
export const exportInventory = (id: string) => downloadFile(`/assets/${enc(id)}/inventory/export`, `${id}_inventory.xlsx`);

// ── M&E reports ───────────────────────────────────────────────────────────────
export const ME_TYPES = [['secretariat', 'Secretariat'], ['nhp', 'NHP'], ['others', 'Other (custom tasks)']] as const;
export const ME_RATINGS = ['Very Good', 'Good', 'Fair', 'Poor'] as const;
export const ME_STATUSES = ['Draft', 'Submitted', 'Cleared', 'Not Cleared'] as const;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface MeReport {
  _id: string;
  reportType: string; reportMonth: number; reportYear: number;
  contractNo?: string; contractorName?: string; contractorAddress?: string; contractSum?: number;
  contractPeriod?: string; commencementDate?: string; completionPeriod?: string; reportLocation?: string;
  tasks?: { label: string; percentage: number }[]; overallPercentage?: number;
  labourRating?: string; materialsRating?: string; progressRating?: string; workmanshipRating?: string; otherComments?: string;
  craName?: string; craDesignation?: string; craDate?: string;
  clearanceIssued?: boolean; clearanceDate?: string; clearanceMonth?: string; satisfactory?: boolean; unsatisfactoryWorks?: string;
  facilityManagerName?: string; facilityManagerDesig?: string; facilityManagerDate?: string;
  status: string; submittedAt?: string; createdAt?: string;
  // Present on the cross-asset listing
  _assetId?: string; _assetName?: string; _assetType?: string; _assetState?: string;
}
export interface MeSummary { total: number; draft: number; submitted: number; cleared: number; notCleared: number }

export const getAssetMeReports = (id: string) =>
  api<{ reports: MeReport[]; assetName?: string }>(`/assets/${enc(id)}/me-reports`).then(r => r.reports || []);
export const getAllMeReports = () => api<{ reports: MeReport[]; summary: MeSummary }>('/assets/me-reports/all');
export const getMeTemplates = () => api<{ secretariat: string[]; nhp: string[] }>('/assets/me-reports/templates');
export const createMeReport = (id: string, body: Partial<MeReport>) =>
  api<{ report: MeReport }>(`/assets/${enc(id)}/me-reports`, { method: 'POST', body: { ...body } }).then(r => r.report);
export const updateMeReport = (id: string, rid: string, body: Partial<MeReport>) =>
  api<{ report: MeReport }>(`/assets/${enc(id)}/me-reports/${enc(rid)}`, { method: 'PATCH', body: { ...body } }).then(r => r.report);
export const deleteMeReport = (id: string, rid: string) => api(`/assets/${enc(id)}/me-reports/${enc(rid)}`, { method: 'DELETE' });
export function uploadMePhoto(assetId: string, file: File, meReportId: string) {
  const fd = new FormData(); fd.append('photo', file); fd.append('meReportId', meReportId);
  return api(`/assets/${enc(assetId)}/photos`, { method: 'POST', body: fd });
}
