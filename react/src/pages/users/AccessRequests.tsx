import { useCallback, useEffect, useState } from 'react';
import * as usersApi from '../../api/users';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { useToast } from '../../components/Toast';
import { formatDate, timeAgo, type Tone } from '../../lib/assets';
import type { AccessRequest } from '../../api/users';

const TONE: Record<AccessRequest['status'], Tone> = { pending: 'orange', approved: 'green', declined: 'gray' };

/**
 * Requests from the public site's "Request access" form. Approving means
 * creating the account (the usual Add user form, pre-filled); the request is
 * marked approved once the account is saved.
 */
export default function AccessRequests({ onCount, onCreateAccount }: {
  onCount: (n: number) => void;
  onCreateAccount: (r: AccessRequest, approve: () => void) => void;
}) {
  const toast = useToast();
  const [list, setList] = useState<AccessRequest[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'pending' | ''>('pending');
  const [declining, setDeclining] = useState<AccessRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await usersApi.listAccessRequests();
      setList(r.requests); onCount(r.counts.pending || 0); setError('');
    } catch (err) { setError(errorMessage(err)); }
  }, [onCount]);
  useEffect(() => { load(); }, [load]);

  const approveAfterCreate = (r: AccessRequest) => () => {
    usersApi.decideAccessRequest(r._id, 'approved')
      .then(() => { toast(`Request from ${r.name} approved`); load(); })
      .catch(err => toast(`Account created, but the request could not be marked approved: ${errorMessage(err)}`, 'error'));
  };

  const shown = (list || []).filter(r => !filter || r.status === filter);
  return (
    <>
      <div className="filter-bar">
        <select className="filter-input" style={{ maxWidth: 200 }} value={filter} onChange={e => setFilter(e.target.value as 'pending' | '')} aria-label="Status">
          <option value="pending">Waiting for review</option><option value="">All requests</option>
        </select>
        <span className="cell-sub">From the website's "Request access" page. Create the account to approve a request.</span>
      </div>
      <div className="card table-wrap">
        {list === null ? <div className="loading">{error || <><i className="fa-solid fa-spinner fa-spin" /> Loading…</>}</div>
          : shown.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-user-clock" /></div><div className="empty-title">No {filter ? 'pending ' : ''}access requests</div></div> : (
          <table className="data-table">
            <thead><tr><th>Person</th><th>Organisation</th><th>Role asked for</th><th>Reason</th><th>Received</th><th>Status</th><th /></tr></thead>
            <tbody>{shown.map(r => (
              <tr key={r._id}>
                <td><strong>{r.name}</strong><div className="cell-sub">{r.email}</div></td>
                <td>{r.organisation}</td>
                <td>{r.requestedRole}</td>
                <td className="cell-sub" style={{ maxWidth: 260, whiteSpace: 'pre-wrap' }}>{r.reason || '—'}</td>
                <td title={formatDate(r.createdAt)}>{timeAgo(r.createdAt)}</td>
                <td><Tag tone={TONE[r.status]}>{r.status}</Tag>
                  {r.status !== 'pending' && <div className="cell-sub">{r.decidedByName}{r.note ? `: ${r.note}` : ''}</div>}</td>
                <td>{r.status === 'pending' && <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <button className="btn btn-primary btn-xs" onClick={() => onCreateAccount(r, approveAfterCreate(r))}><i className="fa-solid fa-user-plus" /> Create account</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setDeclining(r)}>Decline</button>
                </div>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {declining && <DeclineModal request={declining} onClose={() => setDeclining(null)} onDone={() => { setDeclining(null); load(); }} />}
    </>
  );
}

function DeclineModal({ request, onClose, onDone }: { request: AccessRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!note.trim()) { toast('Give a reason', 'error'); return; }
    setBusy(true);
    try { await usersApi.decideAccessRequest(request._id, 'declined', note.trim()); toast('Request declined'); onDone(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={`Decline ${request.name}'s request`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-danger" disabled={busy} onClick={save}>Decline</button></>}>
      <label className="form-label">Reason (kept on record)</label>
      <textarea className="form-control" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="e.g. Not employed by an MDA; ask your agency's focal person" />
      <p className="cell-sub" style={{ marginTop: 8 }}>The person isn't emailed automatically. Let them know through your usual channel if needed.</p>
    </Modal>
  );
}
