import { api } from './client';

const enc = encodeURIComponent;

export const ROLES = ['Field Agent', 'Sub-Head', 'Supervisor', 'GIS Analyst', 'System Admin', 'MDA Agent'] as const;
export const DIVISIONS = [
  'Assets & Condition', 'Monitoring & Evaluation', 'Planning & Design',
  'Rehabilitation & Restoration', 'Building Training & Maintenance',
] as const;
export const ZONES = ['North Central', 'North East', 'North West', 'South East', 'South South', 'South West'] as const;
/** Roles that span every division. */
export const CROSS_DIVISION = ['Supervisor', 'System Admin'];

// Short permission keys, as stored on users and role configs.
export const PERM_KEYS = [
  'canCreate', 'canEdit', 'canDelete', 'canApprove', 'canExport', 'canViewAll',
  'canManageUsers', 'canViewAudit', 'canManageSettings', 'canEditInventory',
  'canSubmitFormRequests', 'canReviewFormRequests',
] as const;
export type PermKey = typeof PERM_KEYS[number];
export const PERM_LABELS: Record<PermKey, string> = {
  canCreate: 'Create assets', canEdit: 'Edit assets', canDelete: 'Delete assets', canApprove: 'Approve captures',
  canExport: 'Export data', canViewAll: 'View all assets', canManageUsers: 'Manage users', canViewAudit: 'View audit log',
  canManageSettings: 'Manage settings', canEditInventory: 'Edit inventory',
  canSubmitFormRequests: 'Submit form requests', canReviewFormRequests: 'Review form requests',
};

export interface ManagedUser {
  _id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  division?: string | null;
  mda?: string | null;
  zone?: string;
  states?: string[];
  color?: string;
  permissions?: Partial<Record<PermKey, boolean>>;
  isActive?: boolean;
  stats?: { assetsCreated?: number; lastActiveAt?: string };
  createdAt?: string;
  phone?: string | null;
  mfa?: { enabled?: boolean; enabledAt?: string };
}

export const listUsers = () =>
  api<{ users: ManagedUser[]; total: number }>('/users?limit=1000').then(r => r.users || []);
/** `emailed` is set when the body asked for `sendCredentials`. */
export const createUser = (body: Record<string, unknown>) =>
  api<{ user: ManagedUser; emailed?: boolean; emailError?: string }>('/users', { method: 'POST', body });
export const updateUser = (id: string, body: Record<string, unknown>) =>
  api<{ user: ManagedUser }>(`/users/${enc(id)}`, { method: 'PUT', body }).then(r => r.user);
export const setUserPermissions = (id: string, perms: Partial<Record<PermKey, boolean>>) =>
  api<{ user: ManagedUser }>(`/users/${enc(id)}/permissions`, { method: 'PUT', body: perms }).then(r => r.user);
export const deactivateUser = (id: string) => api(`/users/${enc(id)}`, { method: 'DELETE' });
/** Admin reset. Omit `password` to have one generated (returned as tempPassword). */
export interface ResetResult { tempPassword?: string; emailed?: boolean; emailError?: string }
export const resetPassword = (id: string, opts: { password?: string; sendEmail?: boolean } = {}) =>
  api<ResetResult>(`/users/${enc(id)}/reset-password`, { method: 'POST', body: opts });

// ── Own account ───────────────────────────────────────────────────────────────
export const forgotPassword = (email: string) =>
  api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
export const resetPasswordWithToken = (token: string, password: string) =>
  api<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, password } });
/** Other devices are signed out; the response carries a fresh token for this one. */
export const changePassword = (currentPassword: string, newPassword: string) =>
  api<{ message: string; token?: string }>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
/** Admin: turn off a user's two-step sign-in (lost phone). */
export const resetUserMfa = (id: string) => api(`/users/${enc(id)}/reset-mfa`, { method: 'POST' });

// ── Role defaults ─────────────────────────────────────────────────────────────
export interface RoleConfig { role: string; defaults: Record<PermKey, boolean> }
export const getRoleConfigs = () => api<{ configs: RoleConfig[] }>('/users/role-config').then(r => r.configs || []);
export const saveRoleConfig = (role: string, defaults: Record<PermKey, boolean>) =>
  api(`/users/role-config/${enc(role)}`, { method: 'PUT', body: { defaults } });
export const resetRoleConfigs = () => api('/users/role-config/reset', { method: 'POST' });

// ── Audit log ─────────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  _id: string;
  action: string;
  entityId?: string;
  entityType?: string;
  detail?: string;
  ipAddress?: string;
  userAgent?: string;
  performedBy?: { _id?: string; name?: string; email?: string; role?: string } | null;
  ts: string;
}
export interface AuditQuery { action?: string; entityType?: string; entity?: string; from?: string; to?: string; page?: number; limit?: number }

export function listAudit(q: AuditQuery) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') qs.set(k, String(v));
  return api<{ logs: AuditLogEntry[]; total: number; page: number; pages: number }>(`/audit?${qs}`);
}

// Mirrors AuditLog.ACTIONS in the backend.
export const AUDIT_ACTIONS = [
  'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DELETED', 'ASSET_SUBMITTED', 'ASSET_APPROVED', 'ASSET_REJECTED',
  'ASSET_LINKED', 'ASSET_UNLINKED', 'LIFECYCLE_TRANSITION', 'BULK_UPDATE', 'BULK_DELETE',
  'PHOTO_UPLOADED', 'PHOTO_DELETED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'EXCEL_UPLOADED',
  'MAINTENANCE_LOGGED', 'MAINTENANCE_DELETED', 'VALUATION_UPDATED',
  'INSPECTION_SCHEDULED', 'INSPECTION_SUBMITTED', 'INSPECTION_APPROVED', 'INSPECTION_REJECTED',
  'INVENTORY_ITEM_ADDED', 'INVENTORY_ITEM_UPDATED', 'INVENTORY_ITEM_DELETED', 'INVENTORY_IMPORTED', 'INVENTORY_EXPORTED',
  'ME_REPORT_SUBMITTED', 'ME_REPORT_UPDATED', 'ME_REPORT_DELETED',
  'FORM_REQUEST_SUBMITTED', 'FORM_REQUEST_UPDATED', 'FORM_REQUEST_ATTACHMENT_ADDED', 'FORM_REQUEST_DELETED',
  'CERTIFICATE_ISSUED', 'CERTIFICATE_PHYSICAL_COPY_ISSUED',
  'USER_CREATED', 'USER_UPDATED', 'USER_REMOVED', 'USER_LOGIN', 'USER_LOGOUT',
  'EXPORT', 'BULK_EXPORT', 'OCR_SCAN', 'OCR_IMPORT', 'SETTINGS_CHANGED', 'ROLE_CONFIG_CHANGED',
] as const;
export const AUDIT_ENTITY_TYPES = ['Asset', 'User', 'Inspection', 'FormRequest', 'RoleConfig', 'System'] as const;

// ── Access requests (public site's "Request access" form) ────────────────────
export interface AccessRequest {
  _id: string; name: string; email: string; organisation: string; requestedRole: string; reason: string;
  status: 'pending' | 'approved' | 'declined'; note: string; decidedByName: string; decidedAt: string | null; createdAt: string;
}
export const listAccessRequests = () =>
  api<{ requests: AccessRequest[]; counts: Record<string, number> }>('/access-requests');
export const decideAccessRequest = (id: string, status: 'approved' | 'declined', note = '') =>
  api<{ request: AccessRequest }>(`/access-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status, note } });
