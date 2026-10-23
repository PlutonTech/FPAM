import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as misc from '../api/misc';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { Tag, TypeTag } from '../components/Tags';
import type { Asset, UserRef } from '../types';
import { assetKey, formatDate, timeAgo } from '../lib/assets';

const STATUS_TONE = { Pending: 'warn', Approved: 'green', Rejected: 'red' } as const;

const person = (u: Asset['capturedBy']) => (u && typeof u === 'object' ? u as UserRef : null);

export default function ApprovalsPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<misc.ApprovalStatus>('Pending');
  const [list, setList] = useState<Asset[] | null>(null);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ pending: number; approved: number; rejected: number } | null>(null);
  const [rejecting, setRejecting] = useState<Asset | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setList(null); setError('');
    try { setList(await misc.listApprovals(status)); }
    catch (err) { setError(errorMessage(err)); setList([]); }
    misc.approvalsSummary().then(setSummary).catch(() => {});
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const canReview = can('canApprove');
  // The backend refuses self-review; hide the buttons rather than show a 403.
  const isOwn = (a: Asset) => {
    const sub = person(a.submittedBy) || person(a.capturedBy);
    return !!user && sub?._id === user._id;
  };

  async function approve(a: Asset) {
    const id = assetKey(a);
    if (!confirm(`Approve ${a.name}? It will join the verified registry.`)) return;
    setBusyId(id);
    try { await misc.approveAsset(id); toast(`${a.name} approved`); await load(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusyId(null); }
  }

  async function confirmReject() {
    if (!rejecting) return;
    const id = assetKey(rejecting);
    setBusyId(id);
    try {
      await misc.rejectAsset(id, reason.trim());
      toast(`${rejecting.name} rejected`);
      setRejecting(null); setReason('');
      await load();
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <div className="page-sub">Captures waiting for review before they join the verified registry</div>
        </div>
        <select className="filter-input" style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value as misc.ApprovalStatus)} aria-label="Status">
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
          <option value="Approved">Approved</option>
          <option value="all">All</option>
        </select>
      </header>

      <div className="appr-stats">
        <button className={`card appr-stat${status === 'Pending' ? ' active' : ''}`} onClick={() => setStatus('Pending')}>
          <div className="kpi-label">Pending review</div><div className="kpi-value" style={{ color: '#8a5e00' }}>{summary?.pending ?? '—'}</div>
        </button>
        <button className={`card appr-stat${status === 'Approved' ? ' active' : ''}`} onClick={() => setStatus('Approved')}>
          <div className="kpi-label">Approved</div><div className="kpi-value" style={{ color: '#0f7a4d' }}>{summary?.approved ?? '—'}</div>
        </button>
        <button className={`card appr-stat${status === 'Rejected' ? ' active' : ''}`} onClick={() => setStatus('Rejected')}>
          <div className="kpi-label">Rejected</div><div className="kpi-value" style={{ color: '#a02020' }}>{summary?.rejected ?? '—'}</div>
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
        <i className="fa-solid fa-circle-info" /> Field Agent, Sub-Head and Supervisor captures wait here until someone else with approval rights reviews them.
        System Admin captures are verified automatically. Rejected captures can be approved after a second look.
      </p>

      <div className="card table-wrap">
        {list === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : error ? <div className="empty-state"><div className="empty-title">Could not load approvals</div><div className="empty-sub">{error}</div>
              <button className="btn btn-secondary btn-sm" onClick={load}>Retry</button></div>
          : list.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fa-solid fa-clipboard-check" /></div>
              <div className="empty-title">Nothing here</div>
              <div className="empty-sub">No captures match this filter</div>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Asset</th><th>Type</th><th>Location</th><th>Submitted by</th><th>Captured</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {list.map(a => {
                  const id = assetKey(a);
                  const sub = person(a.submittedBy) || person(a.capturedBy);
                  const st = a.approvalStatus || 'Approved';
                  const own = isOwn(a);
                  const reviewable = canReview && !own && (st === 'Pending' || st === 'Rejected');
                  return (
                    <tr key={id}>
                      <td><strong>{a.name}</strong><div className="id-cell">{id}</div></td>
                      <td><TypeTag value={a.type} /></td>
                      <td style={{ fontSize: 12 }}>{[a.lga, a.state].filter(Boolean).join(', ') || '—'}</td>
                      <td style={{ fontSize: 12 }}>{sub?.name || '—'}{sub?.role && <div className="cell-sub">{sub.role}</div>}</td>
                      <td className="cell-sub" title={formatDate(a.captureDate || a.createdAt)}>{timeAgo(a.captureDate || a.createdAt)}</td>
                      <td>
                        <Tag tone={STATUS_TONE[st]}>{st}</Tag>
                        {st === 'Rejected' && a.rejectionReason && <div className="cell-sub" style={{ maxWidth: 220 }}>{a.rejectionReason}</div>}
                      </td>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                          <Link className="btn btn-ghost btn-xs" to={`/assets/${encodeURIComponent(id)}`} title="View"><i className="fa-solid fa-eye" /></Link>
                          {reviewable && (
                            <button className="btn btn-secondary btn-xs" disabled={busyId === id} onClick={() => approve(a)}>
                              <i className="fa-solid fa-check" /> Approve
                            </button>
                          )}
                          {reviewable && st === 'Pending' && (
                            <button className="btn btn-danger btn-xs" disabled={busyId === id} onClick={() => { setRejecting(a); setReason(''); }}>
                              <i className="fa-solid fa-xmark" /> Reject
                            </button>
                          )}
                          {canReview && own && st === 'Pending' && <span className="cell-sub">Your capture</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      {rejecting && (
        <Modal title={`Reject ${rejecting.name}`} onClose={() => setRejecting(null)} footer={<>
          <button className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={confirmReject} disabled={busyId === assetKey(rejecting)}><i className="fa-solid fa-xmark" /> Reject capture</button>
        </>}>
          <label className="form-label" htmlFor="reason">Reason (shown to the submitter)</label>
          <textarea id="reason" className="form-control" rows={3} autoFocus value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="e.g. GPS coordinates look wrong — please recapture on site" />
        </Modal>
      )}
    </div>
  );
}
