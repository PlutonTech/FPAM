import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as formsApi from '../../api/forms';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Tag } from '../../components/Tags';
import { formatDate, timeAgo, type Tone } from '../../lib/assets';
import FormRenderer from '../forms/FormRenderer';
import { FORM_DATA_FIELD, FORM_ICONS, FORM_LABELS, FORM_LINKS_TO_ASSET, FORM_REQUIRES_ATTACHMENT, FORM_TEMPLATE_FILE } from '../forms/formDefs';
import type { FormRequest, FormStatus } from '../../api/forms';

const STATUS_TONE: Record<FormStatus, Tone> = { Draft: 'gray', Submitted: 'blue', UnderReview: 'warn', Approved: 'green', Deferred: 'orange', Rejected: 'red' };
const label = (s: string) => (s === 'UnderReview' ? 'Under review' : s);
const FORM_TYPES = Object.keys(FORM_LABELS);
// Blank templates are served from public/templates.
const TEMPLATE_BASE = '/';

/**
 * Stand-alone portal for MDA Agents: submit compliance forms for their own
 * MDA and follow them through review. The backend scopes everything to the
 * agent's MDA, so there's no MDA picker here.
 */
export default function PortalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState<FormRequest[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<{ type: string; draft?: FormRequest } | 'pick' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try { setList(await formsApi.listFormRequests()); } catch (err) { setError(errorMessage(err)); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    (list || []).forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  }, [list]);
  const shown = (list || []).filter(r => !status || r.status === status);

  async function remove(r: FormRequest) {
    if (!confirm('Delete this draft?')) return;
    try { await formsApi.deleteFormRequest(r._id); toast('Draft deleted'); load(); } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <div className="portal">
      <header className="portal-hd">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div><div className="portal-title">FPAM compliance portal</div><div className="portal-mda">{user?.mda || 'No MDA assigned'}</div></div>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <span className="portal-user">{user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/login'); }}><i className="fa-solid fa-right-from-bracket" /> Log out</button>
        </div>
      </header>

      <main className="page" style={{ margin: '0 auto' }}>
        {!user?.mda && <div className="alert alert-warn"><i className="fa-solid fa-triangle-exclamation" /> Your account has no MDA assigned, so you can't submit forms yet. Contact your FPAM System Admin.</div>}
        <header className="page-header">
          <div><h1 className="page-title">Your submissions</h1><div className="page-sub">Compliance forms your MDA has sent to FPAM</div></div>
          <button className="btn btn-primary btn-sm" disabled={!user?.mda} onClick={() => setEditing('pick')}><i className="fa-solid fa-plus" /> New submission</button>
        </header>

        <div className="kpi-row">
          {([['Submitted', (counts.Submitted || 0) + (counts.UnderReview || 0), 'blue'], ['Approved', counts.Approved || 0, 'green'],
             ['Deferred', counts.Deferred || 0, 'orange'], ['Rejected', counts.Rejected || 0, 'red'], ['Drafts', counts.Draft || 0, 'navy']] as const).map(([l, v, t]) => (
            <div key={l} className={`card kpi kpi-${t}`}><div className="kpi-label">{l}</div><div className="kpi-value">{v}</div></div>
          ))}
        </div>

        <div className="tab-bar card" role="tablist" style={{ marginBottom: 12 }}>
          {[['', 'All'], ['Draft', 'Drafts'], ['Submitted', 'Submitted'], ['UnderReview', 'Under review'], ['Approved', 'Approved'], ['Deferred', 'Deferred'], ['Rejected', 'Rejected']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={status === k} className={`tab-btn${status === k ? ' active' : ''}`} onClick={() => setStatus(k)}>{l}{k && counts[k] ? <span className="tab-count">{counts[k]}</span> : null}</button>
          ))}
        </div>

        <div className="card table-wrap">
          {list === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
            : error ? <div className="empty-state"><div className="empty-title">Could not load your submissions</div><div className="empty-sub">{error}</div></div>
            : shown.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-file-circle-plus" /></div><div className="empty-title">Nothing here yet</div>
                <div className="empty-sub">Start a new submission to send a compliance form to FPAM.</div></div>
            : (
              <table className="data-table">
                <thead><tr><th>Form</th><th>Created</th><th>Status</th><th>FPAM remarks</th><th /></tr></thead>
                <tbody>
                  {shown.map(r => (
                    <tr key={r._id}>
                      <td><div className="row" style={{ flexWrap: 'nowrap' }}><i className={`fa-solid ${FORM_ICONS[r.formType] || 'fa-file'}`} style={{ color: 'var(--accent)', width: 18 }} /><strong style={{ fontSize: 13 }}>{FORM_LABELS[r.formType] || r.formType}</strong></div></td>
                      <td className="cell-sub" title={formatDate(r.createdAt)}>{timeAgo(r.createdAt)}</td>
                      <td><Tag tone={STATUS_TONE[r.status]}>{label(r.status)}</Tag>{r.certificateIssued && <div className="cell-sub"><i className="fa-solid fa-certificate" /> Certificate issued</div>}</td>
                      <td className="cell-sub" style={{ maxWidth: 280 }}>{r.reviewRemarks || '—'}</td>
                      <td><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        {r.status === 'Draft'
                          ? <><button className="btn btn-secondary btn-xs" onClick={() => setEditing({ type: r.formType, draft: r })}>Continue</button>
                              <button className="btn btn-danger btn-xs" onClick={() => remove(r)} aria-label="Delete draft"><i className="fa-solid fa-trash" /></button></>
                          : <button className="btn btn-secondary btn-xs" onClick={() => setViewing(r._id)}>Open</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </main>

      {editing === 'pick' && (
        <Modal wide title="Which form are you submitting?" onClose={() => setEditing(null)}>
          <div className="form-type-grid">{FORM_TYPES.map(t => (
            <button key={t} className="form-type-card" onClick={() => setEditing({ type: t })}><i className={`fa-solid ${FORM_ICONS[t] || 'fa-file'}`} /><span>{FORM_LABELS[t]}</span></button>
          ))}</div>
        </Modal>
      )}
      {editing && editing !== 'pick' && <EditorModal type={editing.type} draft={editing.draft} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
      {viewing && <ViewModal id={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </div>
  );
}

function EditorModal({ type, draft, onClose, onDone }: { type: string; draft?: FormRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const field = FORM_DATA_FIELD[type];
  const [data, setData] = useState<Record<string, unknown>>(() => (draft?.[field] as Record<string, unknown>) || {});
  const [linked, setLinked] = useState(draft?.linkedAssetId || '');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existingFiles = draft?.attachments?.length || 0;

  async function save(asDraft: boolean) {
    if (!asDraft && FORM_REQUIRES_ATTACHMENT[type] && !files.length && !existingFiles) { setError('Attach at least one supporting document before submitting'); return; }
    if (!asDraft && !confirm('Submit to FPAM? You won\'t be able to edit it after submitting.')) return;
    setBusy(true); setError('');
    try {
      const linkedAssetId = FORM_LINKS_TO_ASSET[type] ? (linked.trim() || null) : undefined;
      let id = draft?._id;
      if (draft) {
        // Upload files before submitting: once submitted, the draft can't change.
        await formsApi.updateDraft(draft._id, { [field]: data, ...(linkedAssetId !== undefined ? { linkedAssetId } : {}) });
      } else {
        const created = await formsApi.createFormRequest({ formType: type, status: 'Draft', [field]: data, ...(linkedAssetId ? { linkedAssetId } : {}) });
        id = created._id;
      }
      const failed: string[] = [];
      for (const f of files) { try { await formsApi.addAttachment(id!, f); } catch (err) { failed.push(`${f.name}: ${errorMessage(err)}`); } }
      if (failed.length) {
        setError(`Saved as draft, but ${failed.length} file(s) failed to upload — ${failed[0]}. Try again before submitting.`);
        return;
      }
      if (!asDraft) await formsApi.updateDraft(id!, { status: 'Submitted' });
      toast(asDraft ? 'Draft saved' : 'Submitted to FPAM');
      onDone();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Modal wide title={FORM_LABELS[type]} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => save(true)}>Save draft</button>
      <button className="btn btn-primary" disabled={busy} onClick={() => save(false)}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> Submit to FPAM</button>
    </>}>
      {FORM_TEMPLATE_FILE[type] && (
        <a className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} href={TEMPLATE_BASE + FORM_TEMPLATE_FILE[type]} target="_blank" rel="noreferrer">
          <i className="fa-solid fa-file-pdf" /> Download the blank template</a>
      )}
      {FORM_LINKS_TO_ASSET[type] && <div style={{ marginBottom: 14, maxWidth: 320 }}><label className="form-label">FPAM asset ID (if known)</label>
        <input className="form-control" value={linked} onChange={e => setLinked(e.target.value)} placeholder="e.g. AST-1001" /></div>}
      <FormRenderer formType={type} value={data} onChange={setData} />
      <h3 className="form-section-title" style={{ marginTop: 18 }}>Supporting documents{FORM_REQUIRES_ATTACHMENT[type] ? ' (required)' : ''}</h3>
      {existingFiles > 0 && <div className="cell-sub" style={{ marginBottom: 8 }}>{existingFiles} file(s) already attached.</div>}
      <label className="drop-zone"><i className="fa-solid fa-paperclip" /> <strong>Attach files</strong><span className="cell-sub">PDF, images, Word, Excel — up to 15 MB each</span>
        <input type="file" multiple hidden onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; setFiles(x => [...x, ...picked]); }} /></label>
      {files.length > 0 && <div className="file-chips">{files.map((f, i) => (
        <span className="file-chip" key={`${f.name}-${i}`}><i className="fa-solid fa-file" /> <span>{f.name}</span>
          <button type="button" onClick={() => setFiles(x => x.filter((_, k) => k !== i))} aria-label={`Remove ${f.name}`}><i className="fa-solid fa-xmark" /></button></span>
      ))}</div>}
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}

function ViewModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [req, setReq] = useState<FormRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => formsApi.getFormRequest(id).then(setReq).catch(err => { toast(errorMessage(err), 'error'); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  if (!req) return <Modal title="Loading…" onClose={onClose}><div className="loading"><i className="fa-solid fa-spinner fa-spin" /></div></Modal>;

  async function addFiles(list: File[]) {
    setBusy(true);
    let ok = 0;
    for (const f of list) { try { await formsApi.addAttachment(req!._id, f); ok++; } catch (err) { toast(`${f.name}: ${errorMessage(err)}`, 'error'); } }
    setBusy(false);
    if (ok) { toast(`${ok} file(s) added`); load(); onChanged(); }
  }
  const open = async (attId: string) => { try { window.open(await formsApi.openAttachment(req._id, attId), '_blank'); } catch (err) { toast(errorMessage(err), 'error'); } };

  return (
    <Modal wide title={FORM_LABELS[req.formType] || req.formType} onClose={onClose} footer={<>
      {req.certificateIssued && <button className="btn btn-primary" onClick={() => formsApi.downloadCertificate(req._id, `FPAM-Certificate-${req.mda}.pdf`).catch(err => toast(errorMessage(err), 'error'))}>
        <i className="fa-solid fa-certificate" /> Download certificate</button>}
      <button className="btn btn-ghost" onClick={onClose}>Close</button>
    </>}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Tag tone={STATUS_TONE[req.status]}>{label(req.status)}</Tag>
        <span className="cell-sub">Submitted {formatDate(req.createdAt)}{req.reviewedAt ? ` · reviewed ${formatDate(req.reviewedAt)}` : ''}</span>
      </div>
      {req.reviewRemarks && <div className={`alert ${req.status === 'Rejected' || req.status === 'Deferred' ? 'alert-warn' : 'alert-cert'}`}><i className="fa-solid fa-comment" /><span><strong>FPAM remarks:</strong> {req.reviewRemarks}</span></div>}
      {req.certificateIssued && <div className="alert alert-cert"><i className="fa-solid fa-certificate" /><span>Certificate <strong className="mono">{req.certificateNumber}</strong> issued {formatDate(req.certificateIssuedAt)}{req.physicalCopyIssued ? ' · physical copy issued' : ''}</span></div>}
      <FormRenderer formType={req.formType} value={(req[FORM_DATA_FIELD[req.formType]] || {}) as Record<string, unknown>} readOnly />
      <h3 className="form-section-title" style={{ marginTop: 18 }}>Supporting documents</h3>
      {req.attachments?.length ? <div className="list">{req.attachments.map(a => (
        <div className="list-row" key={a._id}><i className="fa-solid fa-paperclip" style={{ color: 'var(--accent)' }} />
          <div className="list-main">{a.label || a.originalname || a.filename}</div>
          <button className="btn btn-ghost btn-xs" onClick={() => open(a._id)}><i className="fa-solid fa-eye" /> View</button></div>
      ))}</div> : <div className="cell-sub">None attached.</div>}
      {req.status !== 'Approved' && (
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', marginTop: 10 }}>
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paperclip'}`} /> Add more documents
          <input type="file" multiple hidden disabled={busy} onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; addFiles(picked); }} />
        </label>
      )}
    </Modal>
  );
}
