import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { Tag } from '../components/Tags';

interface Settings {
  platformName?: string; organisation?: string; coordinateSystem?: string;
  defaultMapCenter?: { lat?: number; lng?: number }; defaultZoom?: number;
  featureToggles?: { ocrEnabled?: boolean; excelEnabled?: boolean; realtimeEnabled?: boolean; offlineMode?: boolean };
  updatedAt?: string;
}
interface Mda { _id: string; name: string; shortName?: string; category?: string; active?: boolean }
const CATEGORIES = ['Ministry', 'Department', 'Agency', 'Commission', 'Other'];
const TOGGLES: [keyof NonNullable<Settings['featureToggles']>, string, string][] = [
  ['ocrEnabled', 'OCR scanner', 'Text extraction from photos and documents'],
  ['excelEnabled', 'Excel import', 'Bulk asset import and spreadsheet attachments'],
  ['realtimeEnabled', 'Real-time updates', 'Push new captures to open dashboards'],
  ['offlineMode', 'Offline mode', 'Allow capture without a connection'],
];

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'System Admin';
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">{isAdmin ? 'Platform configuration and the MDA list' : 'Only System Admins can change these settings'}</div>
        </div>
      </header>
      <PlatformSettings canEdit={isAdmin} />
      <MdaManager canEdit={isAdmin} />
    </div>
  );
}

function PlatformSettings({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ settings: Settings }>('/settings').then(r => { setS(r.settings); setSaved(r.settings); }).catch(err => setError(errorMessage(err)));
  }, []);

  if (error) return <div className="card form-error" style={{ marginBottom: 16 }}>Could not load settings: {error}</div>;
  if (!s) return <div className="card loading" style={{ marginBottom: 16 }}><i className="fa-solid fa-spinner fa-spin" /></div>;

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const lat = s.defaultMapCenter?.lat ?? 9.0765, lng = s.defaultMapCenter?.lng ?? 7.3986;

  async function save() {
    if (!s) return;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { toast('Map centre is out of range', 'error'); return; }
    setBusy(true);
    try {
      const r = await api<{ settings: Settings }>('/settings', { method: 'PUT', body: {
        platformName: s.platformName, organisation: s.organisation, coordinateSystem: s.coordinateSystem,
        defaultMapCenter: { lat, lng }, defaultZoom: s.defaultZoom, featureToggles: s.featureToggles,
      } });
      setS(r.settings); setSaved(r.settings); toast('Settings saved');
    } catch (err) { toast(`Save failed: ${errorMessage(err)}`, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <section className="card form-section" style={{ marginBottom: 16 }}>
      <h2 className="form-section-title">Platform</h2>
      <fieldset disabled={!canEdit} style={{ border: 'none' }}>
        <div className="form-grid">
          <div><label className="form-label">Platform name</label><input className="form-control" value={s.platformName || ''} onChange={e => setS({ ...s, platformName: e.target.value })} /></div>
          <div><label className="form-label">Organisation</label><input className="form-control" value={s.organisation || ''} onChange={e => setS({ ...s, organisation: e.target.value })} /></div>
          <div><label className="form-label">Coordinate system</label>
            <select className="form-control" value={s.coordinateSystem || 'WGS84'} onChange={e => setS({ ...s, coordinateSystem: e.target.value })}>
              {['WGS84', 'Minna / UTM 31N', 'Minna / UTM 32N', 'Minna / UTM 33N'].map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div><label className="form-label">Default zoom</label><input className="form-control" type="number" min={3} max={18} value={s.defaultZoom ?? 7} onChange={e => setS({ ...s, defaultZoom: Number(e.target.value) })} /></div>
          <div><label className="form-label">Default map centre — latitude</label><input className="form-control" type="number" step="any" value={lat} onChange={e => setS({ ...s, defaultMapCenter: { lat: Number(e.target.value), lng } })} /></div>
          <div><label className="form-label">Default map centre — longitude</label><input className="form-control" type="number" step="any" value={lng} onChange={e => setS({ ...s, defaultMapCenter: { lat, lng: Number(e.target.value) } })} /></div>
        </div>
        <h3 className="form-label" style={{ margin: '18px 0 8px' }}>Features</h3>
        <div className="toggle-list">
          {TOGGLES.map(([k, label, hint]) => (
            <label key={k} className="toggle-row">
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div><div className="cell-sub">{hint}</div></div>
              <input type="checkbox" role="switch" className="switch" checked={!!s.featureToggles?.[k]} onChange={e => setS({ ...s, featureToggles: { ...s.featureToggles, [k]: e.target.checked } })} />
            </label>
          ))}
        </div>
      </fieldset>
      {canEdit && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={save}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> Save settings</button>
          {dirty && <button className="btn btn-ghost btn-sm" onClick={() => setS(saved)}>Discard changes</button>}
        </div>
      )}
    </section>
  );
}

function MdaManager({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [mdas, setMdas] = useState<Mda[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Mda | 'new' | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    api<{ mdas: Mda[] }>(`/mdas${canEdit ? '?includeInactive=1' : ''}`).then(r => setMdas(r.mdas || [])).catch(() => setMdas([]));
  }, [canEdit]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (mdas || []).filter(m =>
    (showInactive || m.active !== false) && (!cat || m.category === cat) &&
    (!q.trim() || [m.name, m.shortName].some(v => (v || '').toLowerCase().includes(q.trim().toLowerCase())))), [mdas, q, cat, showInactive]);
  const active = (mdas || []).filter(m => m.active !== false);

  async function setActive(m: Mda, on: boolean) {
    if (!on && !confirm(`Deactivate ${m.name}? It disappears from dropdowns; existing assets keep it.`)) return;
    try {
      if (on) await api(`/mdas/${m._id}`, { method: 'PUT', body: { active: true } });
      else await api(`/mdas/${m._id}`, { method: 'DELETE' });
      toast(on ? `${m.name} reactivated` : `${m.name} deactivated`); load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <section className="card">
      <div className="chart-card-hd">
        <div>
          <div className="chart-title">MDAs</div>
          <div className="chart-sub">{active.length} active · {CATEGORIES.map(c => `${active.filter(m => m.category === c).length} ${c.toLowerCase()}`).filter(x => !x.startsWith('0 ')).join(' · ')}</div>
        </div>
        {canEdit && <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => setImporting(true)}><i className="fa-solid fa-file-csv" /> Import list</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> Add MDA</button>
        </div>}
      </div>
      <div className="filter-bar" style={{ padding: '0 18px' }}>
        <div className="search"><i className="fa-solid fa-magnifying-glass" />
          <input className="filter-input" placeholder="Search MDAs…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search MDAs" /></div>
        <select className="filter-input" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        {canEdit && <label className="check-label"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show deactivated</label>}
      </div>
      <div className="table-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
        {mdas === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /></div> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Short name</th><th>Category</th><th>Status</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {shown.map(m => (
                <tr key={m._id} className={m.active === false ? 'row-muted' : undefined}>
                  <td style={{ fontSize: 13 }}>{m.name}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{m.shortName || '—'}</td>
                  <td style={{ fontSize: 12 }}>{m.category || '—'}</td>
                  <td>{m.active === false ? <Tag tone="gray">Deactivated</Tag> : <Tag tone="green">Active</Tag>}</td>
                  {canEdit && <td><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditing(m)} title="Edit"><i className="fa-solid fa-pen" /></button>
                    {m.active === false
                      ? <button className="btn btn-secondary btn-xs" onClick={() => setActive(m, true)}>Reactivate</button>
                      : <button className="btn btn-danger btn-xs" onClick={() => setActive(m, false)} title="Deactivate"><i className="fa-solid fa-ban" /></button>}
                  </div></td>}
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} className="cell-sub" style={{ padding: 16 }}>No MDAs match.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {editing && <MdaModal mda={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />}
    </section>
  );
}

function MdaModal({ mda, onClose, onDone }: { mda?: Mda; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: mda?.name || '', shortName: mda?.shortName || '', category: mda?.category || 'Ministry' });
  const [error, setError] = useState('');
  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    try {
      if (mda) await api(`/mdas/${mda._id}`, { method: 'PUT', body: form }); else await api('/mdas', { method: 'POST', body: form });
      toast(mda ? 'MDA updated' : 'MDA added'); onDone();
    } catch (err) { setError(errorMessage(err)); }
  }
  return (
    <Modal title={mda ? `Edit ${mda.name}` : 'Add MDA'} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button>
    </>}>
      <div className="form-grid">
        <div className="full"><label className="form-label">Name</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Federal Ministry of Works" /></div>
        <div><label className="form-label">Short name</label><input className="form-control" value={form.shortName} onChange={e => setForm({ ...form, shortName: e.target.value })} placeholder="e.g. FMW" /></div>
        <div><label className="form-label">Category</label><select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      {mda && <p className="cell-sub" style={{ marginTop: 10 }}>Renaming doesn't update assets already recorded under the old name.</p>}
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!csv.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ created?: number; skipped?: number }>('/mdas/import-csv', { method: 'POST', body: { csv } });
      toast(`${r.created ?? 0} added${r.skipped ? `, ${r.skipped} already existed` : ''}`); onDone();
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title="Import MDAs" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={busy || !csv.trim()} onClick={run}><i className="fa-solid fa-file-import" /> Import</button>
    </>}>
      <p className="cell-sub" style={{ marginBottom: 8 }}>One MDA per line: <code>name, short name, category</code>. Short name and category are optional; names that already exist are skipped.</p>
      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', marginBottom: 8 }}>
        <i className="fa-solid fa-upload" /> Load a .csv file
        <input type="file" accept=".csv,.txt" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setCsv(await f.text()); }} />
      </label>
      <textarea className="form-control" rows={10} value={csv} onChange={e => setCsv(e.target.value)} placeholder={'Federal Ministry of Works, FMW, Ministry\nNational Hospital Abuja, NHA, Agency'} />
    </Modal>
  );
}
