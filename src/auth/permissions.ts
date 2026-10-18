import type { User } from '../types';

// Same defaults as the legacy dashboard (js/app.js ROLE_DEFAULTS). The backend
// enforces the real permissions; these only decide what the UI shows.
export type Perm =
  | 'canCreate' | 'canEdit' | 'canDelete' | 'canExport' | 'canViewAll'
  | 'canManageUsers' | 'canViewAudit' | 'canManageSettings' | 'canApprove' | 'canEditInventory';

const ROLE_DEFAULTS: Record<string, Partial<Record<Perm, boolean>>> = {
  'System Admin': { canCreate: true,  canEdit: true,  canDelete: true,  canExport: true,  canViewAll: true,  canManageUsers: true,  canViewAudit: true,  canManageSettings: true,  canApprove: true,  canEditInventory: true },
  'Supervisor':   { canCreate: true,  canEdit: true,  canDelete: true,  canExport: true,  canViewAll: true,  canManageUsers: false, canViewAudit: true,  canManageSettings: false, canApprove: true,  canEditInventory: true },
  'Sub-Head':     { canCreate: true,  canEdit: false, canDelete: false, canExport: false, canViewAll: true,  canManageUsers: false, canViewAudit: false, canManageSettings: false, canApprove: true,  canEditInventory: true },
  'GIS Analyst':  { canCreate: false, canEdit: false, canDelete: false, canExport: true,  canViewAll: true,  canManageUsers: false, canViewAudit: true,  canManageSettings: false, canApprove: false, canEditInventory: false },
  'Field Agent':  { canCreate: false, canEdit: false, canDelete: false, canExport: false, canViewAll: false, canManageUsers: false, canViewAudit: false, canManageSettings: false, canApprove: false, canEditInventory: true },
};

export function permsFor(user: User | null): Partial<Record<Perm, boolean>> {
  if (!user) return {};
  const defaults = ROLE_DEFAULTS[user.role] || {};
  // System Admin defaults are absolute so a bad override can't lock them out.
  if (user.role === 'System Admin') return { ...defaults };
  return { ...defaults, ...(user.permissions || {}) };
}
