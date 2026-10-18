import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import { AssessedTag, ConditionTag, GeomIcon, RiskBadge, TypeTag } from '../../components/Tags';
import type { Asset } from '../../types';
import {
  ASSESSED, ASSET_TYPES, CONDITIONS, GEOM_TYPES, NIGERIA_STATES,
  assetKey, capturedByName, formatDate, normalizeState,
} from '../../lib/assets';
import { SORT_OPTIONS, useFilteredAssets, useRegistryFilters } from './useRegistryFilters';
import EditAssetModal from './EditAssetModal';
import SetConditionModal from './SetConditionModal';
import BulkUpdateModal from './BulkUpdateModal';
import CompletenessModal from './CompletenessModal';
import PercentExportModal from './PercentExportModal';
import { openDeferredMaintenanceReport } from './deferredReport';

const PAGE_SIZE = 50;
type ModalState =
  | { kind: 'edit'; asset: Asset } | { kind: 'condition' } | { kind: 'bulk' }
  | { kind: 'completeness' } | { kind: 'percent' } | null;

export default function RegistryPage() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { filters, setFilter, clear, exportFilters } = useRegistryFilters();

  const [all, setAll] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mdas, setMdas] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      setAll(await assetsApi.fetchAllAssets());
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); assetsApi.getMdaNames().then(setMdas); }, [load]);

  const filtered = useFilteredAssets(all, filters);

  // Back to page 1 whenever the filtered set changes shape.
  useEffect(() => { setPage(1); }, [filters.q, filters.type, filters.condition, filters.assessed,
    filters.geom, filters.state, filters.mda, filters.sort, filters.photosFirst]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    const states = [...new Set(filtered.map(a => normalizeState(a.state)).filter(Boolean) as string[])].sort();
    return {
      total: filtered.length,
      states,
      lgas: new Set(filtered.map(a => a.lga).filter(Boolean)).size,
      good: filtered.filter(a => a.condition === 'Good').length,
      critical: filtered.filter(a => a.condition === 'Critical').length,
    };
  }, [filtered]);

  const byKey = useMemo(() => new Map(all.map(a => [assetKey(a), a])), [all]);

  // ── Selection ───────────────────────────────────────────────────────────
  const toggle = (id: string, on: boolean) => setSelected(s => {
    const n = new Set(s); if (on) n.add(id); else n.delete(id); return n;
  });
  const pageIds = pageItems.map(assetKey);
  const pageAllSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const togglePage = (on: boolean) => setSelected(s => {
    const n = new Set(s); pageIds.forEach(id => on ? n.add(id) : n.delete(id)); return n;
  });

  // ── Actions ─────────────────────────────────────────────────────────────
  async function remove(id: string) {
    if (!confirm(`Delete asset ${id}? This cannot be undone.`)) return;
    try {
      await assetsApi.deleteAsset(id);
      setAll(list => list.filter(a => assetKey(a) !== id));
      toggle(id, false);
      toast('Asset deleted');
    } catch (err) { toast(`Delete failed: ${errorMessage(err)}`, 'error'); }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!confirm(`Delete ${ids.length} assets? This cannot be undone.`)) return;
    const failures: string[] = []; const deleted: string[] = [];
    for (const id of ids) {
      try { await assetsApi.deleteAsset(id); deleted.push(id); }
      catch (err) { failures.push(`${id}: ${errorMessage(err)}`); }
    }
    const gone = new Set(deleted);
    setAll(list => list.filter(a => !gone.has(assetKey(a))));
    setSelected(s => new Set([...s].filter(id => !gone.has(id))));
    if (failures.length) toast(`${deleted.length} deleted, ${failures.length} failed — ${failures[0]}`, 'error');
    else toast(`${deleted.length} asset${deleted.length === 1 ? '' : 's'} deleted`);
  }

  async function runExport(fn: () => Promise<void>) {
    try { await fn(); } catch (err) { toast(errorMessage(err), 'error'); }
  }

  // Export what's on screen: backend filters, or exact IDs when a search is active.
  const exportAll = (fmt: assetsApi.ExportFormat) => {
    setExportOpen(false);
    runExport(() => filters.q.trim()
      ? assetsApi.exportIds(fmt, filtered.map(assetKey))
      : assetsApi.exportFiltered(fmt, exportFilters()));
  };
  const exportSelected = (fmt: assetsApi.ExportFormat) => runExport(() => assetsApi.exportIds(fmt, [...selected]));

  const replaceAsset = (updated: Asset) =>
    setAll(list => list.map(a => (assetKey(a) === assetKey(updated) ? { ...a, ...updated } : a)));

  const sortTh = (field: string, label: string) => {
    const [cur, dir] = filters.sort.split('_');
    const active = cur === field;
    const next = active && dir === 'asc' ? `${field}_desc` : `${field}_asc`;
    return (
      <th key={field} className="sortable" onClick={() => setFilter('sort', next)} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {label} <i className={`fa-solid ${active ? (dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`} style={{ opacity: active ? 1 : .35, fontSize: 9 }} />
      </th>
    );
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Asset Registry</h1>
          <div className="page-sub">Verified federal public assets</div>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ kind: 'percent' })}>
            <i className="fa-solid fa-percent" /> Percentage export
          </button>
          {can('canExport') && (
            <div className="menu-wrap">
              <button className="btn btn-ghost btn-sm" onClick={() => setExportOpen(o => !o)}>
                <i className="fa-solid fa-download" /> Export <i className="fa-solid fa-chevron-down" style={{ fontSize: 9 }} />
              </button>
              {exportOpen && (
                <div className="menu" onMouseLeave={() => setExportOpen(false)}>
                  <button onClick={() => exportAll('csv')}><i className="fa-solid fa-file-csv" /> CSV</button>
                  <button onClick={() => exportAll('xlsx')}><i className="fa-solid fa-file-excel" /> XLSX</button>
                  <button onClick={() => exportAll('geojson')}><i className="fa-solid fa-map" /> GeoJSON</button>
                  <button onClick={() => exportAll('pdf')}><i className="fa-solid fa-file-pdf" /> PDF</button>
                </div>
              )}
            </div>
          )}
          {can('canCreate') && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/capture')}>
              <i className="fa-solid fa-plus" /> New Asset
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search">
          <i className="fa-solid fa-magnifying-glass" />
          <input className="filter-input" placeholder="Search name, ID, MDA, LGA, notes…" value={filters.q}
                 onChange={e => setFilter('q', e.target.value)} aria-label="Search assets" />
        </div>
        <select className="filter-input" value={filters.type} onChange={e => setFilter('type', e.target.value)} aria-label="Type">
          <option value="">All Types</option>{ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="filter-input" value={filters.condition} onChange={e => setFilter('condition', e.target.value)} aria-label="Condition">
          <option value="">All Conditions</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="filter-input" value={filters.assessed} onChange={e => setFilter('assessed', e.target.value)} aria-label="Assessment">
          <option value="">All Assessments</option>{ASSESSED.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="filter-input" value={filters.geom} onChange={e => setFilter('geom', e.target.value)} aria-label="Geometry">
          <option value="">All Geometry</option>{GEOM_TYPES.map(g => <option key={g}>{g}</option>)}
        </select>
        <select className="filter-input" value={filters.state} onChange={e => setFilter('state', e.target.value)} aria-label="State">
          <option value="">All States</option>{NIGERIA_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-input" value={filters.mda} onChange={e => setFilter('mda', e.target.value)} aria-label="MDA" style={{ maxWidth: 260 }}>
          <option value="">All MDAs</option>{mdas.map(m => <option key={m}>{m}</option>)}
        </select>
        <select className="filter-input" value={filters.sort} onChange={e => setFilter('sort', e.target.value)} aria-label="Sort">
          {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="check-label">
          <input type="checkbox" checked={filters.photosFirst} onChange={e => setFilter('photosFirst', e.target.checked)} />
          <i className="fa-solid fa-camera" /> Photos first
        </label>
        <button className="btn btn-ghost btn-sm" onClick={clear}><i className="fa-solid fa-xmark" /> Clear</button>
      </div>

      {/* Stats */}
      <div className="card stats-bar">
        <Stat icon="fa-database" value={stats.total} label="Assets" />
        <Stat icon="fa-location-dot" value={stats.states.length} label="States" />
        <Stat icon="fa-map-pin" value={stats.lgas} label="LGAs" />
        <Stat icon="fa-circle-check" value={stats.good} label="Good" color="var(--success)" />
        <Stat icon="fa-triangle-exclamation" value={stats.critical} label="Critical" color="var(--danger)" />
        <div className="stats-states">{stats.states.join(' · ')}</div>
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 && (
        <div className="sel-toolbar">
          <span className="sel-count">{selected.size} selected</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ kind: 'completeness' })}><i className="fa-solid fa-chart-bar" /> Completeness</button>
          {can('canEdit') && <button className="btn btn-secondary btn-sm" onClick={() => setModal({ kind: 'bulk' })}><i className="fa-solid fa-file-excel" /> Bulk Update</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => openDeferredMaintenanceReport(all)}><i className="fa-solid fa-file-pdf" /> Deferred Report</button>
          {can('canExport') && <>
            <button className="btn btn-secondary btn-sm" onClick={() => exportSelected('csv')}><i className="fa-solid fa-download" /> CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportSelected('xlsx')}><i className="fa-solid fa-file-excel" /> XLSX</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportSelected('pdf')}><i className="fa-solid fa-file-pdf" /> PDF</button>
          </>}
          {can('canEdit') && <button className="btn btn-secondary btn-sm" onClick={() => setModal({ kind: 'condition' })}><i className="fa-solid fa-pen" /> Set Condition</button>}
          {can('canDelete') && <button className="btn btn-danger btn-sm" onClick={bulkDelete}><i className="fa-solid fa-trash" /> Delete</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} aria-label="Clear selection"><i className="fa-solid fa-xmark" /></button>
        </div>
      )}

      {/* Table */}
      <div className="card table-wrap">
        {loading ? (
          <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading assets…</div>
        ) : loadError ? (
          <div className="empty-state">
            <div className="empty-icon"><i className="fa-solid fa-plug-circle-xmark" /></div>
            <div className="empty-title">Could not load assets</div>
            <div className="empty-sub">{loadError}</div>
            <button className="btn btn-secondary btn-sm" onClick={load}><i className="fa-solid fa-rotate" /> Retry</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={pageAllSelected} onChange={e => togglePage(e.target.checked)} aria-label="Select page" />
                </th>
                {sortTh('assetId', 'ID')}
                {sortTh('name', 'Name')}
                <th>Type</th>
                <th>Geometry</th>
                {sortTh('condition', 'Condition')}
                <th>State / LGA</th>
                <th>Assessed</th>
                <th>Risk</th>
                {sortTh('createdAt', 'Captured')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr><td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-icon"><i className="fa-solid fa-layer-group" /></div>
                    <div className="empty-title">No assets found</div>
                    <div className="empty-sub">Adjust filters or capture a new asset</div>
                  </div>
                </td></tr>
              ) : pageItems.map(a => {
                const id = assetKey(a);
                return (
                  <tr key={id}>
                    <td><input type="checkbox" checked={selected.has(id)} onChange={e => toggle(id, e.target.checked)} aria-label={`Select ${a.name}`} /></td>
                    <td className="id-cell">
                      {id}
                      {a.assetCode && a.assetCode !== id && <div style={{ fontSize: 9, opacity: .75 }}>{a.assetCode}</div>}
                    </td>
                    <td>
                      <Link to={`/assets/${encodeURIComponent(id)}`} style={{ color: 'inherit', textDecoration: 'none' }}><strong>{a.name}</strong></Link>
                      {a.mda && <div className="cell-sub">{a.mda}</div>}
                    </td>
                    <td><TypeTag value={a.type} /></td>
                    <td><GeomIcon geom={a.geomType} /> <span className="cell-sub">{a.geomType || '—'}</span></td>
                    <td><ConditionTag value={a.condition} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{[a.state, a.lga].filter(Boolean).join(' / ') || '—'}</td>
                    <td><AssessedTag value={a.assessed} /></td>
                    <td><RiskBadge asset={a} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {formatDate(a.createdAt || a.captureDate)}
                      <div className="cell-sub">{capturedByName(a)}</div>
                    </td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                        <Link className="btn btn-ghost btn-xs" to={`/assets/${encodeURIComponent(id)}`} title="View detail"><i className="fa-solid fa-eye" /></Link>
                        {can('canEdit') && <button className="btn btn-ghost btn-xs" onClick={() => setModal({ kind: 'edit', asset: a })} title="Edit"><i className="fa-solid fa-pen-to-square" /></button>}
                        {can('canDelete') && <button className="btn btn-danger btn-xs" onClick={() => remove(id)} title="Delete"><i className="fa-solid fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pager page={safePage} totalPages={totalPages} total={filtered.length} onPage={setPage} />

      {modal?.kind === 'edit' && (
        <EditAssetModal asset={modal.asset} mdas={mdas} onClose={() => setModal(null)}
                        onSaved={a => { replaceAsset(a); setModal(null); }} />
      )}
      {modal?.kind === 'condition' && (
        <SetConditionModal ids={[...selected]} byKey={byKey} onClose={() => setModal(null)}
                           onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.kind === 'bulk' && (
        <BulkUpdateModal all={all} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.kind === 'completeness' && (
        <CompletenessModal assets={filtered.filter(a => selected.has(assetKey(a)))} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'percent' && (
        <PercentExportModal onClose={() => setModal(null)} onExport={(fmt, ids) => runExport(() => assetsApi.exportIds(fmt, ids))} />
      )}
    </div>
  );
}

function Stat({ icon, value, label, color = 'var(--accent)' }: { icon: string; value: number; label: string; color?: string }) {
  return (
    <div className="stats-bar-item">
      <i className={`fa-solid ${icon}`} style={{ color, fontSize: 13 }} />
      <div><div className="stats-num">{value.toLocaleString()}</div><div className="stats-label">{label}</div></div>
    </div>
  );
}

function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return (
    <div className="pager">
      <div>{total ? `Showing ${from}–${to} of ${total.toLocaleString()} assets` : 'Showing 0 assets'}</div>
      {totalPages > 1 && (
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-xs" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><i className="fa-solid fa-angle-left" /></button>
          {pages.map((p, i) => (
            <span key={p} className="row" style={{ gap: 6 }}>
              {i > 0 && p - pages[i - 1] > 1 && <span>…</span>}
              <button className={`btn btn-ghost btn-xs${p === page ? ' active' : ''}`} onClick={() => onPage(p)}>{p}</button>
            </span>
          ))}
          <button className="btn btn-ghost btn-xs" disabled={page === totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><i className="fa-solid fa-angle-right" /></button>
        </div>
      )}
    </div>
  );
}
