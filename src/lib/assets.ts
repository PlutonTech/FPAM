import type { Asset, UserRef } from '../types';

// Mirrors the backend Asset schema enums (src/models/Asset.js).
export const ASSET_TYPES = [
  'Infrastructure', 'Land / Property', 'Utility', 'Environmental', 'Equipment', 'Monument',
  'Administrative Office', 'Residential', 'Hospital', 'School', 'Laboratory',
  'Warehouse', 'Court', 'Security Facility',
] as const;
export const CONDITIONS = ['Good', 'Fair', 'Poor', 'Critical'] as const;
export const STATUSES   = ['Active', 'Under Maintenance', 'Decommissioned', 'Disputed', 'Recovered'] as const;
export const ASSESSED   = ['Assessed', 'Unassessed'] as const;
export const GEOM_TYPES = ['Point', 'Polygon', 'Linear'] as const;
export const SECTORS = [
  'Administration & Governance', 'Defence & Security', 'Education', 'Health', 'Infrastructure & Works',
  'Energy & Power', 'Agriculture & Food Security', 'Water Resources', 'Transportation', 'Finance & Economy',
  'Justice & Legal Affairs', 'Environment', 'Communications & Digital', 'Social Development',
  'Science & Technology', 'Trade & Investment', 'Petroleum & Mineral Resources', 'Labour & Employment',
  'Foreign Affairs', 'Culture, Tourism & Sports',
] as const;
// The backend valuation validator only accepts these three.
export const VALUATION_METHODS = ['Replacement Cost', 'Market Comparable', 'Depreciated'] as const;

export const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna',
  'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'FCT',
];
const STATE_LOOKUP = new Map<string, string>([
  ...NIGERIA_STATES.map(s => [s.toLowerCase(), s] as [string, string]),
  ['abuja', 'FCT'], ['fct, abuja', 'FCT'], ['fct abuja', 'FCT'], ['akwa-ibom', 'Akwa Ibom'], ['cross-river', 'Cross River'],
]);

/** Canonical state name, or null if the value isn't a Nigerian state. */
export function normalizeState(raw?: string | null): string | null {
  if (!raw) return null;
  return STATE_LOOKUP.get(String(raw).trim().toLowerCase()) || null;
}

export type Tone = 'green' | 'blue' | 'orange' | 'warn' | 'red' | 'gray';

export function conditionTone(c?: string | null): Tone {
  return ({ Good: 'green', Fair: 'warn', Poor: 'orange', Critical: 'red' } as Record<string, Tone>)[c || ''] || 'gray';
}

export function typeTone(t?: string): Tone {
  const m: Record<string, Tone> = {
    'Infrastructure': 'blue', 'Land / Property': 'green', 'Utility': 'orange', 'Environmental': 'green',
    'Equipment': 'gray', 'Monument': 'warn', 'Administrative Office': 'blue', 'Residential': 'green',
    'Hospital': 'red', 'School': 'blue', 'Laboratory': 'orange', 'Warehouse': 'gray',
    'Court': 'warn', 'Security Facility': 'red',
  };
  return m[t || ''] || 'gray';
}

export const assetKey = (a: Asset) => a.assetId || a._id;

export function capturedByName(a: Asset): string {
  if (a.agent) return a.agent;
  const c = a.capturedBy;
  return c && typeof c === 'object' ? (c as UserRef).name || '—' : '—';
}

export function coords(a: Asset): { lat: number; lng: number } | null {
  const lat = a.lat ?? a.location?.coordinates?.[1];
  const lng = a.lng ?? a.location?.coordinates?.[0];
  return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
}

export function formatDate(raw?: string | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatNaira(n?: number | null): string {
  return n == null ? '—' : '₦' + Number(n).toLocaleString('en-NG');
}

/** Same scoring as the legacy dashboard (js/asset_detail.js calcRiskScore). */
export function riskScore(a: Asset): number {
  let score = 0;
  if (a.condition === 'Critical') score += 40;
  else if (a.condition === 'Poor') score += 25;
  else if (a.condition === 'Fair') score += 10;
  if (a.nextInspection) {
    const daysLeft = Math.round((new Date(a.nextInspection).getTime() - Date.now()) / 86400000);
    if (daysLeft < 0) score += 30;
    else if (daysLeft < 30) score += 15;
  }
  if (a.type === 'Infrastructure') score += 10;
  else if (a.type === 'Utility') score += 8;
  return Math.min(score, 100);
}

export const CONDITION_RANK: Record<string, number> = { Good: 0, Fair: 1, Poor: 2, Critical: 3 };

// ── Completeness (same fields as legacy js/completeness.js) ───────────────────
export const COMPLETENESS_FIELDS: { key: string; label: string; check: (a: Asset) => boolean }[] = [
  { key: 'location',    label: 'GPS Coordinates', check: a => !!coords(a) },
  { key: 'condition',   label: 'Condition',       check: a => !!a.condition },
  { key: 'sector',      label: 'Sector',          check: a => !!a.sector },
  { key: 'mda',         label: 'MDA / Agency',    check: a => !!a.mda },
  { key: 'state',       label: 'State',           check: a => !!a.state },
  { key: 'address',     label: 'Address',         check: a => !!a.address },
  { key: 'photos',      label: 'Photos',          check: a => !!a.photos?.length },
  { key: 'valuation',   label: 'Valuation',       check: a => !!a.valuation?.amount },
  { key: 'captureDate', label: 'Capture Date',    check: a => !!a.captureDate },
  { key: 'assessed',    label: 'Assessed',        check: a => a.assessed === 'Assessed' },
];

function groupScore(items: Asset[]): number {
  return Math.round(COMPLETENESS_FIELDS.reduce((s, f) => s + items.filter(f.check).length / items.length * 100, 0) / COMPLETENESS_FIELDS.length);
}

export function computeCompleteness(list: Asset[]) {
  if (!list.length) return { overall: 0, byField: [], byMda: [] as { name: string; count: number; score: number }[] };
  const byField = COMPLETENESS_FIELDS.map(f => {
    const filled = list.filter(f.check).length;
    return { ...f, filled, pct: Math.round(filled / list.length * 100) };
  });
  const overall = Math.round(byField.reduce((s, f) => s + f.pct, 0) / byField.length);
  const groups = new Map<string, Asset[]>();
  list.forEach(a => { const k = a.mda || 'Unassigned'; groups.set(k, [...(groups.get(k) || []), a]); });
  const byMda = [...groups].map(([name, items]) => ({ name, count: items.length, score: groupScore(items) }))
    .sort((a, b) => a.score - b.score);
  return { overall, byField, byMda };
}

export function scoreColor(pct: number): string {
  return pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
}

export function timeAgo(raw?: string | null): string {
  if (!raw) return '—';
  const t = new Date(raw).getTime();
  if (isNaN(t)) return '—';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  return formatDate(raw);
}

/** ₦1.2B / ₦340.5M / ₦12,000 */
export function compactNaira(n?: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(1)}M`;
  return formatNaira(n);
}

// Status colours (good / warning / serious / critical). Always shown with a
// text label beside them — never as the only cue.
export const CONDITION_COLORS: Record<string, string> = {
  Good: '#0ca30c', Fair: '#fab219', Poor: '#ec835a', Critical: '#d03b3b',
};
