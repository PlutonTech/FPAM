import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as assetsApi from '../../api/assets';
import * as inspApi from '../../api/inspections';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ConditionTag, Tag } from '../../components/Tags';
import type { Asset } from '../../types';
import { CONDITIONS, assetKey, formatDate } from '../../lib/assets';
import ScheduleInspectionModal from './ScheduleInspectionModal';
import type { Tone } from '../../lib/assets';

type Insp = inspApi.Inspection;
/** A row is either a real inspection or an asset whose schedule says it's due. */
type Row = { kind: 'real'; insp: Insp } | { kind: 'due'; asset: Asset; date: string };

const STATUS_TONE: Record<string, Tone> = {
  Scheduled: 'gray', Assigned: 'blue', 'In Progress': 'warn', Submitted: 'orange', Approved: 'green', Rejected: 'red',
};
const OPEN = ['Scheduled', 'Assigned', 'In Progress'];
const day = (d?: string) => (d || '').slice(0, 10);
const overdueOn = (i: Insp, today: string) => OPEN.includes(i.status) && day(i.scheduledDate) < today;

type ModalState =
  | { kind: 'schedule'; asset?: Asset; date?: string } | { kind: 'submit'; insp: Insp }
  | { kind: 'reject'; insp: Insp } | { kind: 'view'; insp: Insp } | null;

export default function InspectionsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [insps, setInsps] = useState<Insp[] | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [i, a] = await Promise.all([inspApi.listInspections(), assetsApi.fetchAllAssets()]);
      setInsps(i); setAssets(a);
    } catch (err) { setError(errorMessage(err)); setInsps([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byAsset = useMemo(() => new Map(assets.map(a => [a.assetId, a])), [assets]);
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Assets due within 30 days (or overdue) that have no open inspection yet.
  const due = useMemo<Row[]>(() => {
    const covered = new Set((insps || []).filter(i => OPEN.includes(i.status) || i.status === 'Submitted').map(i => i.assetId));
    return assets
      .filter(a => a.nextInspection && day(a.nextInspection) <= in30 && !covered.has(a.assetId))
      .map(a => ({ kind: 'due' as const, asset: a, date: day(a.nextInspection) }))
      .sort((x, y) => x.date.localeCompare(y.date));
  }, [assets, insps, in30]);

  const isOverdue = (i: Insp) => overdueOn(i, today);

  const kpi = useMemo(() => {
    const list = insps || [];
    return {
      open: list.filter(i => OPEN.includes(i.status)).length,
      overdue: list.filter(i => overdueOn(i, today)).length + due.filter(d => d.kind === 'due' && d.date < today).length,
      review: list.filter(i => i.status === 'Submitted').length,
      approved: list.filter(i => i.status === 'Approved').length,
      upcoming: list.filter(i => OPEN.includes(i.status) && day(i.scheduledDate) >= today && day(i.scheduledDate) <= in7).length,
      due: due.length,
    };
  }, [insps, due, today, in7]);

  const rows = useMemo<Row[]>(() => {
    const real = (insps || []).map(insp => ({ kind: 'real' as const, insp }));
    const sorted = real.sort((a, b) => day(a.insp.scheduledDate).localeCompare(day(b.insp.scheduledDate)));
    switch (filter) {
      case 'open':    return sorted.filter(r => OPEN.includes(r.insp.status));
      case 'overdue': return [...sorted.filter(r => overdueOn(r.insp, today)), ...due.filter(d => d.kind === 'due' && d.date < today)];
      case 'due':     return due;
      case 'all':     return sorted;
      default:        return sorted.filter(r => r.insp.status === filter);
    }
  }, [insps, due, filter, today]);

  async function act(i: Insp, label: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(i._id);
    try { await fn(); toast(msg); await load(); }
    catch (err) { toast(`${label} failed: ${errorMessage(err)}`, 'error'); }
    finally { setBusy(null); }
  }

  const tabs: [string, string, number?][] = [
    ['open', 'Open', kpi.open], ['overdue', 'Overdue', kpi.overdue], ['Submitted', 'Awaiting review', kpi.review],
    ['due', 'Due, not scheduled', kpi.due], ['Approved', 'Approved'], ['Rejected', 'Rejected'], ['all', 'All'],
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Inspections</h1>
          <div className="page-sub">Schedule → inspect → submit report → review. Approval updates the asset's condition and next due date.</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: 'schedule' })}>
          <i className="fa-solid fa-plus" /> Schedule inspection
        </button>
      </header>

      <div className="kpi-row">
        <Mini label="Open" value={kpi.open} tone="blue" />
        <Mini label="Overdue" value={kpi.overdue} tone="red" />
        <Mini label="Awaiting review" value={kpi.review} tone="orange" />
        <Mini label="Due in 7 days" value={kpi.upcoming} tone="navy" />
        <Mini label="Approved" value={kpi.approved} tone="green" />
      </div>

      <div className="tab-bar card" role="tablist" style={{ marginBottom: 12 }}>
        {tabs.map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={`tab-btn${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>
            {label}{n ? <span className="tab-count">{n}</span> : null}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        {insps === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : error ? <div className="empty-state"><div className="empty-title">Could not load inspections</div><div className="empty-sub">{error}</div>
              <button className="btn btn-secondary btn-sm" onClick={load}>Retry</button></div>
          : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fa-solid fa-clipboard-check" /></div>
              <div className="empty-title">Nothing here</div>
              <div className="empty-sub">No inspections match this view</div>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Inspection</th><th>Asset</th><th>Type</th><th>Scheduled</th><th>Inspector</th><th>Status</th><th>Finding</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map(r => r.kind === 'due' ? (
                  <tr key={`due-${r.asset.assetId}`} className="row-muted">
                    <td className="cell-sub">From asset schedule</td>
                    <td><Link to={`/assets/${encodeURIComponent(assetKey(r.asset))}`} style={{ color: 'inherit' }}><strong>{r.asset.name}</strong></Link><div className="id-cell">{assetKey(r.asset)}</div></td>
                    <td className="cell-sub">—</td>
                    <td className="mono" style={{ fontSize: 11 }}>{formatDate(r.date)}{r.date < today && <div><Tag tone="red">Overdue</Tag></div>}</td>
                    <td className="cell-sub">—</td>
                    <td><Tag tone="gray">Not scheduled</Tag></td>
                    <td className="cell-sub">—</td>
                    <td><button className="btn btn-secondary btn-xs" onClick={() => setModal({ kind: 'schedule', asset: r.asset, date: r.date < today ? undefined : r.date })}>
                      <i className="fa-solid fa-calendar-plus" /> Schedule</button></td>
                  </tr>
                ) : (() => {
                  const i = r.insp;
                  const a = byAsset.get(i.assetId);
                  const overdue = isOverdue(i);
                  return (
                    <tr key={i._id}>
                      <td className="id-cell">{i.inspectionCode || i.inspectionId}</td>
                      <td><Link to={`/assets/${encodeURIComponent(i.assetId)}`} style={{ color: 'inherit' }}><strong>{i.assetName || a?.name || i.assetId}</strong></Link><div className="id-cell">{i.assetId}</div></td>
                      <td style={{ fontSize: 12 }}>{i.type}</td>
                      <td className="mono" style={{ fontSize: 11, color: overdue ? 'var(--danger)' : undefined }}>
                        {formatDate(i.scheduledDate)}{overdue && <div><Tag tone="red">Overdue</Tag></div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{i.assignedTo || '—'}</td>
                      <td><Tag tone={STATUS_TONE[i.status]}>{i.status}</Tag></td>
                      <td>{i.report?.condition ? <ConditionTag value={i.report.condition} /> : <span className="cell-sub">—</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          {i.status === 'Scheduled' || i.status === 'Assigned' ? (
                            <button className="btn btn-ghost btn-xs" disabled={busy === i._id}
                                    onClick={() => act(i, 'Start', () => inspApi.updateInspection(i._id, { status: 'In Progress' }), 'Marked in progress')}>
                              <i className="fa-solid fa-play" /> Start</button>
                          ) : null}
                          {OPEN.includes(i.status) && (
                            <button className="btn btn-secondary btn-xs" onClick={() => setModal({ kind: 'submit', insp: i })}><i className="fa-solid fa-paper-plane" /> Report</button>
                          )}
                          {i.status === 'Submitted' && can('canApprove') && <>
                            <button className="btn btn-secondary btn-xs" disabled={busy === i._id}
                                    onClick={() => confirm(`Approve this report? ${i.assetName || i.assetId} will be set to ${i.report?.condition}.`) &&
                                      act(i, 'Approve', () => inspApi.approveInspection(i._id), 'Approved — asset condition updated')}>
                              <i className="fa-solid fa-check" /> Approve</button>
                            <button className="btn btn-danger btn-xs" onClick={() => setModal({ kind: 'reject', insp: i })}><i className="fa-solid fa-xmark" /> Reject</button>
                          </>}
                          {(i.report?.findings || (i.history?.length ?? 0) > 1) && (
                            <button className="btn btn-ghost btn-xs" onClick={() => setModal({ kind: 'view', insp: i })} title="View report"><i className="fa-solid fa-eye" /></button>
                          )}
                          {can('canEdit') && i.status !== 'Approved' && (
                            <button className="btn btn-danger btn-xs" title="Delete" disabled={busy === i._id}
                                    onClick={() => confirm('Delete this inspection?') && act(i, 'Delete', () => inspApi.deleteInspection(i._id), 'Inspection deleted')}>
                              <i className="fa-solid fa-trash" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })())}
              </tbody>
            </table>
          )}
      </div>

      {modal?.kind === 'schedule' && (
        <ScheduleInspectionModal asset={modal.asset} assets={assets} defaultDate={modal.date}
                                 onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.kind === 'submit' && <SubmitReportModal insp={modal.insp} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal?.kind === 'reject' && <RejectModal insp={modal.insp} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal?.kind === 'view' && <ReportModal insp={modal.insp} onClose={() => setModal(null)} />}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`card kpi kpi-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value.toLocaleString()}</div>
    </div>
  );
}

function SubmitReportModal({ insp, onClose, onDone }: { insp: Insp; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ condition: '', date: new Date().toISOString().slice(0, 10), findings: '', recommendations: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!form.condition || !form.findings.trim()) { setError('Condition and findings are required'); return; }
    setBusy(true); setError('');
    try {
      await inspApi.submitReport(insp._id, { ...form, findings: form.findings.trim(), recommendations: form.recommendations.trim() });
      toast('Report submitted for review');
      onDone();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`Inspection report — ${insp.assetName || insp.assetId}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> Submit for review</button>
    </>}>
      <div className="form-grid">
        <div><label className="form-label">Condition found</label>
          <select className="form-control" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
            <option value="">— Select —</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div><label className="form-label">Inspection date</label>
          <input className="form-control" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div className="full"><label className="form-label">Findings</label>
          <textarea className="form-control" rows={4} value={form.findings} onChange={e => setForm({ ...form, findings: e.target.value })} placeholder="What was observed on site" /></div>
        <div className="full"><label className="form-label">Recommendations</label>
          <textarea className="form-control" value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} placeholder="Repairs, follow-up, etc. (added to the asset's notes on approval)" /></div>
      </div>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}

function RejectModal({ insp, onClose, onDone }: { insp: Insp; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function reject() {
    setBusy(true);
    try { await inspApi.rejectInspection(insp._id, reason.trim()); toast('Report rejected'); onDone(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title="Reject inspection report" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-danger" onClick={reject} disabled={busy}><i className="fa-solid fa-xmark" /> Reject</button>
    </>}>
      <label className="form-label" htmlFor="rej">Reason (shown to the inspector)</label>
      <textarea id="rej" className="form-control" autoFocus value={reason} onChange={e => setReason(e.target.value)} />
    </Modal>
  );
}

function ReportModal({ insp, onClose }: { insp: Insp; onClose: () => void }) {
  const r = insp.report || {};
  return (
    <Modal wide title={`${insp.inspectionCode || insp.inspectionId} — ${insp.assetName || insp.assetId}`} onClose={onClose}>
      <div className="meta-grid" style={{ marginBottom: 16 }}>
        <div><div className="meta-key">Type</div><div className="meta-val">{insp.type}</div></div>
        <div><div className="meta-key">Status</div><div className="meta-val"><Tag tone={STATUS_TONE[insp.status]}>{insp.status}</Tag></div></div>
        <div><div className="meta-key">Condition found</div><div className="meta-val">{r.condition ? <ConditionTag value={r.condition} /> : '—'}</div></div>
        <div><div className="meta-key">Inspected on</div><div className="meta-val">{formatDate(r.date)}</div></div>
        <div><div className="meta-key">Submitted by</div><div className="meta-val">{r.submittedBy || '—'}</div></div>
        <div><div className="meta-key">Reviewed by</div><div className="meta-val">{insp.reviewedBy || '—'}</div></div>
        <div className="full"><div className="meta-key">Findings</div><div className="meta-val" style={{ whiteSpace: 'pre-wrap' }}>{r.findings || '—'}</div></div>
        {r.recommendations && <div className="full"><div className="meta-key">Recommendations</div><div className="meta-val" style={{ whiteSpace: 'pre-wrap' }}>{r.recommendations}</div></div>}
        {insp.rejectionReason && <div className="full"><div className="meta-key">Rejection reason</div><div className="meta-val">{insp.rejectionReason}</div></div>}
      </div>
      {!!insp.history?.length && (
        <>
          <div className="meta-key" style={{ marginBottom: 8 }}>History</div>
          <ul className="timeline">
            {insp.history.map((h, k) => (
              <li key={k}><span className="muted" style={{ width: 110, fontSize: 12 }}>{formatDate(h.at)}</span>
                <Tag tone={STATUS_TONE[h.status] || 'gray'}>{h.status}</Tag> <span className="cell-sub">{h.by}{h.note ? ` — ${h.note}` : ''}</span></li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
