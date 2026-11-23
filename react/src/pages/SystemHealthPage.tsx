import { useCallback, useEffect, useState } from 'react';
import * as sys from '../api/system';
import { API_BASE } from '../config';
import { downloadFile, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { Tag } from '../components/Tags';
import { timeAgo } from '../lib/assets';
import { ASSESSED, ASSET_TYPES, CONDITIONS, GEOM_TYPES, NIGERIA_STATES, SECTORS, STATUSES } from '../lib/assets';
import { LIFECYCLE_STAGES } from '../api/extras';
import { DIVISIONS, ROLES } from '../api/users';

// The dashboard keeps its own copies of these lists; compare them with what
// the backend accepts so a change on one side doesn't silently break forms.
const LOCAL: Record<keyof sys.Enums, readonly string[]> = {
  states: NIGERIA_STATES, assetTypes: ASSET_TYPES, conditions: CONDITIONS, statuses: STATUSES, geomTypes: GEOM_TYPES,
  assessed: ASSESSED, sectors: SECTORS.filter(Boolean), lifecycleStages: LIFECYCLE_STAGES, roles: ROLES, divisions: ['All', ...DIVISIONS],
};
const LABEL: Record<keyof sys.Enums, string> = {
  states: 'States', assetTypes: 'Asset types', conditions: 'Conditions', statuses: 'Statuses', geomTypes: 'Geometry types',
  assessed: 'Assessment', sectors: 'Sectors', lifecycleStages: 'Lifecycle stages', roles: 'Roles', divisions: 'Divisions',
};

const fmtUptime = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);

export default function SystemHealthPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [health, setHealth] = useState<sys.SystemHealth | null>(null);
  const [errors, setErrors] = useState<sys.ErrorEntry[] | null>(null);
  const [source, setSource] = useState<'' | 'server' | 'client'>('');
  const [drift, setDrift] = useState<{ key: keyof sys.Enums; missingHere: string[]; missingThere: string[] }[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [backingUp, setBackingUp] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [h, e, en] = await Promise.all([sys.systemHealth(), sys.systemErrors(source || undefined), sys.enums()]);
      setHealth(h); setErrors(e);
      setDrift((Object.keys(LOCAL) as (keyof sys.Enums)[]).map(key => ({
        key,
        missingHere: (en[key] || []).filter(v => !LOCAL[key].includes(v)),
        missingThere: LOCAL[key].filter(v => !(en[key] || []).includes(v)),
      })));
    } catch (err) { setError(errorMessage(err)); }
  }, [source]);
  useEffect(() => { load(); }, [load]);

  if (user?.role !== 'System Admin') return <div className="page"><div className="card empty-state"><div className="empty-title">System Admins only</div></div></div>;

  const problems = drift?.filter(d => d.missingHere.length || d.missingThere.length) || [];
  const integ = health?.integrations;

  return (
    <div className="page">
      <header className="page-header">
        <div><h1 className="page-title">System health</h1><div className="page-sub">Server status, errors, configuration checks and backups</div></div>
        <div className="row">
          <a className="btn btn-ghost btn-sm" href={`${API_BASE}/docs`} target="_blank" rel="noreferrer"><i className="fa-solid fa-book" /> API docs</a>
          <button className="btn btn-ghost btn-sm" onClick={load}><i className="fa-solid fa-rotate" /> Refresh</button>
        </div>
      </header>
      {error && <div className="card form-section form-error" style={{ marginBottom: 14 }}><i className="fa-solid fa-circle-xmark" /> {error}</div>}

      <div className="kpi-row">
        <div className={`card kpi ${health ? 'kpi-green' : 'kpi-red'}`}><div className="kpi-label">Server</div><div className="kpi-value">{health ? 'Up' : '…'}</div><div className="kpi-sub">{health ? `up ${fmtUptime(health.uptimeSeconds)} · ${health.node}` : ''}</div></div>
        <div className="card kpi kpi-blue"><div className="kpi-label">Database</div><div className="kpi-value">{health ? `${health.database.latencyMs} ms` : '…'}</div><div className="kpi-sub">{health?.database.name} on {health?.database.host?.split('.')[0]}</div></div>
        <div className={`card kpi ${health?.counts.serverErrors24h ? 'kpi-red' : 'kpi-green'}`}><div className="kpi-label">Server errors (24h)</div><div className="kpi-value">{health?.counts.serverErrors24h ?? '…'}</div><div className="kpi-sub">browser errors: {health?.counts.clientErrors24h ?? '…'}</div></div>
        <div className="card kpi kpi-navy"><div className="kpi-label">Registry</div><div className="kpi-value">{health?.counts.assets?.toLocaleString() ?? '…'}</div><div className="kpi-sub">{health?.counts.activeUsers} active users · {health?.memoryMb.rss} MB memory</div></div>
      </div>

      <div className="dash-split">
        <div className="card form-section">
          <div className="form-section-title">Configuration checks</div>
          <div className="list">
            <Check ok={!!integ?.email} label="Email (SMTP)" good="Configured — emails are being sent" bad="Not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM in the server settings (Heroku → Settings → Config Vars). Emails are skipped until then." />
            <Check ok={!!integ?.appUrl} label="Links in emails (APP_URL)" good={integ?.appUrl || ''} bad="Not set: links fall back to CLIENT_URL. Set APP_URL=https://<site>/app in the server settings (Heroku → Settings → Config Vars)." />
            <Check ok={!!integ?.sms} label="SMS" good="Configured" bad="Optional. Set SMS_PROVIDER (termii / twilio / africastalking) and its keys to text decisions to field staff." warn />
            <Check ok={!!integ?.antivirus} label="Antivirus for uploads" good="ClamAV scanning on" bad="Optional. Uploads are content-checked (disguised executables, scripted PDFs, macros); set CLAMAV_HOST for full virus scanning." warn />
            <Check ok={!problems.length} label="Dashboard lists match the server" good="All allowed values agree" bad={`${problems.length} list(s) differ — see below`} />
          </div>
        </div>
        <div className="card form-section">
          <div className="form-section-title">Backup</div>
          <p style={{ fontSize: 13, marginBottom: 10 }}>Download a full copy of the database (assets, users, inspections, audit log…) as a file. Photo and document <em>contents</em> are not included — only their records. The file contains password hashes: store it somewhere secure.</p>
          <button className="btn btn-primary btn-sm" disabled={backingUp} onClick={async () => {
            setBackingUp(true);
            try { await downloadFile('/system/backup', `fpamas-backup-${new Date().toISOString().slice(0, 10)}.json`); toast('Backup downloaded'); }
            catch (err) { toast(errorMessage(err), 'error'); } finally { setBackingUp(false); }
          }}><i className={`fa-solid ${backingUp ? 'fa-spinner fa-spin' : 'fa-download'}`} /> Download backup</button>
          <p className="cell-sub" style={{ marginTop: 10 }}>This is a manual copy. For automatic daily backups with point-in-time restore, turn on Cloud Backup for the cluster in MongoDB Atlas (paid tiers), and practise restoring with <code>scripts/restore.js</code> on a spare database.</p>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="card form-section" style={{ marginBottom: 14 }}>
          <div className="form-section-title">List differences</div>
          {problems.map(p => (
            <div key={p.key} style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>{LABEL[p.key]}</strong>
              {p.missingHere.length > 0 && <div className="cell-sub" style={{ fontSize: 12 }}>Server accepts but the dashboard doesn't offer: {p.missingHere.join(', ')}</div>}
              {p.missingThere.length > 0 && <div className="cell-sub" style={{ fontSize: 12, color: 'var(--danger)' }}>Dashboard offers but the server will reject: {p.missingThere.join(', ')}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="form-section" style={{ paddingBottom: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="form-section-title" style={{ margin: 0 }}>Recent errors <span className="cell-sub">(kept 30 days)</span></div>
            <select className="filter-input" value={source} onChange={e => setSource(e.target.value as typeof source)} aria-label="Source">
              <option value="">Server and browser</option><option value="server">Server</option><option value="client">Browser</option>
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {errors === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
            : errors.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-circle-check" /></div><div className="empty-title">No errors recorded</div></div>
            : (
              <table className="data-table">
                <thead><tr><th>When</th><th>Where</th><th>Error</th><th>User</th></tr></thead>
                <tbody>{errors.map(e => (
                  <tr key={e._id} className="row-link" onClick={() => setOpen(open === e._id ? null : e._id)}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{timeAgo(e.at)}<div className="cell-sub">{new Date(e.at).toLocaleString('en-NG')}</div></td>
                    <td><Tag tone={e.source === 'server' ? 'red' : 'orange'}>{e.source}</Tag><div className="cell-sub" style={{ maxWidth: 220, overflowWrap: 'anywhere' }}>{e.method ? `${e.method} ` : ''}{e.url}</div></td>
                    <td style={{ fontSize: 12, maxWidth: 420 }}><div style={{ overflowWrap: 'anywhere' }}>{e.message}</div>
                      {open === e._id && e.stack && <pre className="err-stack">{e.stack}</pre>}</td>
                    <td style={{ fontSize: 12 }}>{e.user?.name || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}

function Check({ ok, label, good, bad, warn }: { ok: boolean; label: string; good: string; bad: string; warn?: boolean }) {
  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <i className={`fa-solid ${ok ? 'fa-circle-check' : warn ? 'fa-circle-info' : 'fa-triangle-exclamation'}`} style={{ color: ok ? 'var(--success)' : warn ? 'var(--accent)' : '#d97706', marginTop: 3 }} />
      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 13 }}>{label}</strong><div className="cell-sub" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{ok ? good : bad}</div></div>
    </div>
  );
}
