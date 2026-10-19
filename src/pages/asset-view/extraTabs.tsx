import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as assetsApi from '../../api/assets';
import * as x from '../../api/extras';
import * as usersApi from '../../api/users';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ConditionTag, Tag, TypeTag } from '../../components/Tags';
import type { Asset } from '../../types';
import { assetKey, formatDate, formatNaira, timeAgo, type Tone } from '../../lib/assets';

const Loading = () => <div className="loading"><i className="fa-solid fa-spinner fa-spin" /></div>;
const Failed = ({ msg, retry }: { msg: string; retry: () => void }) => (
  <div className="empty-state"><div className="empty-title">Couldn't load this</div><div className="empty-sub">{msg}</div>
    <button className="btn btn-ghost btn-sm" onClick={retry}>Retry</button></div>
);

/** Small loader hook: fetch on mount / key change, expose reload. */
function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    fn().then(setData).catch(err => setError(errorMessage(err)));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}

// ── Relationships ────────────────────────────────────────────────────────────
export function RelationshipsTab({ asset, onChange }: { asset: Asset; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const key = assetKey(asset);
  const { data, error, reload } = useLoad(() => x.getRelationships(key), [key]);
  const [picking, setPicking] = useState(false);

  async function unlink(childId: string, name: string) {
    if (!confirm(`Unlink ${name}? It becomes an independent asset with its own code.`)) return;
    try { const r = await x.unlinkChild(key, childId); toast(`${name} unlinked${r.newChildCode ? ` — new code ${r.newChildCode}` : ''}`); reload(); onChange(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }

  if (error) return <Failed msg={error} retry={reload} />;
  if (!data) return <Loading />;
  const total = data.children.reduce((s, c) => s + (c.valuation?.amount || 0), 0);
  const isChild = !!data.parentId;

  return (
    <>
      <div className="meta-key" style={{ marginBottom: 8 }}>Parent</div>
      {data.parent ? (
        <div className="list-row" style={{ marginBottom: 18 }}>
          <i className="fa-solid fa-sitemap" style={{ color: 'var(--accent)' }} />
          <div className="list-main"><Link to={`/assets/${encodeURIComponent(data.parent.assetId)}`}><strong>{data.parent.name}</strong></Link>
            <div className="id-cell" style={{ maxWidth: 'none' }}>{data.parent.assetId}</div></div>
          <TypeTag value={data.parent.type} /><ConditionTag value={data.parent.condition} />
        </div>
      ) : <div className="cell-sub" style={{ marginBottom: 18 }}>This asset is not part of another asset.</div>}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="meta-key">Components ({data.children.length}){total ? ` · combined value ${formatNaira(total)}` : ''}</div>
        {can('canEdit') && !isChild && <button className="btn btn-secondary btn-xs" onClick={() => setPicking(true)}><i className="fa-solid fa-link" /> Link a component</button>}
      </div>
      {isChild && <div className="cell-sub" style={{ marginBottom: 8 }}>Components can't have their own components (one level only).</div>}
      {data.children.length === 0 ? <div className="cell-sub">No components linked.</div> : (
        <div className="list">
          {data.children.map(c => (
            <div className="list-row" key={c.assetId}>
              <div className="list-main"><Link to={`/assets/${encodeURIComponent(c.assetId)}`}><strong>{c.name}</strong></Link>
                <div className="id-cell" style={{ maxWidth: 'none' }}>{c.assetId}</div></div>
              <TypeTag value={c.type} /><ConditionTag value={c.condition} />
              {c.valuation?.amount ? <span style={{ fontWeight: 700, fontSize: 12 }}>{formatNaira(c.valuation.amount)}</span> : null}
              {can('canEdit') && <button className="btn btn-ghost btn-xs" onClick={() => unlink(c.assetId, c.name)} title="Unlink"><i className="fa-solid fa-link-slash" /></button>}
            </div>
          ))}
        </div>
      )}
      {picking && <LinkModal parent={asset} exclude={new Set([key, ...data.childIds])} onClose={() => setPicking(false)}
                             onDone={() => { setPicking(false); reload(); onChange(); }} />}
    </>
  );
}

function LinkModal({ parent, exclude, onClose, onDone }: { parent: Asset; exclude: Set<string>; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { assetsApi.fetchAllAssets().then(setAssets).catch(() => setAssets([])); }, []);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return (assets || []).filter(a => !exclude.has(assetKey(a)) && [a.name, a.assetId, a.assetCode].some(v => (v || '').toLowerCase().includes(t))).slice(0, 10);
  }, [assets, q, exclude]);

  async function link(a: Asset) {
    const extra = a.parentId ? ` It will be moved from its current parent.` : '';
    if (!confirm(`Link ${a.name} as a component of ${parent.name}? Its asset code changes to a child code.${extra}`)) return;
    setBusy(assetKey(a));
    try { const r = await x.linkChild(assetKey(parent), assetKey(a)); toast(`${a.name} linked${r.childCode ? ` as ${r.childCode}` : ''}`); onDone(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(''); }
  }

  return (
    <Modal title={`Link a component to ${parent.name}`} onClose={onClose}>
      <input className="form-control" autoFocus placeholder={assets ? 'Search by name or ID…' : 'Loading assets…'} value={q} onChange={e => setQ(e.target.value)} disabled={!assets} />
      <div className="picker-list" style={{ marginTop: 8, display: matches.length ? undefined : 'none' }}>
        {matches.map(a => (
          <button key={assetKey(a)} className="picker-item" disabled={!!busy} onClick={() => link(a)}>
            <strong>{a.name}</strong>
            <span className="cell-sub">{assetKey(a)} · {a.type || '—'}{a.parentId ? ' · already a component elsewhere' : ''}</span>
          </button>
        ))}
      </div>
      {q.trim() && assets && matches.length === 0 && <div className="cell-sub" style={{ marginTop: 8 }}>No matching assets.</div>}
    </Modal>
  );
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
const STAGE_TONE: Record<string, Tone> = {
  Draft: 'gray', Active: 'green', 'Under Maintenance': 'orange', 'Under Review': 'warn', 'Scheduled for Disposal': 'red', Decommissioned: 'gray',
};

export function LifecycleTab({ asset, onChange }: { asset: Asset; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const key = assetKey(asset);
  const { data, error, reload } = useLoad(() => x.getLifecycle(key), [key]);
  const [moving, setMoving] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [doc, setDoc] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirmMove() {
    if (!moving) return;
    setBusy(true);
    try { await x.transitionLifecycle(key, moving, note.trim(), doc.trim()); toast(`Moved to ${moving}`); setMoving(null); setNote(''); setDoc(''); reload(); onChange(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  if (error) return <Failed msg={error} retry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <div className="stage-track" aria-label="Lifecycle stages">
        {x.LIFECYCLE_STAGES.map(s => <span key={s} className={`stage-step${s === data.stage ? ' current' : ''}`}>{s}</span>)}
      </div>
      <div className="row" style={{ justifyContent: 'space-between', margin: '16px 0 20px' }}>
        <div><div className="meta-key">Current stage</div><Tag tone={STAGE_TONE[data.stage] || 'gray'}>{data.stage}</Tag></div>
        {can('canEdit') && (data.allowedTransitions.length
          ? <div className="row">{data.allowedTransitions.map(s => (
              <button key={s} className="btn btn-secondary btn-sm" onClick={() => setMoving(s)}><i className="fa-solid fa-arrow-right" /> {s}</button>
            ))}</div>
          : <span className="cell-sub">No further stages{data.stage === 'Decommissioned' ? ' — decommissioned' : ''}</span>)}
      </div>
      <div className="meta-key" style={{ marginBottom: 8 }}>History</div>
      {data.history.length === 0 ? <div className="cell-sub">No stage changes recorded.</div> : (
        <ul className="timeline">
          {[...data.history].reverse().map((h, i) => (
            <li key={i} style={{ alignItems: 'flex-start' }}>
              <span className="muted" style={{ width: 120, fontSize: 12, flexShrink: 0 }}>{formatDate(h.at)}</span>
              <div>
                <div style={{ fontSize: 13 }}><Tag tone={STAGE_TONE[h.from || ''] || 'gray'}>{h.from || '—'}</Tag> <i className="fa-solid fa-arrow-right muted" /> <Tag tone={STAGE_TONE[h.to || ''] || 'gray'}>{h.to}</Tag></div>
                <div className="cell-sub">{h.by}{h.note ? ` — ${h.note}` : ''}{h.document ? ` · 📎 ${h.document}` : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {moving && (
        <Modal title={`Move to "${moving}"`} onClose={() => setMoving(null)} footer={<>
          <button className="btn btn-ghost" onClick={() => setMoving(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={confirmMove}><i className="fa-solid fa-arrow-right" /> Confirm</button>
        </>}>
          <p className="cell-sub" style={{ marginBottom: 12 }}>This also updates the asset's status.</p>
          <label className="form-label" htmlFor="lc-note">Note</label>
          <textarea id="lc-note" className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for the change" />
          <label className="form-label" htmlFor="lc-doc" style={{ marginTop: 12 }}>Supporting document reference</label>
          <input id="lc-doc" className="form-control" value={doc} onChange={e => setDoc(e.target.value)} placeholder="e.g. Disposal approval memo FMW/2026/014" />
        </Modal>
      )}
    </>
  );
}

// ── Audit ────────────────────────────────────────────────────────────────────
export function AssetAuditTab({ asset }: { asset: Asset }) {
  const { can } = useAuth();
  const key = assetKey(asset);
  const { data, error, reload } = useLoad(() => can('canViewAudit') ? usersApi.listAudit({ entity: key, limit: 100 }) : Promise.resolve(null), [key]);
  if (!can('canViewAudit')) return <div className="cell-sub">The change history is visible to roles with audit access.</div>;
  if (error) return <Failed msg={error} retry={reload} />;
  if (!data) return <Loading />;
  if (!data.logs.length) return <div className="cell-sub">No recorded changes for this asset.</div>;
  return (
    <div className="list">
      {data.logs.map(l => (
        <div className="list-row" key={l._id} style={{ alignItems: 'flex-start' }}>
          <span className="cell-sub" style={{ width: 110, flexShrink: 0 }} title={new Date(l.ts).toLocaleString('en-NG')}>{timeAgo(l.ts)}</span>
          <div className="list-main">
            <div style={{ fontSize: 13 }}><strong>{l.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</strong>{l.detail ? ` — ${l.detail}` : ''}</div>
            <div className="cell-sub">{l.performedBy?.name || 'Unknown user'}{l.ipAddress ? ` · ${l.ipAddress}` : ''}</div>
          </div>
        </div>
      ))}
      {data.total > data.logs.length && <Link to={`/audit`} className="cell-sub" style={{ paddingTop: 8 }}>Showing latest {data.logs.length} of {data.total} — open the audit log for more</Link>}
    </div>
  );
}

// ── Inventory ────────────────────────────────────────────────────────────────
const INV_COLS: { k: keyof x.InventoryDraft; label: string; w?: number; type?: 'num' | 'cat' | 'loc' | 'bool' }[] = [
  { k: 'location', label: 'Int/Ext', type: 'loc', w: 95 }, { k: 'roomName', label: 'Room', w: 120 }, { k: 'floorLevel', label: 'Floor', w: 70 },
  { k: 'category', label: 'Category', type: 'cat', w: 120 }, { k: 'item', label: 'Item', w: 120 }, { k: 'description', label: 'Description', w: 160 },
  { k: 'brandName', label: 'Brand', w: 100 }, { k: 'quantity', label: 'Qty', type: 'num', w: 60 }, { k: 'quantityNotFunctioning', label: 'Not working', type: 'num', w: 80 },
  { k: 'hasDefect', label: 'Defect', type: 'bool', w: 60 }, { k: 'dimensionOfDamage', label: 'Damage size', w: 100 }, { k: 'comment', label: 'Comment', w: 130 },
];

export function InventoryTab({ asset }: { asset: Asset }) {
  const { can } = useAuth();
  const toast = useToast();
  const key = assetKey(asset);
  const editable = can('canEditInventory');
  const { data: items, error, reload } = useLoad(() => x.listInventory(key), [key]);
  const [rows, setRows] = useState<x.InventoryItem[]>([]);
  const [f, setF] = useState({ category: '', location: '', defects: false, q: '' });
  const [preview, setPreview] = useState<{ drafts: x.InventoryDraft[]; warnings: string[]; filename: string } | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { if (items) setRows(items); }, [items]);

  const shown = rows.filter(r => (!f.category || r.category === f.category) && (!f.location || r.location === f.location) && (!f.defects || r.hasDefect) &&
    (!f.q.trim() || [r.roomName, r.item, r.description, r.brandName, r.comment].some(v => (v || '').toLowerCase().includes(f.q.trim().toLowerCase()))));
  const stats = {
    items: rows.length, defects: rows.filter(r => r.hasDefect).length,
    qty: rows.reduce((s, r) => s + (r.quantity || 0), 0), broken: rows.reduce((s, r) => s + (r.quantityNotFunctioning || 0), 0),
  };

  // Inline edit: update locally, save on blur/change.
  const setCell = (id: string, k: keyof x.InventoryDraft, v: unknown) => setRows(rs => rs.map(r => (r._id === id ? { ...r, [k]: v } : r)));
  async function saveCell(id: string, k: keyof x.InventoryDraft, v: unknown) {
    const orig = items?.find(i => i._id === id);
    if (orig && orig[k] === v) return;
    try { const saved = await x.updateInventoryItem(key, id, { [k]: v }); setRows(rs => rs.map(r => (r._id === id ? saved : r))); }
    catch (err) { toast(`Couldn't save: ${errorMessage(err)}`, 'error'); reload(); }
  }
  async function addRow() {
    setBusy('add');
    try { const it = await x.addInventoryItem(key, { location: 'INTERNAL', category: 'OTHER', quantity: 1 }); setRows(rs => [...rs, it]); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(''); }
  }
  async function remove(r: x.InventoryItem) {
    if (!confirm(`Delete ${r.item || r.description || 'this item'}?`)) return;
    try { await x.deleteInventoryItem(key, r._id); setRows(rs => rs.filter(i => i._id !== r._id)); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }
  async function pickImport(file?: File) {
    if (!file) return;
    setBusy('preview');
    try { setPreview(await x.previewInventoryImport(key, file)); } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(''); }
  }
  async function commit() {
    if (!preview) return;
    setBusy('commit');
    try { const r = await x.commitInventoryImport(key, preview.drafts, preview.filename); toast(`${r.inserted} items imported`); setPreview(null); reload(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(''); }
  }

  if (error) return <Failed msg={error} retry={reload} />;
  if (!items) return <Loading />;
  return (
    <>
      <div className="inv-stats">
        <div><div className="stats-num">{stats.items}</div><div className="stats-label">Items</div></div>
        <div><div className="stats-num" style={{ color: stats.defects ? 'var(--danger)' : undefined }}>{stats.defects}</div><div className="stats-label">With defects</div></div>
        <div><div className="stats-num">{stats.qty.toLocaleString()}</div><div className="stats-label">Total quantity</div></div>
        <div><div className="stats-num" style={{ color: stats.broken ? 'var(--danger)' : undefined }}>{stats.broken.toLocaleString()}</div><div className="stats-label">Not functioning</div></div>
      </div>
      <div className="filter-bar">
        <div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="filter-input" placeholder="Search room, item, brand…" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} aria-label="Search inventory" /></div>
        <select className="filter-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} aria-label="Category"><option value="">All categories</option>{x.INV_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <select className="filter-input" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} aria-label="Location"><option value="">Internal & external</option>{x.INV_LOCATIONS.map(c => <option key={c}>{c}</option>)}</select>
        <label className="check-label"><input type="checkbox" checked={f.defects} onChange={e => setF({ ...f, defects: e.target.checked })} /> Defects only</label>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => x.exportInventory(key).catch(err => toast(errorMessage(err), 'error'))}><i className="fa-solid fa-file-excel" /> Export</button>
          {editable && <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}><i className={`fa-solid ${busy === 'preview' ? 'fa-spinner fa-spin' : 'fa-file-import'}`} /> Import sheet
            <input type="file" accept=".xlsx" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; pickImport(file); }} /></label>}
          {editable && <button className="btn btn-primary btn-sm" disabled={busy === 'add'} onClick={addRow}><i className="fa-solid fa-plus" /> Add item</button>}
        </div>
      </div>
      {shown.length === 0 ? <div className="cell-sub">{rows.length ? 'No items match these filters.' : 'No inventory recorded yet. Add items or import the FPAM inventory sheet.'}</div> : (
        <div className="table-wrap inv-table">
          <table className="data-table">
            <thead><tr>{INV_COLS.map(c => <th key={c.k} style={{ minWidth: c.w }}>{c.label}</th>)}{editable && <th />}</tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r._id} className={r.hasDefect ? 'row-defect' : undefined}>
                  {INV_COLS.map(c => {
                    const v = r[c.k];
                    if (!editable) return <td key={c.k} style={{ fontSize: 12 }}>{c.type === 'bool' ? (v ? 'Yes' : 'No') : String(v ?? '')}</td>;
                    if (c.type === 'bool') return <td key={c.k}><input type="checkbox" checked={!!v} aria-label="Defect" onChange={e => { setCell(r._id, c.k, e.target.checked); saveCell(r._id, c.k, e.target.checked); }} /></td>;
                    if (c.type === 'cat' || c.type === 'loc') {
                      const opts = c.type === 'cat' ? x.INV_CATEGORIES : x.INV_LOCATIONS;
                      return <td key={c.k}><select className="form-control" value={String(v ?? '')} onChange={e => { setCell(r._id, c.k, e.target.value); saveCell(r._id, c.k, e.target.value); }}>{opts.map(o => <option key={o}>{o}</option>)}</select></td>;
                    }
                    return <td key={c.k}><input className="form-control" inputMode={c.type === 'num' ? 'numeric' : undefined} value={String(v ?? '')}
                      onChange={e => setCell(r._id, c.k, c.type === 'num' ? (e.target.value === '' ? '' : Number(e.target.value) || 0) : e.target.value)}
                      onBlur={e => saveCell(r._id, c.k, c.type === 'num' ? Number(e.target.value) || 0 : e.target.value)} /></td>;
                  })}
                  {editable && <td><button className="btn btn-ghost btn-xs" onClick={() => remove(r)} aria-label="Delete item"><i className="fa-solid fa-trash" /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview && (
        <Modal wide title={`Import ${preview.filename}`} onClose={() => setPreview(null)} footer={<>
          <button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={!preview.drafts.length || busy === 'commit'} onClick={commit}><i className="fa-solid fa-file-import" /> Add {preview.drafts.length} items</button>
        </>}>
          {preview.warnings.length > 0 && <div className="form-error" style={{ marginTop: 0, marginBottom: 12 }}>{preview.warnings.join(' · ')}</div>}
          <p className="cell-sub" style={{ marginBottom: 8 }}>{preview.drafts.length} rows read from every sheet. They're added to the existing {rows.length} items.</p>
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Row</th><th>Room</th><th>Category</th><th>Item</th><th>Qty</th><th>Defect</th><th>Comment</th></tr></thead>
              <tbody>{preview.drafts.slice(0, 200).map((d, i) => (
                <tr key={i}><td className="cell-sub">{d.sourceRow ?? i + 1}</td><td>{d.roomName}</td><td>{d.category}</td><td>{d.item || d.description}</td>
                  <td>{d.quantity}</td><td>{d.hasDefect ? <Tag tone="red">Yes</Tag> : 'No'}</td><td className="cell-sub">{d.comment}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── M&E (per asset) ──────────────────────────────────────────────────────────
export const ME_TONE: Record<string, Tone> = { Draft: 'gray', Submitted: 'blue', Cleared: 'green', 'Not Cleared': 'red' };

export function AssetMeTab({ asset }: { asset: Asset }) {
  const key = assetKey(asset);
  const { data, error, reload } = useLoad(() => x.getAssetMeReports(key), [key]);
  if (error) return <Failed msg={error} retry={reload} />;
  if (!data) return <Loading />;
  const sorted = [...data].sort((a, b) => (b.reportYear - a.reportYear) || (b.reportMonth - a.reportMonth));
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="cell-sub">Monthly facility-management progress reports and clearance certificates for this asset.</span>
        <Link className="btn btn-secondary btn-sm" to={`/me?asset=${encodeURIComponent(key)}`}><i className="fa-solid fa-chart-line" /> Open in M&E reports</Link>
      </div>
      {sorted.length === 0 ? <div className="cell-sub">No M&E reports filed for this asset.</div> : (
        <div className="list">
          {sorted.map(r => (
            <div className="list-row" key={r._id}>
              <div className="list-main">
                <strong>{x.MONTHS[(r.reportMonth || 1) - 1]} {r.reportYear}</strong> <span className="cell-sub">· {r.reportType === 'nhp' ? 'NHP' : r.reportType === 'others' ? 'Other' : 'Secretariat'}</span>
                <div className="cell-sub">{r.contractorName || 'No contractor recorded'}</div>
              </div>
              <div className="me-progress" title={`${r.overallPercentage || 0}% complete`}><div style={{ width: `${r.overallPercentage || 0}%` }} /></div>
              <span style={{ fontWeight: 700, fontSize: 12, width: 40, textAlign: 'right' }}>{r.overallPercentage || 0}%</span>
              <Tag tone={ME_TONE[r.status] || 'gray'}>{r.status}</Tag>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
