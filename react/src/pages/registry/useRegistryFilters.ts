import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Asset } from '../../types';
import { CONDITION_RANK, normalizeState } from '../../lib/assets';

export interface Filters {
  q: string; type: string; condition: string; assessed: string;
  geom: string; state: string; mda: string; sort: string; photosFirst: boolean;
}

export const DEFAULT_SORT = 'createdAt_asc';

export const SORT_OPTIONS: [string, string][] = [
  ['createdAt_asc', '↑ Oldest first'], ['createdAt_desc', '↓ Newest first'],
  ['name_asc', 'A→Z Name'], ['name_desc', 'Z→A Name'], ['state_asc', 'A→Z State'],
  ['condition_asc', 'Condition: Best'], ['condition_desc', 'Condition: Worst'],
  ['photos_desc', 'Most photos'], ['assetId_asc', 'ID ascending'], ['assetId_desc', 'ID descending'],
];

const photoCount = (a: Asset) => a.photos?.length || 0;

function sortValue(a: Asset, field: string): number | string {
  switch (field) {
    case 'createdAt': return a.createdAt ? new Date(a.createdAt).getTime() : 0;
    case 'condition': return CONDITION_RANK[a.condition || ''] ?? 4;   // severity, unset last
    case 'photos':    return photoCount(a);
    case 'assetId':   return a.assetId || '';
    case 'state':     return a.state || '';
    default:          return a.name || '';
  }
}

function compare(a: Asset, b: Asset, sort: string): number {
  const [field, dir] = sort.split('_');
  const va = sortValue(a, field), vb = sortValue(b, field);
  const d = dir === 'desc' ? -1 : 1;
  if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * d;
  // numeric:true → AST-999 before AST-1001
  return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * d;
}

export function useRegistryFilters() {
  const [params, setParams] = useSearchParams();

  const filters: Filters = {
    q: params.get('q') || '', type: params.get('type') || '', condition: params.get('condition') || '',
    assessed: params.get('assessed') || '', geom: params.get('geom') || '', state: params.get('state') || '',
    mda: params.get('mda') || '', sort: params.get('sort') || DEFAULT_SORT, photosFirst: params.get('photos') === '1',
  };

  const setFilter = (key: keyof Filters, value: string | boolean) => {
    const next = new URLSearchParams(params);
    const paramKey = key === 'photosFirst' ? 'photos' : key;
    const v = typeof value === 'boolean' ? (value ? '1' : '') : value;
    if (v && !(key === 'sort' && v === DEFAULT_SORT)) next.set(paramKey, v); else next.delete(paramKey);
    setParams(next, { replace: true });
  };

  const clear = () => setParams(new URLSearchParams(), { replace: true });

  /** Filters the backend export endpoint understands (search is client-only). */
  const exportFilters = () => {
    const f: Record<string, string> = {};
    if (filters.type) f.type = filters.type;
    if (filters.condition) f.condition = filters.condition;
    if (filters.assessed) f.assessed = filters.assessed;
    if (filters.geom) f.geomType = filters.geom;
    if (filters.state) f.state = filters.state;
    if (filters.mda) f.mda = filters.mda;
    return f;
  };

  return { filters, setFilter, clear, exportFilters };
}

export function useFilteredAssets(all: Asset[], f: Filters): Asset[] {
  return useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const wantState = normalizeState(f.state);
    const list = all.filter(a => {
      if (q && ![a.name, a.assetId, a.assetCode, a.mda, a.address, a.state, a.lga, a.type, a.notes]
        .some(v => (v || '').toLowerCase().includes(q))) return false;
      if (f.type && a.type !== f.type) return false;
      if (f.condition && a.condition !== f.condition) return false;
      if (f.assessed && (a.assessed || 'Unassessed') !== f.assessed) return false;
      if (f.geom && a.geomType !== f.geom) return false;
      if (wantState && normalizeState(a.state) !== wantState) return false;
      if (f.mda && a.mda !== f.mda) return false;
      return true;
    });
    return list.sort((a, b) =>
      (f.photosFirst ? photoCount(b) - photoCount(a) : 0) || compare(a, b, f.sort));
  }, [all, f.q, f.type, f.condition, f.assessed, f.geom, f.state, f.mda, f.sort, f.photosFirst]);
}
