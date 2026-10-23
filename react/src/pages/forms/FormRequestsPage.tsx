import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as formsApi from '../../api/forms';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Tag } from '../../components/Tags';
import { formatDate, timeAgo, type Tone } from '../../lib/assets';
import { FORM_DATA_FIELD, FORM_ICONS, FORM_LABELS, FORM_LINKS_TO_ASSET, FORM_REQUIRES_ATTACHMENT } from './formDefs';
import FormRenderer from './FormRenderer';
import { buildCertificatePdf, certificateNumberFor } from './certificate';
import type { FormRequest, FormStatus } from '../../api/forms';

const STATUS_TONE: Record<FormStatus, Tone> = { Draft: 'gray', Submitted: 'blue', UnderReview: 'warn', Approved: 'green', Deferred: 'orange', Rejected: 'red' };
const statusLabel = (s: string) => (s === 'UnderReview' ? 'Under review' : s);
const FORM_TYPES = Object.keys(FORM_LABELS);

export default function FormRequestsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<FormRequest[] | null>(null);
  const [error, setError] = useState('');
  const [f, setF] = useState({ q: '', status: '', type: '', mda: '' });
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setList(await formsApi.listFormRequests()); } catch (err) { setError(errorMessage(err)); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const mdas = useMemo(() => [...new Set((list || []).map(r => r.mda))].sort(), [list]);
  const shown = useMemo(() => (list || []).filter(r =>
    (!f.status || r.status === f.status) && (!f.type || r.formType === f.type) && (!f.mda || r.mda === f.mda) &&
    (!f.q.trim() || [r.mda, FORM_LABELS[r.formType], r.certificateNumber, r.submittedBy?.name].some(v => (v || '').toLowerCase().includes(f.q.trim().toLowerCase())))
  ), [list, f]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    (list || []).forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  }, [list]);
  const toReview = (counts.Submitted || 0) + (counts.UnderReview || 0);

  async function remove(r: FormRequest) {
    if (!confirm('Delete this draft?')) return;
    try { await formsApi.deleteFormRequest(r._id); toast('Draft deleted'); load(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Form requests</h1>
          <div className="page-sub">Compliance forms submitted by MDAs · {toReview} waiting for review</div>
        </div>
        {can('canReviewFormRequests') ? (
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><i className="fa-solid fa-plus" /> New request for an MDA</button>
        ) : null}
      </header>

      <div className="tab-bar card" role="tablist" style={{ marginBottom: 12 }}>
        {[['', 'All'], ['Submitted', 'Submitted'], ['UnderReview', 'Under review'], ['Approved', 'Approved'], ['Deferred', 'Deferred'], ['Rejected', 'Rejected'], ['Draft', 'Drafts']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={f.status === k} className={`tab-btn${f.status === k ? ' active' : ''}`} onClick={() => setF(x => ({ ...x, status: k }))}>
            {label}{k && counts[k] ? <span className="tab-count">{counts[k]}</span> : null}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <div className="search"><i className="fa-solid fa-magnifying-glass" />
          <input className="filter-input" placeholder="Search MDA, form, certificate no…" value={f.q} onChange={e => setF(x => ({ ...x, q: e.target.value }))} aria-label="Search" /></div>
        <select className="filter-input" value={f.type} onChange={e => setF(x => ({ ...x, type: e.target.value }))} aria-label="Form type" style={{ maxWidth: 320 }}>
          <option value="">All form types</option>{FORM_TYPES.map(t => <option key={t} value={t}>{FORM_LABELS[t]}</option>)}
        </select>
        <select className="filter-input" value={f.mda} onChange={e => setF(x => ({ ...x, mda: e.target.value }))} aria-label="MDA" style={{ maxWidth: 260 }}>
          <option value="">All MDAs</option>{mdas.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="card table-wrap">
        {list === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : error ? <div className="empty-state"><div className="empty-title">Could not load requests</div><div className="empty-sub">{error}</div></div>
          : shown.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-file-circle-check" /></div><div className="empty-title">No requests</div><div className="empty-sub">Nothing matches these filters</div></div>
          : (
            <table className="data-table">
              <thead><tr><th>Form</th><th>MDA</th><th>Submitted</th><th>Status</th><th>Certificate</th><th>Files</th><th /></tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r._id}>
                    <td><div className="row" style={{ flexWrap: 'nowrap' }}><i className={`fa-solid ${FORM_ICONS[r.formType] || 'fa-file'}`} style={{ color: 'var(--accent)', width: 18 }} />
                      <div><strong style={{ fontSize: 13 }}>{FORM_LABELS[r.formType] || r.formType}</strong>{r.linkedAssetId && <div className="id-cell">{r.linkedAssetId}</div>}</div></div></td>
                    <td style={{ fontSize: 12 }}>{r.mda}</td>
                    <td className="cell-sub" title={formatDate(r.createdAt)}>{timeAgo(r.createdAt)}{r.submittedBy?.name && <div>{r.submittedBy.name}</div>}</td>
                    <td><Tag tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Tag></td>
                    <td className="cell-sub">{r.certificateIssued ? <><span className="mono" style={{ fontSize: 10 }}>{r.certificateNumber}</span>{r.physicalCopyIssued && <div>Physical copy issued</div>}</> : '—'}</td>
                    <td className="cell-sub">{r.attachments?.length || 0}</td>
                    <td><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setReviewing(r._id)}>{['Submitted', 'UnderReview'].includes(r.status) ? 'Review' : 'Open'}</button>
                      {r.status === 'Draft' && <button className="btn btn-danger btn-xs" onClick={() => remove(r)} aria-label="Delete draft"><i className="fa-solid fa-trash" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {reviewing && <ReviewModal id={reviewing} onClose={() => setReviewing(null)} onChanged={load} />}
      {creating && <NewRequestModal mdas={mdas} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </div>
  );
}

// ── Review ───────────────────────────────────────────────────────────────────
function ReviewModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [req, setReq] = useState<FormRequest | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    formsApi.getFormRequest(id).then(r => { setReq(r); setRemarks(r.reviewRemarks || ''); }).catch(err => { toast(errorMessage(err), 'error'); onClose(); });
  }, [id, toast, onClose]);

  if (!req) return <Modal title="Loading…" onClose={onClose}><div className="loading"><i className="fa-solid fa-spinner fa-spin" /></div></Modal>;
  const data = (req[FORM_DATA_FIELD[req.formType]] || {}) as Record<string, unknown>;

  async function run(label: string, fn: () => Promise<FormRequest | unknown>, msg: string) {
    setBusy(label);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && '_id' in r) setReq(r as FormRequest);
      toast(msg); onChanged();
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(''); }
  }
  const setStatus = (status: FormStatus) =>
    run(status, () => formsApi.reviewFormRequest(req._id, { status, reviewRemarks: remarks }), `Marked ${statusLabel(status).toLowerCase()}`);

  async function issue() {
    if (!req) return;
    const number = certificateNumberFor(req);
    await run('cert', async () => {
      const pdf = await buildCertificatePdf(req, number);
      const updated = await formsApi.issueCertificate(req._id, pdf, number);
      // Officer gets a local copy to print.
      const a = document.createElement('a'); a.href = URL.createObjectURL(pdf); a.download = `FPAM-Certificate-${req.mda}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return updated;
    }, `Certificate ${number} issued`);
  }

  const open = async (attId: string) => {
    try { window.open(await formsApi.openAttachment(req._id, attId), '_blank'); } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const reviewable = req.status !== 'Draft';
  return (
    <Modal wide title={`${FORM_LABELS[req.formType] || req.formType} — ${req.mda}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Close</button>
      {reviewable && <>
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => setStatus('UnderReview')}>Under review</button>
        <button className="btn btn-danger" disabled={!!busy} onClick={() => setStatus('Rejected')}><i className="fa-solid fa-xmark" /> Reject</button>
        <button className="btn btn-secondary" disabled={!!busy} onClick={() => setStatus('Deferred')}><i className="fa-solid fa-clock" /> Defer</button>
        <button className="btn btn-primary" disabled={!!busy} onClick={() => setStatus('Approved')}><i className="fa-solid fa-check" /> Approve</button>
      </>}
    </>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Tag tone={STATUS_TONE[req.status]}>{statusLabel(req.status)}</Tag>
        <span className="cell-sub">Submitted {formatDate(req.createdAt)}{req.submittedBy?.name ? ` by ${req.submittedBy.name}` : ''}</span>
        {req.reviewedBy?.name && <span className="cell-sub">· last reviewed by {req.reviewedBy.name} {timeAgo(req.reviewedAt)}</span>}
        {req.linkedAssetId && <Link className="cell-sub" to={`/assets/${encodeURIComponent(req.linkedAssetId)}`}>Asset {req.linkedAssetId}</Link>}
      </div>

      {req.status === 'Approved' && (
        <div className="alert alert-cert">
          <i className="fa-solid fa-certificate" />
          {req.certificateIssued ? (
            <>
              <span>Certificate <strong className="mono">{req.certificateNumber}</strong> issued {formatDate(req.certificateIssuedAt)}{req.physicalCopyIssued ? ' · physical copy issued' : ''}</span>
              <div className="row" style={{ marginLeft: 'auto' }}>
                <button className="btn btn-ghost btn-xs" onClick={() => formsApi.downloadCertificate(req._id, `FPAM-Certificate-${req.mda}.pdf`).catch(err => toast(errorMessage(err), 'error'))}><i className="fa-solid fa-download" /> Download</button>
                {!req.physicalCopyIssued && <button className="btn btn-secondary btn-xs" disabled={!!busy} onClick={() => run('phys', () => formsApi.markPhysicalIssued(req._id), 'Physical copy recorded')}>Mark physical copy issued</button>}
              </div>
            </>
          ) : (
            <>
              <span>Approved — no certificate issued yet.</span>
              <button className="btn btn-primary btn-xs" style={{ marginLeft: 'auto' }} disabled={!!busy} onClick={issue}>
                <i className={`fa-solid ${busy === 'cert' ? 'fa-spinner fa-spin' : 'fa-certificate'}`} /> Issue certificate</button>
            </>
          )}
        </div>
      )}

      <FormRenderer formType={req.formType} value={data} readOnly />

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Supporting documents</h3>
      {req.attachments?.length ? (
        <div className="list">
          {req.attachments.map(a => (
            <div className="list-row" key={a._id}>
              <i className="fa-solid fa-paperclip" style={{ color: 'var(--accent)' }} />
              <div className="list-main"><div>{a.label || a.originalname || a.filename}</div><div className="cell-sub">{a.label ? a.originalname : ''}{a.sizeBytes ? ` · ${Math.ceil(a.sizeBytes / 1024)} KB` : ''}</div></div>
              <button className="btn btn-ghost btn-xs" onClick={() => open(a._id)}><i className="fa-solid fa-eye" /> View</button>
              <button className="btn btn-ghost btn-xs" onClick={() => formsApi.downloadAttachment(req._id, a._id, a.originalname || 'attachment').catch(err => toast(errorMessage(err), 'error'))}><i className="fa-solid fa-download" /></button>
            </div>
          ))}
        </div>
      ) : <div className="cell-sub">{FORM_REQUIRES_ATTACHMENT[req.formType] ? 'This form type expects supporting documents, but none were attached.' : 'None attached.'}</div>}

      {reviewable && <>
        <label className="form-label" htmlFor="rv-remarks" style={{ marginTop: 16 }}>Review remarks (shown to the MDA)</label>
        <textarea id="rv-remarks" className="form-control" value={remarks} onChange={e => setRemarks(e.target.value)} />
      </>}
    </Modal>
  );
}

// ── New request on behalf of an MDA ──────────────────────────────────────────
function NewRequestModal({ mdas: knownMdas, onClose, onDone }: { mdas: string[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState('');
  const [mda, setMda] = useState('');
  const [mdas, setMdas] = useState<string[]>(knownMdas);
  const [linkedAssetId, setLinked] = useState('');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { assetsApi.getMdaNames().then(m => setMdas([...new Set([...m, ...knownMdas])].sort())); }, [knownMdas]);

  async function submit(asDraft: boolean) {
    if (!mda) { setError('Choose the MDA this request is for'); return; }
    if (!asDraft && FORM_REQUIRES_ATTACHMENT[type] && !files.length) { setError('This form needs at least one supporting document'); return; }
    setBusy(true); setError('');
    try {
      const created = await formsApi.createFormRequest({
        formType: type, mda, status: asDraft ? 'Draft' : 'Submitted', [FORM_DATA_FIELD[type]]: data,
        ...(FORM_LINKS_TO_ASSET[type] && linkedAssetId.trim() ? { linkedAssetId: linkedAssetId.trim() } : {}),
      });
      const failed: string[] = [];
      for (const file of files) { try { await formsApi.addAttachment(created._id, file); } catch (err) { failed.push(`${file.name}: ${errorMessage(err)}`); } }
      toast(asDraft ? 'Saved as draft' : 'Request submitted');
      if (failed.length) toast(`${failed.length} file(s) failed to upload — ${failed[0]}`, 'error');
      onDone();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  if (!type) {
    return (
      <Modal wide title="Choose a form" onClose={onClose}>
        <div className="form-type-grid">
          {FORM_TYPES.map(t => (
            <button key={t} className="form-type-card" onClick={() => setType(t)}>
              <i className={`fa-solid ${FORM_ICONS[t] || 'fa-file'}`} /><span>{FORM_LABELS[t]}</span>
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal wide title={FORM_LABELS[type]} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={() => setType('')}>Back</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => submit(true)}>Save draft</button>
      <button className="btn btn-primary" disabled={busy} onClick={() => submit(false)}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> Submit</button>
    </>}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div><label className="form-label">MDA *</label>
          <select className="form-control" value={mda} onChange={e => setMda(e.target.value)}>
            <option value="">— Select MDA —</option>{mdas.map(m => <option key={m}>{m}</option>)}
          </select></div>
        {FORM_LINKS_TO_ASSET[type] && <div><label className="form-label">Linked asset ID</label>
          <input className="form-control" value={linkedAssetId} onChange={e => setLinked(e.target.value)} placeholder="e.g. AST-1001" /></div>}
      </div>
      <FormRenderer formType={type} value={data} onChange={setData} />
      <h3 className="form-section-title" style={{ marginTop: 18 }}>Supporting documents{FORM_REQUIRES_ATTACHMENT[type] ? ' *' : ''}</h3>
      <label className="drop-zone">
        <i className="fa-solid fa-paperclip" /> <strong>Attach files</strong><span className="cell-sub">PDF, images, Word, Excel — up to 15 MB each</span>
        <input type="file" multiple hidden onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; setFiles(x => [...x, ...picked]); }} />
      </label>
      {files.length > 0 && <div className="file-chips">{files.map((file, i) => (
        <span className="file-chip" key={`${file.name}-${i}`}><i className="fa-solid fa-file" /> <span>{file.name}</span>
          <button type="button" onClick={() => setFiles(x => x.filter((_, k) => k !== i))} aria-label={`Remove ${file.name}`}><i className="fa-solid fa-xmark" /></button></span>
      ))}</div>}
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}
