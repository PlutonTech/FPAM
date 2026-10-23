import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as assetsApi from '../../api/assets';
import * as x from '../../api/extras';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import AuthedImage from '../../components/AuthedImage';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Tag } from '../../components/Tags';
import type { Asset } from '../../types';
import { canFileMe, canViewMe } from '../../auth/permissions';
import { assetKey, formatDate, formatNaira } from '../../lib/assets';
import { ME_TONE } from '../asset-view/extraTabs';
import { printClearanceCertificate } from './certificate';

type Report = x.MeReport;
const typeLabel = (t: string) => (t === 'nhp' ? 'NHP' : t === 'others' ? 'Other' : 'Secretariat');


export default function MePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const assetParam = params.get('asset') || '';
  const [asset, setAsset] = useState<Asset | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState('');
  const [f, setF] = useState({ status: '', type: '' });
  const [editing, setEditing] = useState<Report | 'new' | null>(null);
  const [viewing, setViewing] = useState<Report | null>(null);
  const [clearing, setClearing] = useState<Report | null>(null);
  const canFile = canFileMe(user);

  // Selected asset comes from ?asset= so links from Asset View land here pre-filtered.
  useEffect(() => {
    if (!assetParam) { setAsset(null); return; }
    assetsApi.getAsset(assetParam).then(setAsset).catch(() => { toast(`Asset ${assetParam} not found`, 'error'); setParams({}); });
  }, [assetParam, toast, setParams]);

  const load = useCallback(async () => {
    setError(''); setReports(null);
    try {
      if (assetParam) {
        const list = await x.getAssetMeReports(assetParam);
        setReports(list.map(r => ({ ...r, _assetId: assetParam })));
      } else setReports((await x.getAllMeReports()).reports || []);
    } catch (err) { setError(errorMessage(err)); setReports([]); }
  }, [assetParam]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (reports || [])
    .filter(r => (!f.status || r.status === f.status) && (!f.type || r.reportType === f.type))
    .sort((a, b) => (b.reportYear - a.reportYear) || (b.reportMonth - a.reportMonth)), [reports, f]);
  const stats = useMemo(() => {
    const l = reports || [];
    return { total: l.length, draft: l.filter(r => r.status === 'Draft').length, submitted: l.filter(r => r.status === 'Submitted').length,
      cleared: l.filter(r => r.status === 'Cleared').length, notCleared: l.filter(r => r.status === 'Not Cleared').length };
  }, [reports]);

  async function remove(r: Report) {
    if (!confirm('Delete this draft report?')) return;
    try { await x.deleteMeReport(r._assetId || assetParam, r._id); toast('Draft deleted'); load(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }

  if (!canViewMe(user)) {
    return <div className="page"><div className="card empty-state"><div className="empty-icon"><i className="fa-solid fa-lock" /></div>
      <div className="empty-title">Monitoring & Evaluation only</div><div className="empty-sub">This page is for the M&E division, Supervisors and System Admins.</div></div></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">M&E reports</h1>
          <div className="page-sub">Monthly facility-management progress reports and clearance certificates</div>
        </div>
        {asset && canFile && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> New report for {asset.name}</button>}
      </header>

      <div className="card form-section" style={{ marginBottom: 14 }}>
        {asset ? (
          <div className="picked-asset">
            <div><strong>{asset.name}</strong><div className="id-cell" style={{ maxWidth: 'none' }}>{assetKey(asset)} · {asset.state || '—'}</div></div>
            <div className="row">
              <Link className="btn btn-ghost btn-xs" to={`/assets/${encodeURIComponent(assetKey(asset))}`}>Open asset</Link>
              <button className="btn btn-ghost btn-xs" onClick={() => setParams({})}>Show all assets</button>
            </div>
          </div>
        ) : (
          <AssetSearch onPick={a => setParams({ asset: assetKey(a) })} hint={canFile ? 'Choose an asset to file a new report, or browse all reports below.' : 'Choose an asset to see its reports.'} />
        )}
      </div>

      <div className="kpi-row">
        {([['Reports', stats.total, 'blue'], ['Drafts', stats.draft, 'navy'], ['Submitted', stats.submitted, 'orange'], ['Cleared', stats.cleared, 'green'], ['Not cleared', stats.notCleared, 'red']] as const).map(([l, v, t]) => (
          <div key={l} className={`card kpi kpi-${t}`}><div className="kpi-label">{l}</div><div className="kpi-value">{v}</div></div>
        ))}
      </div>

      <div className="filter-bar">
        <select className="filter-input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>{x.ME_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter-input" value={f.type} onChange={e => setF({ ...f, type: e.target.value })} aria-label="Type">
          <option value="">All types</option>{x.ME_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>

      <div className="card table-wrap">
        {reports === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : error ? <div className="empty-state"><div className="empty-title">Could not load reports</div><div className="empty-sub">{error}</div></div>
          : shown.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-clipboard-list" /></div><div className="empty-title">No reports</div>
              <div className="empty-sub">{asset ? (canFile ? 'File the first report for this asset.' : 'No reports filed yet.') : 'No M&E reports match.'}</div></div>
          : (
            <table className="data-table">
              <thead><tr><th>Period</th>{!asset && <th>Asset</th>}<th>Type</th><th>Contractor</th><th>Progress</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r._id}>
                    <td><strong>{x.MONTHS[(r.reportMonth || 1) - 1]} {r.reportYear}</strong></td>
                    {!asset && <td><Link to={`/me?asset=${encodeURIComponent(r._assetId || '')}`} style={{ color: 'inherit' }}>{r._assetName}</Link><div className="id-cell">{r._assetId}</div></td>}
                    <td style={{ fontSize: 12 }}>{typeLabel(r.reportType)}</td>
                    <td style={{ fontSize: 12 }}>{r.contractorName || '—'}{r.contractNo && <div className="cell-sub">{r.contractNo}</div>}</td>
                    <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="me-progress"><div style={{ width: `${r.overallPercentage || 0}%` }} /></div><span style={{ fontSize: 12, fontWeight: 700 }}>{r.overallPercentage || 0}%</span></div></td>
                    <td><Tag tone={ME_TONE[r.status] || 'gray'}>{r.status}</Tag></td>
                    <td><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setViewing(r)}>Open</button>
                      {canFile && r.status === 'Draft' && <button className="btn btn-danger btn-xs" onClick={() => remove(r)} aria-label="Delete draft"><i className="fa-solid fa-trash" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {editing && (asset || (editing !== 'new' && editing._assetId)) && (
        <ReportModal assetId={asset ? assetKey(asset) : (editing as Report)._assetId!} existing={editing === 'new' ? undefined : editing}
                     onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />
      )}
      {viewing && (
        <ViewModal report={viewing} assetId={viewing._assetId || assetParam} assetName={asset?.name || viewing._assetName || ''} canFile={canFile}
                   onClose={() => setViewing(null)}
                   onEdit={() => { setEditing({ ...viewing, _assetId: viewing._assetId || assetParam }); setViewing(null); }}
                   onClear={() => { setClearing({ ...viewing, _assetId: viewing._assetId || assetParam }); setViewing(null); }} />
      )}
      {clearing && <ClearanceModal report={clearing} assetName={asset?.name || clearing._assetName || ''} onClose={() => setClearing(null)} onDone={() => { setClearing(null); load(); }} />}
    </div>
  );
}

function AssetSearch({ onPick, hint }: { onPick: (a: Asset) => void; hint: string }) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? (assets || []).filter(a => [a.name, a.assetId, a.assetCode, a.state].some(v => (v || '').toLowerCase().includes(t))).slice(0, 8) : [];
  }, [assets, q]);
  return (
    <>
      <label className="form-label" htmlFor="me-asset">Asset</label>
      <input id="me-asset" className="form-control" placeholder="Search assets by name, ID or state…" value={q}
             onFocus={() => { if (!assets) assetsApi.fetchAllAssets().then(setAssets).catch(() => setAssets([])); }}
             onChange={e => setQ(e.target.value)} />
      {matches.length > 0 && <div className="picker-list">{matches.map(a => (
        <button key={assetKey(a)} className="picker-item" onClick={() => onPick(a)}><strong>{a.name}</strong><span className="cell-sub">{assetKey(a)} · {a.state || '—'}</span></button>
      ))}</div>}
      <div className="cell-sub" style={{ marginTop: 6 }}>{hint}</div>
    </>
  );
}

// ── Create / edit ────────────────────────────────────────────────────────────
function ReportModal({ assetId, existing, onClose, onDone }: { assetId: string; existing?: Report; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const now = new Date();
  const [templates, setTemplates] = useState<{ secretariat: string[]; nhp: string[] } | null>(null);
  const [r, setR] = useState<Partial<Report>>(() => existing ? { ...existing } : {
    reportType: 'secretariat', reportMonth: now.getMonth() + 1, reportYear: now.getFullYear(), tasks: [], overallPercentage: 0,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { x.getMeTemplates().then(setTemplates).catch(() => setTemplates({ secretariat: [], nhp: [] })); }, []);

  // Switching type (or first load of a new report) resets the task list to that template.
  const applyTemplate = useCallback((type: string, keep?: { label: string; percentage: number }[]) => {
    if (type === 'others') { setR(v => ({ ...v, reportType: type, tasks: keep?.length ? keep : [{ label: '', percentage: 0 }] })); return; }
    const labels = (templates?.[type as 'secretariat' | 'nhp']) || [];
    const old = new Map((keep || []).map(t => [t.label, t.percentage]));
    setR(v => ({ ...v, reportType: type, tasks: labels.map(label => ({ label, percentage: old.get(label) ?? 0 })) }));
  }, [templates]);
  useEffect(() => { if (templates && !existing) applyTemplate('secretariat'); }, [templates, existing, applyTemplate]);

  const set = (k: keyof Report) => (e: { target: { value: string } }) => setR(v => ({ ...v, [k]: e.target.value }));
  const tasks = r.tasks || [];
  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + (Number(t.percentage) || 0), 0) / tasks.length) : 0;
  const setTask = (i: number, patch: Partial<{ label: string; percentage: number }>) =>
    setR(v => ({ ...v, tasks: (v.tasks || []).map((t, k) => (k === i ? { ...t, ...patch } : t)) }));

  async function save(status: 'Draft' | 'Submitted') {
    if (!r.reportMonth || !r.reportYear) { setError('Month and year are required'); return; }
    if (r.reportType === 'others' && tasks.some(t => !t.label.trim())) { setError('Give every custom task a name'); return; }
    setBusy(true); setError('');
    const body: Partial<Report> = {
      ...r, status, reportMonth: Number(r.reportMonth), reportYear: Number(r.reportYear),
      contractSum: r.contractSum ? Number(r.contractSum) : undefined,
      tasks: tasks.map(t => ({ label: t.label.trim(), percentage: Math.min(100, Math.max(0, Number(t.percentage) || 0)) })),
      overallPercentage: Math.min(100, Math.max(0, Number(r.overallPercentage) || 0)),
    };
    for (const k of ['_id', '_assetId', '_assetName', '_assetType', '_assetState', 'clearanceIssued', 'createdAt', 'submittedAt'] as const) delete (body as Record<string, unknown>)[k];
    try {
      const saved = existing ? await x.updateMeReport(assetId, existing._id, body) : await x.createMeReport(assetId, body);
      let failed = 0;
      for (const p of photos) { try { await x.uploadMePhoto(assetId, p, saved._id); } catch { failed++; } }
      toast(`${status === 'Draft' ? 'Draft saved' : 'Report submitted'}${photos.length ? ` · ${photos.length - failed} photo(s) attached` : ''}`);
      if (failed) toast(`${failed} photo(s) failed to upload`, 'error');
      onDone();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Modal wide title={existing ? `Edit ${x.MONTHS[(r.reportMonth || 1) - 1]} ${r.reportYear} report` : 'New monthly progress report'} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => save('Draft')}>Save draft</button>
      <button className="btn btn-primary" disabled={busy} onClick={() => save('Submitted')}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> Submit</button>
    </>}>
      <h3 className="form-section-title">Report period</h3>
      <div className="form-grid">
        <div><label className="form-label">Type</label>
          <select className="form-control" value={r.reportType} onChange={e => applyTemplate(e.target.value, tasks)}>
            {x.ME_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div style={{ flex: 1 }}><label className="form-label">Month</label>
            <select className="form-control" value={r.reportMonth} onChange={set('reportMonth')}>{x.MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
          <div style={{ width: 110 }}><label className="form-label">Year</label>
            <input className="form-control" type="number" value={r.reportYear ?? ''} onChange={set('reportYear')} /></div>
        </div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Contract</h3>
      <div className="form-grid">
        <div><label className="form-label">Contract no.</label><input className="form-control" value={r.contractNo || ''} onChange={set('contractNo')} /></div>
        <div><label className="form-label">Contract sum (₦)</label><input className="form-control" inputMode="decimal" value={r.contractSum ?? ''} onChange={set('contractSum')} /></div>
        <div><label className="form-label">Contractor</label><input className="form-control" value={r.contractorName || ''} onChange={set('contractorName')} /></div>
        <div><label className="form-label">Contractor address</label><input className="form-control" value={r.contractorAddress || ''} onChange={set('contractorAddress')} /></div>
        <div><label className="form-label">Contract period</label><input className="form-control" value={r.contractPeriod || ''} onChange={set('contractPeriod')} placeholder="e.g. 12 months" /></div>
        <div><label className="form-label">Commencement date</label><input className="form-control" type="date" value={(r.commencementDate || '').slice(0, 10)} onChange={set('commencementDate')} /></div>
        <div className="full"><label className="form-label">Completion period / remarks</label><input className="form-control" value={r.completionPeriod || ''} onChange={set('completionPeriod')} /></div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Task progress</h3>
      <div className="me-tasks">
        {tasks.map((t, i) => (
          <div className="me-task" key={i}>
            {r.reportType === 'others'
              ? <input className="form-control" value={t.label} onChange={e => setTask(i, { label: e.target.value })} placeholder={`Task ${i + 1}`} />
              : <span className="me-task-label">{t.label}</span>}
            <input type="range" min={0} max={100} step={5} value={t.percentage} onChange={e => setTask(i, { percentage: Number(e.target.value) })} aria-label={`${t.label || 'Task'} percentage`} />
            <span className="me-task-pct">{t.percentage}%</span>
            {r.reportType === 'others' && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setR(v => ({ ...v, tasks: tasks.filter((_, k) => k !== i) }))} aria-label="Remove task"><i className="fa-solid fa-xmark" /></button>}
          </div>
        ))}
        {r.reportType === 'others' && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setR(v => ({ ...v, tasks: [...tasks, { label: '', percentage: 0 }] }))}><i className="fa-solid fa-plus" /> Add task</button>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <label className="form-label" style={{ margin: 0 }}>Overall completion</label>
        <input className="form-control" style={{ width: 90 }} type="number" min={0} max={100} value={r.overallPercentage ?? 0} onChange={set('overallPercentage')} />
        <span className="cell-sub">%</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setR(v => ({ ...v, overallPercentage: avg }))}>Use task average ({avg}%)</button>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Ratings</h3>
      <div className="form-grid">
        {([['labourRating', 'Labour'], ['materialsRating', 'Materials'], ['progressRating', 'Progress'], ['workmanshipRating', 'Workmanship']] as const).map(([k, l]) => (
          <div key={k}><span className="form-label">{l}</span>
            <div className="seg" role="radiogroup" aria-label={l}>
              {x.ME_RATINGS.map(v => <button key={v} type="button" role="radio" aria-checked={r[k] === v} className={`seg-btn${r[k] === v ? ' active' : ''}`}
                                             onClick={() => setR(s => ({ ...s, [k]: s[k] === v ? undefined : v }))}>{v}</button>)}
            </div></div>
        ))}
        <div className="full"><label className="form-label">Other comments</label><textarea className="form-control" value={r.otherComments || ''} onChange={set('otherComments')} /></div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Chief Resident Architect sign-off</h3>
      <div className="form-grid">
        <div><label className="form-label">Name</label><input className="form-control" value={r.craName || ''} onChange={set('craName')} /></div>
        <div><label className="form-label">Designation</label><input className="form-control" value={r.craDesignation || ''} onChange={set('craDesignation')} /></div>
        <div><label className="form-label">Date</label><input className="form-control" type="date" value={(r.craDate || '').slice(0, 10)} onChange={set('craDate')} /></div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Site photos</h3>
      <label className="drop-zone"><i className="fa-solid fa-camera" /> <strong>Attach photos</strong><span className="cell-sub">Saved to the asset and linked to this report</span>
        <input type="file" accept="image/*" multiple hidden onChange={e => { const picked = Array.from(e.target.files || []); e.target.value = ''; setPhotos(p => [...p, ...picked]); }} /></label>
      {photos.length > 0 && <div className="file-chips">{photos.map((p, i) => (
        <span className="file-chip" key={`${p.name}-${i}`}><i className="fa-solid fa-image" /> <span>{p.name}</span>
          <button type="button" onClick={() => setPhotos(ps => ps.filter((_, k) => k !== i))} aria-label={`Remove ${p.name}`}><i className="fa-solid fa-xmark" /></button></span>
      ))}</div>}
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}

// ── View ─────────────────────────────────────────────────────────────────────
function ViewModal({ report: r, assetId, assetName, canFile, onClose, onEdit, onClear }: {
  report: Report; assetId: string; assetName: string; canFile: boolean; onClose: () => void; onEdit: () => void; onClear: () => void;
}) {
  const [photos, setPhotos] = useState<string[] | null>(null);
  useEffect(() => {
    assetsApi.getAsset(assetId).then(a => setPhotos((a.photos || []).filter(p => String(p.meReportId || '') === r._id).map(p => p._id))).catch(() => setPhotos([]));
  }, [assetId, r._id]);
  const period = `${x.MONTHS[(r.reportMonth || 1) - 1]} ${r.reportYear}`;
  const rated = ([['Labour', r.labourRating], ['Materials', r.materialsRating], ['Progress', r.progressRating], ['Workmanship', r.workmanshipRating]] as const).filter(([, v]) => v);

  return (
    <Modal wide title={`${assetName} — ${period}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Close</button>
      {r.clearanceIssued && <button className="btn btn-secondary" onClick={() => printClearanceCertificate(r, assetName, assetId)}><i className="fa-solid fa-print" /> Print certificate</button>}
      {canFile && !r.clearanceIssued && <button className="btn btn-ghost" onClick={onEdit}><i className="fa-solid fa-pen" /> Edit</button>}
      {canFile && r.status === 'Submitted' && <button className="btn btn-primary" onClick={onClear}><i className="fa-solid fa-certificate" /> Issue clearance</button>}
    </>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Tag tone={ME_TONE[r.status] || 'gray'}>{r.status}</Tag><span className="cell-sub">{typeLabel(r.reportType)} report{r.submittedAt ? ` · submitted ${formatDate(r.submittedAt)}` : ''}</span>
      </div>
      <div className="meta-grid" style={{ marginBottom: 16 }}>
        <div><div className="meta-key">Contractor</div><div className="meta-val">{r.contractorName || '—'}</div></div>
        <div><div className="meta-key">Contract no.</div><div className="meta-val">{r.contractNo || '—'}</div></div>
        <div><div className="meta-key">Contract sum</div><div className="meta-val">{r.contractSum ? formatNaira(r.contractSum) : '—'}</div></div>
        <div><div className="meta-key">Contract period</div><div className="meta-val">{r.contractPeriod || '—'}</div></div>
      </div>
      <div className="meta-key" style={{ marginBottom: 6 }}>Tasks · overall {r.overallPercentage || 0}%</div>
      <div className="me-tasks" style={{ marginBottom: 16 }}>
        {(r.tasks || []).map((t, i) => (
          <div className="me-task" key={i}><span className="me-task-label">{t.label}</span>
            <div className="me-progress" style={{ flex: 1, width: 'auto' }}><div style={{ width: `${t.percentage}%` }} /></div><span className="me-task-pct">{t.percentage}%</span></div>
        ))}
      </div>
      {rated.length > 0 && <div className="row" style={{ marginBottom: 12 }}>{rated.map(([l, v]) => <span key={l} className="tag tag-blue">{l}: {v}</span>)}</div>}
      {r.otherComments && <p style={{ fontSize: 13, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{r.otherComments}</p>}
      {r.craName && <div className="cell-sub" style={{ marginBottom: 12 }}>Signed off by {r.craName}{r.craDesignation ? `, ${r.craDesignation}` : ''}{r.craDate ? ` on ${formatDate(r.craDate)}` : ''}</div>}
      {r.clearanceIssued && (
        <div className={`alert ${r.satisfactory !== false ? 'alert-cert' : 'alert-warn'}`}>
          <i className="fa-solid fa-certificate" />
          <span>Clearance {r.satisfactory !== false ? 'issued — works satisfactory' : 'recorded — works unsatisfactory'} on {formatDate(r.clearanceDate)}{r.facilityManagerName ? ` by ${r.facilityManagerName}` : ''}.{r.unsatisfactoryWorks ? ` Outstanding: ${r.unsatisfactoryWorks}` : ''}</span>
        </div>
      )}
      <div className="meta-key" style={{ margin: '8px 0 6px' }}>Site photos for this report</div>
      {photos === null ? <div className="cell-sub">Loading…</div> : photos.length === 0 ? <div className="cell-sub">None attached.</div> : (
        <div className="photo-grid">{photos.map(id => <div className="photo-card" key={id}><AuthedImage path={assetsApi.photoPath(assetId, id)} alt="Report photo" /></div>)}</div>
      )}
    </Modal>
  );
}

// ── Clearance ────────────────────────────────────────────────────────────────
function ClearanceModal({ report, assetName, onClose, onDone }: { report: Report; assetName: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [sat, setSat] = useState(true);
  const [c, setC] = useState({ unsatisfactoryWorks: '', facilityManagerName: '', facilityManagerDesig: '', facilityManagerDate: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  async function issue() {
    if (!sat && !c.unsatisfactoryWorks.trim()) { toast('Describe the unsatisfactory works', 'error'); return; }
    setBusy(true);
    try {
      await x.updateMeReport(report._assetId!, report._id, {
        clearanceIssued: true, satisfactory: sat, clearanceDate: c.facilityManagerDate, clearanceMonth: x.MONTHS[(report.reportMonth || 1) - 1],
        unsatisfactoryWorks: sat ? undefined : c.unsatisfactoryWorks.trim(), facilityManagerName: c.facilityManagerName.trim(),
        facilityManagerDesig: c.facilityManagerDesig.trim(), facilityManagerDate: c.facilityManagerDate, status: sat ? 'Cleared' : 'Not Cleared',
      });
      toast(sat ? 'Clearance certificate issued' : 'Marked not cleared');
      onDone();
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={`Clearance — ${assetName}, ${x.MONTHS[(report.reportMonth || 1) - 1]} ${report.reportYear}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={busy} onClick={issue}><i className="fa-solid fa-certificate" /> {sat ? 'Issue clearance' : 'Record as not cleared'}</button>
    </>}>
      <span className="form-label">Were the works carried out satisfactorily?</span>
      <div className="seg" role="radiogroup" aria-label="Satisfactory" style={{ marginBottom: 12 }}>
        <button type="button" role="radio" aria-checked={sat} className={`seg-btn${sat ? ' active' : ''}`} onClick={() => setSat(true)}>Yes — satisfactory</button>
        <button type="button" role="radio" aria-checked={!sat} className={`seg-btn${!sat ? ' active' : ''}`} onClick={() => setSat(false)}>No — unsatisfactory</button>
      </div>
      {!sat && <><label className="form-label">Unsatisfactory works / works not done</label>
        <textarea className="form-control" value={c.unsatisfactoryWorks} onChange={e => setC({ ...c, unsatisfactoryWorks: e.target.value })} /></>}
      <div className="form-grid" style={{ marginTop: 12 }}>
        <div><label className="form-label">Facility manager</label><input className="form-control" value={c.facilityManagerName} onChange={e => setC({ ...c, facilityManagerName: e.target.value })} /></div>
        <div><label className="form-label">Designation</label><input className="form-control" value={c.facilityManagerDesig} onChange={e => setC({ ...c, facilityManagerDesig: e.target.value })} /></div>
        <div><label className="form-label">Date</label><input className="form-control" type="date" value={c.facilityManagerDate} onChange={e => setC({ ...c, facilityManagerDate: e.target.value })} /></div>
      </div>
      <p className="cell-sub" style={{ marginTop: 10 }}>Issuing also records the clearance in the asset's maintenance log.</p>
    </Modal>
  );
}
