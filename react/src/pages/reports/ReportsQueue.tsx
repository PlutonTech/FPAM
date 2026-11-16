import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as reportsApi from '../../api/reports';
import * as btmApi from '../../api/btm';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canManageBtm } from '../../auth/permissions';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { useToast } from '../../components/Toast';
import { formatDate, timeAgo, type Tone } from '../../lib/assets';
import { REPORT_STATUSES, type PublicReport, type ReportStatus } from '../../api/reports';

const STATUS_TONE: Record<ReportStatus, Tone> = { New: 'red', Acknowledged: 'orange', 'In progress': 'blue', Resolved: 'green', Dismissed: 'gray' };
const SEV_TONE: Record<string, Tone> = { High: 'red', Medium: 'orange', Low: 'gray' };
const OPEN = ['New', 'Acknowledged', 'In progress'];

/** Problems the public reported by scanning asset QR labels. Used on /reports (staff) and the MDA portal. */
export default function ReportsQueue({ portal }: { portal?: boolean }) {
  const [filter, setFilter] = useState('open');
  const [data, setData] = useState<{ reports: PublicReport[]; counts: Record<string, number>; canHandle: boolean } | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<PublicReport | null>(null);

  const load = useCallback(async () => {
    try { setData(await reportsApi.listReports()); setError(''); }
    catch (err) { setError(errorMessage(err)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = data?.counts || {};
  const openCount = OPEN.reduce((n, s) => n + (counts[s] || 0), 0);
  const shown = (data?.reports || []).filter(r => filter === 'open' ? OPEN.includes(r.status) : !filter || r.status === filter);

  return (
    <>
      <div className="tab-bar card" role="tablist" style={{ marginBottom: 12 }}>
        {[['open', 'Open', openCount], ['', 'All', 0], ...REPORT_STATUSES.map(s => [s, s, counts[s] || 0])].map(([k, l, n]) => (
          <button key={String(k)} role="tab" aria-selected={filter === k} className={`tab-btn${filter === k ? ' active' : ''}`} onClick={() => setFilter(String(k))}>
            {l}{n ? <span className="tab-count">{n}</span> : null}
          </button>
        ))}
      </div>
      <div className="card table-wrap">
        {data === null && !error ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading reports…</div>
          : error ? <div className="empty-state"><div className="empty-title">Could not load reports</div><div className="empty-sub">{error}</div></div>
          : shown.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-inbox" /></div><div className="empty-title">No reports here</div>
              <div className="empty-sub">Reports appear when someone scans an asset's QR label and reports a problem.</div></div>
          : (
            <table className="data-table">
              <thead><tr><th>Report</th><th>Asset</th><th>Problem</th><th>Received</th><th>Status</th></tr></thead>
              <tbody>{shown.map(r => (
                <tr key={r._id} className="row-link" onClick={() => setOpen(r)}>
                  <td className="mono" style={{ fontSize: 11 }}>{r.ref}</td>
                  <td><strong>{r.assetName}</strong><div className="cell-sub">{[r.state, portal ? '' : r.mda].filter(Boolean).join(' · ')}</div></td>
                  <td>{r.category} <Tag tone={SEV_TONE[r.severity]}>{r.severity}</Tag><div className="cell-sub report-snippet">{r.description}</div></td>
                  <td title={formatDate(r.createdAt)}>{timeAgo(r.createdAt)}</td>
                  <td><Tag tone={STATUS_TONE[r.status]}>{r.status}</Tag></td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
      {open && <ReportModal report={open} portal={portal} canHandle={!!data?.canHandle} onClose={() => setOpen(null)}
                            onChanged={r => { setOpen(r); load(); }} />}
    </>
  );
}

function ReportModal({ report, portal, canHandle, onClose, onChanged }: {
  report: PublicReport; portal?: boolean; canHandle: boolean; onClose: () => void; onChanged: (r: PublicReport) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const closed = report.status === 'Resolved' || report.status === 'Dismissed';
  const needsNote = status === 'Resolved' || status === 'Dismissed';

  const save = async () => {
    if (needsNote && !note.trim()) { toast('Add a note saying what was done', 'error'); return; }
    setBusy(true);
    try { onChanged((await reportsApi.updateReport(report._id, status, note.trim())).report); setNote(''); toast('Report updated'); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  };
  const raiseWorkOrder = async () => {
    setBusy(true);
    try {
      const { workOrder } = await btmApi.createWorkOrder({ reportId: report._id, priority: report.severity === 'High' ? 'High' : 'Medium' });
      toast(`Work order ${workOrder.ref} raised`);
      onChanged({ ...report, workOrderId: workOrder._id, status: OPEN.slice(0, 2).includes(report.status) ? 'In progress' : report.status });
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={<>Report <span className="mono">{report.ref}</span></>} onClose={onClose} wide>
      <div className="row" style={{ marginBottom: 10 }}>
        <Tag tone={STATUS_TONE[report.status]}>{report.status}</Tag><Tag tone={SEV_TONE[report.severity]}>{report.severity}</Tag>
        <span className="cell-sub">Received {formatDate(report.createdAt)}</span>
      </div>
      <dl className="scan-details">
        <dt>Asset</dt><dd>{portal ? <strong>{report.assetName}</strong> : <Link to={`/assets/${encodeURIComponent(report.assetId)}`}>{report.assetName}</Link>} <span className="cell-sub mono">{report.assetId}</span></dd>
        {!portal && report.mda && <><dt>MDA</dt><dd>{report.mda}</dd></>}
        <dt>Problem</dt><dd>{report.category}</dd>
        <dt>Description</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{report.description}</dd>
        {report.location && <><dt>Reporter's location</dt><dd><a href={`https://www.openstreetmap.org/?mlat=${report.location.lat}&mlon=${report.location.lng}#map=18/${report.location.lat}/${report.location.lng}`} target="_blank" rel="noreferrer">
          {report.location.lat.toFixed(5)}, {report.location.lng.toFixed(5)} <i className="fa-solid fa-arrow-up-right-from-square" /></a></dd></>}
        {(report.reporter?.name || report.reporter?.phone || report.reporter?.email) && <><dt>Reporter</dt>
          <dd>{[report.reporter.name, report.reporter.phone, report.reporter.email].filter(Boolean).join(' · ')}</dd></>}
        {report.workOrderId && !portal && <><dt>Work order</dt><dd><Link to="/btm?tab=work-orders">Raised — see Training &amp; Maintenance</Link></dd></>}
      </dl>

      <h3 className="section-h">History</h3>
      <ul className="report-history">
        {report.history.map((h, i) => (
          <li key={i}><Tag tone={STATUS_TONE[h.status]}>{h.status}</Tag> <span className="cell-sub">{formatDate(h.at)}{h.by ? ` · ${h.by}` : ''}</span>{h.note && <div>{h.note}</div>}</li>
        ))}
      </ul>

      {canHandle && !closed && (
        <div className="report-actions">
          <div className="form-grid">
            <div><label className="form-label">Change status</label>
              <select className="form-control" value={status} onChange={e => setStatus(e.target.value as ReportStatus)}>
                {REPORT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div className="full"><label className="form-label">Note {needsNote ? '*' : '(optional)'}</label>
              <textarea className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder={needsNote ? 'What was done, or why it was dismissed' : 'e.g. Inspector visiting on Monday'} /></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" disabled={busy || (status === report.status && !note.trim())} onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button>
            {!portal && !report.workOrderId && canManageBtm(user) && (
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={raiseWorkOrder}><i className="fa-solid fa-screwdriver-wrench" /> Raise maintenance work order</button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
