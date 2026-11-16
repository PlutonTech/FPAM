import type { User } from '../types';

// Based on the legacy dashboard's ROLE_DEFAULTS, corrected to match the backend
// (resolvePermissions.js): Field Agents CAN create assets there, but the legacy
// table said they couldn't, hiding "New Asset" from the main capturers.
// The backend enforces the real permissions; these only decide what the UI shows.
export type Perm =
  | 'canCreate' | 'canEdit' | 'canDelete' | 'canExport' | 'canViewAll'
  | 'canManageUsers' | 'canViewAudit' | 'canManageSettings' | 'canApprove' | 'canEditInventory'
  | 'canSubmitFormRequests' | 'canReviewFormRequests';

const ROLE_DEFAULTS: Record<string, Partial<Record<Perm, boolean>>> = {
  'System Admin': { canCreate: true,  canEdit: true,  canDelete: true,  canExport: true,  canViewAll: true,  canManageUsers: true,  canViewAudit: true,  canManageSettings: true,  canApprove: true,  canEditInventory: true, canSubmitFormRequests: true,  canReviewFormRequests: true },
  'Supervisor':   { canCreate: true,  canEdit: true,  canDelete: true,  canExport: true,  canViewAll: true,  canManageUsers: false, canViewAudit: true,  canManageSettings: false, canApprove: true,  canEditInventory: true, canSubmitFormRequests: true,  canReviewFormRequests: true },
  'Sub-Head':     { canCreate: true,  canEdit: false, canDelete: false, canExport: false, canViewAll: true,  canManageUsers: false, canViewAudit: false, canManageSettings: false, canApprove: true,  canEditInventory: true, canSubmitFormRequests: true,  canReviewFormRequests: true },
  'GIS Analyst':  { canCreate: false, canEdit: false, canDelete: false, canExport: true,  canViewAll: true,  canManageUsers: false, canViewAudit: true,  canManageSettings: false, canApprove: false, canEditInventory: false, canSubmitFormRequests: true,  canReviewFormRequests: false },
  'Field Agent':  { canCreate: true,  canEdit: false, canDelete: false, canExport: false, canViewAll: false, canManageUsers: false, canViewAudit: false, canManageSettings: false, canApprove: false, canEditInventory: true, canSubmitFormRequests: true,  canReviewFormRequests: false },
};

/** M&E reports page: M&E division, cross-division staff, Supervisors and System Admins. */
export const canViewMe = (u: User | null) =>
  !!u && (u.role === 'System Admin' || u.role === 'Supervisor' || u.division === 'Monitoring & Evaluation' || u.division === 'All');
/** Filing / clearing M&E reports — mirrors requireMeDivision in the backend. */
export const canFileMe = (u: User | null) =>
  !!u && (u.role === 'System Admin' || u.division === 'Monitoring & Evaluation' || u.division === 'All');

export function permsFor(user: User | null): Partial<Record<Perm, boolean>> {
  if (!user) return {};
  const defaults = ROLE_DEFAULTS[user.role] || {};
  // System Admin defaults are absolute so a bad override can't lock them out.
  if (user.role === 'System Admin') return { ...defaults };
  return { ...defaults, ...(user.permissions || {}) };
}

/** Building Training & Maintenance changes — mirrors canManage in the backend's btm_routes.js. */
export const canManageBtm = (u: User | null) =>
  !!u && (u.role === 'System Admin' || u.division === 'Building Training & Maintenance' || u.division === 'All');
