import { useState, type FormEvent } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import * as assetsApi from '../../api/assets';
import { authedBlobUrl, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import AuthedImage from '../../components/AuthedImage';
import { useToast } from '../../components/Toast';
import { ConditionTag } from '../../components/Tags';
import type { Asset, FileRef } from '../../types';
import { VALUATION_METHODS, assetKey, capturedByName, coords, formatDate, formatNaira } from '../../lib/assets';

const fileName = (f: FileRef) => f.originalname || f.filename || 'file';
const fileSize = (n?: number) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`) : '');

// ── Overview ─────────────────────────────────────────────────────────────────
export function OverviewTab({ asset }: { asset: Asset }) {
  const rows: [string, string | number | undefined | null][] = [
    ['Asset ID', assetKey(asset)], ['Asset code', asset.assetCode], ['Type', asset.type], ['Geometry', asset.geomType],
    ['Condition', asset.condition], ['Status', asset.status || 'Active'], ['Assessed', asset.assessed || 'Unassessed'],
    ['MDA / Agency', asset.mda], ['Sector', asset.sector], ['State', asset.state], ['LGA', asset.lga],
    ['Address', asset.address], ['Material', asset.material], ['Area / length', asset.area],
    ['Captured by', capturedByName(asset)], ['Capture date', formatDate(asset.captureDate)],
    ['Last inspection', formatDate(asset.lastInspection)], ['Next inspection', formatDate(asset.nextInspection)],
  ];
  const typeData = Object.entries(asset.typeData || {});
  return (
    <>
      <div className="meta-grid">
        {rows.map(([k, v]) => <div key={k}><div className="meta-key">{k}</div><div className="meta-val">{v ?? '—'}</div></div>)}
        {asset.notes && <div className="full"><div className="meta-key">Notes</div><div className="meta-val" style={{ whiteSpace: 'pre-wrap' }}>{asset.notes}</div></div>}
      </div>
      {typeData.length > 0 && (
        <>
          <h3 className="meta-key" style={{ margin: '22px 0 10px', color: 'var(--accent)' }}>Type-specific fields</h3>
          <div className="meta-grid">
            {typeData.map(([k, v]) => <div key={k}><div className="meta-key">{k}</div><div className="meta-val">{String(v ?? '—')}</div></div>)}
          </div>
        </>
      )}
    </>
  );
}

// ── Photos ───────────────────────────────────────────────────────────────────
export function PhotosTab({ asset, onChange }: { asset: Asset; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const key = assetKey(asset);
  const photos = asset.photos || [];

  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    let ok = 0; const failures: string[] = [];
    for (const f of files) {
      try { await assetsApi.uploadPhoto(key, f); ok++; } catch (err) { failures.push(`${f.name}: ${errorMessage(err)}`); }
    }
    setBusy(false);
    if (failures.length) toast(`${ok} uploaded, ${failures.length} failed — ${failures[0]}`, 'error'); else toast(`${ok} photo${ok === 1 ? '' : 's'} uploaded`);
    onChange();
  }

  async function remove(p: FileRef) {
    if (!confirm('Delete this photo?')) return;
    try { await assetsApi.deletePhoto(key, p._id); toast('Photo deleted'); onChange(); }
    catch (err) { toast(`Delete failed: ${errorMessage(err)}`, 'error'); }
  }

  return (
    <>
      {can('canCreate') && (
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', marginBottom: 14 }}>
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-upload'}`} /> Upload photos
          <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; upload(picked); }} />
        </label>
      )}
      {photos.length === 0 ? <div className="muted">No photos yet.</div> : (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div className="photo-card" key={p._id}>
              <AuthedImage path={assetsApi.photoPath(key, p._id)} alt={`Photo ${i + 1}`} />
              {can('canEdit') && <button className="btn btn-danger btn-xs" onClick={() => remove(p)} aria-label="Delete photo"><i className="fa-solid fa-trash" /></button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Location ─────────────────────────────────────────────────────────────────
export function LocationTab({ asset }: { asset: Asset }) {
  const c = coords(asset);
  if (!c) return <div className="muted">No coordinates recorded for this asset.</div>;
  return (
    <>
      <div className="map-box">
        <MapContainer center={[c.lat, c.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CircleMarker center={[c.lat, c.lng]} radius={10} pathOptions={{ color: '#0B2545', fillColor: '#4A90D9', fillOpacity: .85 }}>
            <Popup><strong>{asset.name}</strong><br />{asset.address || [asset.lga, asset.state].filter(Boolean).join(', ')}</Popup>
          </CircleMarker>
        </MapContainer>
      </div>
      <div className="muted mono" style={{ fontSize: 11, marginTop: 8 }}>{c.lat.toFixed(6)}°N, {c.lng.toFixed(6)}°E</div>
    </>
  );
}

// ── Maintenance ──────────────────────────────────────────────────────────────
export function MaintenanceTab({ asset, onChange }: { asset: Asset; onChange: (a: Asset) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const key = assetKey(asset);
  const logs = [...(asset.maintenanceLogs || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), desc: '', tech: '', cost: '' });
  const [busy, setBusy] = useState(false);
  const total = logs.reduce((s, l) => s + (l.cost || 0), 0);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onChange(await assetsApi.addMaintenance(key, {
        date: form.date, desc: form.desc.trim(), tech: form.tech.trim(), ...(form.cost ? { cost: Number(form.cost) } : {}),
      }));
      setForm(f => ({ ...f, desc: '', tech: '', cost: '' }));
      toast('Maintenance logged');
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  async function remove(logId?: string) {
    if (!logId || !confirm('Delete this maintenance entry?')) return;
    try { onChange(await assetsApi.deleteMaintenance(key, logId)); toast('Entry deleted'); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      {can('canEdit') && (
        <form className="form-grid" onSubmit={add} style={{ marginBottom: 18 }}>
          <div><label className="form-label">Date</label><input className="form-control" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="form-label">Cost (₦)</label><input className="form-control" type="number" min={0} value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
          <div className="full"><label className="form-label">Description</label><input className="form-control" required value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
          <div><label className="form-label">Technician</label><input className="form-control" value={form.tech} onChange={e => setForm({ ...form, tech: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn btn-primary" disabled={busy}><i className="fa-solid fa-plus" /> Log maintenance</button></div>
        </form>
      )}
      {logs.length === 0 ? <div className="muted">No maintenance recorded.</div> : <>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{logs.length} entries · total {formatNaira(total)}</div>
        <div className="list">
          {logs.map(l => (
            <div className="list-row" key={l._id || `${l.date}${l.desc}`}>
              <div className="list-main">
                <div><strong>{l.desc}</strong></div>
                <div className="cell-sub">{formatDate(l.date)}{l.tech ? ` · ${l.tech}` : ''}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{l.cost ? formatNaira(l.cost) : ''}</div>
              {can('canEdit') && <button className="btn btn-danger btn-xs" onClick={() => remove(l._id)} aria-label="Delete entry"><i className="fa-solid fa-trash" /></button>}
            </div>
          ))}
        </div>
      </>}
    </>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────
export function DocumentsTab({ asset, onChange }: { asset: Asset; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const key = assetKey(asset);
  const docs = asset.documents || [];
  const [busy, setBusy] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try { await assetsApi.uploadDocument(key, file); toast('Document uploaded'); onChange(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  async function open(d: FileRef) {
    try { window.open(await authedBlobUrl(assetsApi.documentPath(key, d._id)), '_blank'); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }

  async function remove(d: FileRef) {
    if (!confirm(`Delete ${fileName(d)}?`)) return;
    try { await assetsApi.deleteDocument(key, d._id); toast('Document deleted'); onChange(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      {can('canEdit') && (
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', marginBottom: 14 }}>
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-upload'}`} /> Upload document
          <input type="file" hidden disabled={busy} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}
      {docs.length === 0 ? <div className="muted">No documents attached.</div> : (
        <div className="list">
          {docs.map(d => (
            <div className="list-row" key={d._id}>
              <i className="fa-solid fa-file-lines" style={{ color: 'var(--accent)' }} />
              <div className="list-main">
                <div>{fileName(d)}</div>
                <div className="cell-sub">{[fileSize(d.length), formatDate(d.uploadDate || d.uploadedAt)].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => open(d)}><i className="fa-solid fa-arrow-up-right-from-square" /> Open</button>
              {can('canEdit') && <button className="btn btn-danger btn-xs" onClick={() => remove(d)} aria-label="Delete document"><i className="fa-solid fa-trash" /></button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Valuation ────────────────────────────────────────────────────────────────
export function ValuationTab({ asset, onChange }: { asset: Asset; onChange: (a: Asset) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const v = asset.valuation || {};
  const [form, setForm] = useState({
    amount: v.amount != null ? String(v.amount) : '',
    method: VALUATION_METHODS.includes(v.method as typeof VALUATION_METHODS[number]) ? v.method! : VALUATION_METHODS[0],
    valuedAt: v.valuedAt ? v.valuedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onChange(await assetsApi.updateValuation(assetKey(asset), {
        amount: Number(form.amount), currency: 'NGN', method: form.method, valuedAt: form.valuedAt,
      }));
      toast('Valuation saved');
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="meta-grid" style={{ marginBottom: 20 }}>
        <div><div className="meta-key">Amount</div><div className="meta-val" style={{ fontSize: 20, fontWeight: 800 }}>{formatNaira(v.amount)}</div></div>
        <div><div className="meta-key">Method</div><div className="meta-val">{v.method || '—'}</div></div>
        <div><div className="meta-key">Valued on</div><div className="meta-val">{formatDate(v.valuedAt)}</div></div>
        <div><div className="meta-key">Valued by</div><div className="meta-val">{v.valuedBy || '—'}</div></div>
      </div>
      {can('canEdit') && (
        <form className="form-grid" onSubmit={save}>
          <div><label className="form-label">Amount (₦)</label><input className="form-control" type="number" min={0} required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label className="form-label">Method</label>
            <select className="form-control" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
              {VALUATION_METHODS.map(m => <option key={m}>{m}</option>)}
            </select></div>
          <div><label className="form-label">Valued on</label><input className="form-control" type="date" value={form.valuedAt} onChange={e => setForm({ ...form, valuedAt: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn btn-primary" disabled={busy}><i className="fa-solid fa-floppy-disk" /> Save valuation</button></div>
        </form>
      )}
    </>
  );
}

// ── History ──────────────────────────────────────────────────────────────────
export function HistoryTab({ asset }: { asset: Asset }) {
  const history = [...(asset.conditionHistory || [])].sort((a, b) => new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime());
  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Captured {formatDate(asset.captureDate || asset.createdAt)} · last updated {formatDate(asset.updatedAt)}
      </div>
      {history.length === 0 ? <div className="muted">No condition changes recorded.</div> : (
        <ul className="timeline">
          {history.map((h, i) => (
            <li key={i}>
              <span className="muted" style={{ width: 110, fontSize: 12 }}>{formatDate(h.changedAt)}</span>
              <ConditionTag value={h.from} /> <i className="fa-solid fa-arrow-right muted" /> <ConditionTag value={h.to} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
