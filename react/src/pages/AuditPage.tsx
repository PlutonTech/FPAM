import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as usersApi from '../api/users';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { Tag } from '../components/Tags';
import type { Tone } from '../lib/assets';

const PAGE = 50;
const toneFor = (a: string): Tone =>
  /DELETED|REMOVED|REJECTED|UNLINKED/.test(a) ? 'red'
  : /APPROVED|CREATED|ISSUED/.test(a) ? 'green'
  : /LOGIN|LOGOUT|EXPORT/.test(a) ? 'gray'
  : /SETTINGS|ROLE_CONFIG|SUBMITTED/.test(a) ? 'warn' : 'blue';
const pretty = (a: string) => a.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

export default function AuditPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ action: '', entityType: '', entity: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ logs: usersApi.AuditLogEntry[]; total: number; pages: number } | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setData(await usersApi.listAudit({ ...f, page, limit: PAGE })); }
    catch (err) { setError(errorMessage(err)); setData({ logs: [], total: 0, pages: 0 }); }
  }, [f, page]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (k: keyof typeof f) => (e: { target: { value: string } }) => { setPage(1); setF(x => ({ ...x, [k]: e.target.value })); };

  async function exportCsv() {
    setExporting(true);
    try {
      const r = await usersApi.listAudit({ ...f, page: 1, limit: 10000 });
      const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const rows = [['Time', 'Action', 'Entity type', 'Entity', 'User', 'Email', 'IP', 'Detail'],
        ...r.logs.map(l => [l.ts, l.action, l.entityType, l.entityId, l.performedBy?.name, l.performedBy?.email, l.ipAddress, l.detail])];
      const blob = new Blob([rows.map(row => row.map(esc).join(',')).join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(`Exported ${r.logs.length.toLocaleString()} entries`);
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setExporting(false); }
  }

  if (!can('canViewAudit')) {
    return <div className="page"><div className="card empty-state"><div className="empty-icon"><i className="fa-solid fa-lock" /></div>
      <div className="empty-title">No access</div><div className="empty-sub">The audit log is visible to roles with audit permission.</div></div></div>;
  }

  const start = (page - 1) * PAGE;
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Audit log</h1>
          <div className="page-sub">Every change made through the platform, newest first</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={exporting || !data?.total}>
          <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-file-csv'}`} /> Export CSV
        </button>
      </header>

      <div className="filter-bar">
        <select className="filter-input" value={f.action} onChange={setFilter('action')} aria-label="Action">
          <option value="">All actions</option>{usersApi.AUDIT_ACTIONS.map(a => <option key={a} value={a}>{pretty(a)}</option>)}
        </select>
        <select className="filter-input" value={f.entityType} onChange={setFilter('entityType')} aria-label="Entity type">
          <option value="">All record types</option>{usersApi.AUDIT_ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <input className="filter-input" placeholder="Record ID (e.g. AST-1001)" value={f.entity} onChange={setFilter('entity')} aria-label="Record ID" />
        <label className="row" style={{ gap: 6, fontSize: 12 }}>From <input className="filter-input" type="date" value={f.from} onChange={setFilter('from')} /></label>
        <label className="row" style={{ gap: 6, fontSize: 12 }}>To <input className="filter-input" type="date" value={f.to} onChange={setFilter('to')} /></label>
        <button className="btn btn-ghost btn-sm" onClick={() => { setPage(1); setF({ action: '', entityType: '', entity: '', from: '', to: '' }); }}><i className="fa-solid fa-xmark" /> Clear</button>
      </div>

      <div className="card table-wrap">
        {data === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : error ? <div className="empty-state"><div className="empty-title">Could not load the audit log</div><div className="empty-sub">{error}</div></div>
          : data.logs.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-clock-rotate-left" /></div><div className="empty-title">No entries</div><div className="empty-sub">Nothing matches these filters</div></div>
          : (
            <table className="data-table">
              <thead><tr><th>When</th><th>Action</th><th>Record</th><th>By</th><th>Detail</th><th>IP</th></tr></thead>
              <tbody>
                {data.logs.map(l => (
                  <tr key={l._id}>
                    <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(l.ts).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td><Tag tone={toneFor(l.action)}>{pretty(l.action)}</Tag></td>
                    <td className="id-cell" style={{ maxWidth: 'none' }}>
                      {l.entityType === 'Asset' && l.entityId ? <Link to={`/assets/${encodeURIComponent(l.entityId)}`}>{l.entityId}</Link> : (l.entityId || '—')}
                      {l.entityType && <div className="cell-sub">{l.entityType}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{l.performedBy?.name || '—'}{l.performedBy?.role && <div className="cell-sub">{l.performedBy.role}</div>}</td>
                    <td style={{ fontSize: 12, maxWidth: 360 }}>{l.detail || <span className="cell-sub">—</span>}</td>
                    <td className="mono cell-sub" style={{ fontSize: 10 }} title={l.userAgent}>{l.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {data && data.total > 0 && (
        <div className="pager">
          <div>Showing {start + 1}–{Math.min(start + PAGE, data.total)} of {data.total.toLocaleString()} entries</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><i className="fa-solid fa-angle-left" /></button>
            <span style={{ fontSize: 12 }}>Page {page} of {Math.max(1, data.pages)}</span>
            <button className="btn btn-ghost btn-xs" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} aria-label="Next page"><i className="fa-solid fa-angle-right" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
