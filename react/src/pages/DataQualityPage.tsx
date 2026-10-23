import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as dq from '../api/dataQuality';
import * as assetsApi from '../api/assets';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { Tag } from '../components/Tags';
import { formatDate } from '../lib/assets';

const MANAGERS = ['System Admin', 'Supervisor', 'Sub-Head', 'GIS Analyst'];
const FIXERS = ['System Admin', 'Supervisor'];
const ISSUE_ICON: Record<string, string> = {
  invalid_state: 'fa-map', unknown_mda: 'fa-building-columns', missing_gps: 'fa-location-crosshairs', no_photos: 'fa-camera',
  no_condition: 'fa-heart-pulse', overdue_inspection: 'fa-calendar-xmark', unassessed: 'fa-clipboard-question',
};

/**
 * Data-quality clean-up: what's wrong with the registry, bulk fixes for bad
 * spellings, and an assign → fix → verify workflow for the rest.
 */
export default function DataQualityPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const isManager = MANAGERS.includes(user?.role || '');
  const canFix = FIXERS.includes(user?.role || '');
  const mine = params.get('mine') === '1' || !isManager;
  const type = params.get('type') || '';
  const value = params.get('value') ?? undefined;
  const [summary, setSummary] = useState<dq.DqSummary | null>(null);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    if (!isManager) return;
    try { setSummary(await dq.summary()); } catch (err) { setError(errorMessage(err)); }
  }, [isManager]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const setView = (p: Record<string, string>) => setParams(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '')));

  return (
    <div className="page">
      <header className="page-header">
        <div><h1 className="page-title">Data quality</h1>
          <div className="page-sub">{mine ? 'Assets assigned to you to fix' : 'Find and fix problems in the registry: bad spellings, missing details, overdue inspections'}</div></div>
        {isManager && <div className="seg">
          <button className={`seg-btn${!mine ? ' active' : ''}`} onClick={() => setView({})}>Whole registry</button>
          <button className={`seg-btn${mine ? ' active' : ''}`} onClick={() => setView({ mine: '1' })}>Assigned to me</button>
        </div>}
      </header>
      {error && <div className="card form-section form-error" style={{ marginBottom: 14 }}><i className="fa-solid fa-circle-xmark" /> {error}</div>}

      {!mine && summary && <>
        <div className="dq-cards">
          {summary.issues.map(i => (
            <button key={i.type} className={`card dq-card${type === i.type ? ' active' : ''}${i.count ? '' : ' clean'}`} onClick={() => setView({ type: i.type })}>
              <i className={`fa-solid ${ISSUE_ICON[i.type] || 'fa-circle-exclamation'}`} />
              <div className="dq-count">{i.count.toLocaleString()}</div>
              <div className="dq-label">{i.label}</div>
              <div className="cell-sub">{summary.total ? Math.round((i.count / summary.total) * 100) : 0}% of {summary.total.toLocaleString()}</div>
            </button>
          ))}
        </div>
        <p className="cell-sub" style={{ margin: '-6px 0 14px' }}>{summary.workflow.assignedOpen} asset(s) assigned and waiting for a fix · {summary.workflow.verified} fix(es) verified</p>
        {canFix && (summary.badStates.length > 0 || summary.badMdas.length > 0) && (
          <SpellingFixes summary={summary} onDone={() => { loadSummary(); setView(type ? { type } : {}); }} />
        )}
      </>}

      {(type || mine) && <IssueList type={type} value={value} mine={mine} isManager={isManager}
        title={mine ? 'Assigned to me' : summary?.issues.find(i => i.type === type)?.label || 'Assets'}
        onChanged={() => { loadSummary(); toast('Saved'); }} />}
      {!type && !mine && <p className="cell-sub">Choose a problem above to see the assets affected.</p>}
    </div>
  );
}

function SpellingFixes({ summary, onDone }: { summary: dq.DqSummary; onDone: () => void }) {
  const toast = useToast();
  const [mdas, setMdas] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  useEffect(() => { assetsApi.getMdaNames().then(setMdas); }, []);

  async function apply(field: 'state' | 'mda', from: string) {
    const to = targets[`${field}:${from}`] ?? (field === 'state' ? summary.badStates.find(s => s.value === from)?.suggestion || '' : '');
    if (!to) { toast(`Choose the correct ${field === 'state' ? 'state' : 'MDA'} first`, 'error'); return; }
    const n = (field === 'state' ? summary.badStates : summary.badMdas).find(s => s.value === from)?.count || 0;
    if (!confirm(`Change ${field === 'state' ? 'state' : 'MDA'} "${from || '(blank)'}" to "${to}" on ${n} asset(s)?`)) return;
    setBusy(`${field}:${from}`);
    try {
      const r = await (field === 'state' ? dq.fixState(from, to) : dq.fixMda(from, to));
      toast(`${r.updated} asset(s) updated${r.skipped.length ? ` · ${r.skipped.length} skipped because the same asset already exists under "${to}" (${r.skipped.slice(0, 3).join(', ')}${r.skipped.length > 3 ? '…' : ''}) — review those by hand` : ''}`, r.skipped.length ? 'info' : 'success');
      onDone();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(''); }
  }

  const row = (field: 'state' | 'mda', value: string, count: number, options: string[], suggestion?: string | null) => {
    const k = `${field}:${value}`;
    return (
      <div key={k} className="list-row dq-fix">
        <div style={{ flex: 1, minWidth: 0 }}><strong>{value || <em>(blank)</em>}</strong> <span className="cell-sub">{count} asset{count === 1 ? '' : 's'}</span></div>
        <i className="fa-solid fa-arrow-right cell-sub" />
        <select className="filter-input" value={targets[k] ?? suggestion ?? ''} onChange={e => setTargets(t => ({ ...t, [k]: e.target.value }))} aria-label={`Correct ${field} for ${value}`}>
          <option value="">— Choose —</option>{options.map(o => <option key={o}>{o}</option>)}
        </select>
        <button className="btn btn-primary btn-xs" disabled={busy === k} onClick={() => apply(field, value)}>{busy === k ? <i className="fa-solid fa-spinner fa-spin" /> : 'Apply'}</button>
        <Link className="btn btn-ghost btn-xs" to={`?type=${field === 'state' ? 'invalid_state' : 'unknown_mda'}&value=${encodeURIComponent(value)}`}>View</Link>
      </div>
    );
  };

  return (
    <div className="card form-section" style={{ marginBottom: 14 }}>
      <div className="form-section-title">Fix spellings in bulk</div>
      <p className="cell-sub" style={{ marginBottom: 8 }}>Each change renames the value on every asset that uses it. Assets that would then duplicate an existing asset (same name, state and MDA) are skipped and listed so you can merge them by hand.</p>
      {summary.badStates.length > 0 && <><div className="dq-sub">States that aren't a recognised state</div>
        <div className="list">{summary.badStates.map(s => row('state', s.value, s.count, summary.states, s.suggestion))}</div></>}
      {summary.badMdas.length > 0 && <><div className="dq-sub" style={{ marginTop: 12 }}>MDAs not in the MDA list <span className="cell-sub">(missing ones can be added in Settings → MDAs)</span></div>
        <div className="list">{summary.badMdas.map(m => row('mda', m.value, m.count, mdas))}</div></>}
    </div>
  );
}

function IssueList({ type, value, mine, isManager, title, onChanged }: { type: string; value?: string; mine: boolean; isManager: boolean; title: string; onChanged: () => void }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ assets: dq.DqAsset[]; total: number; pages: number } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setData(null);
    try { setData(await dq.issues({ type: type || undefined, value, mine, page })); setSel(new Set()); }
    catch (err) { toast(errorMessage(err), 'error'); setData({ assets: [], total: 0, pages: 1 }); }
  }, [type, value, mine, page, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [type, value, mine]);

  const allIds = useMemo(() => (data?.assets || []).map(a => a.assetId), [data]);
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="card">
      <div className="form-section" style={{ paddingBottom: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="form-section-title" style={{ margin: 0 }}>{title}{value !== undefined ? `: "${value || '(blank)'}"` : ''} <span className="cell-sub">{data ? `${data.total.toLocaleString()} asset(s)` : ''}</span></div>
          {isManager && sel.size > 0 && <div className="row">
            <button className="btn btn-secondary btn-sm" onClick={() => setAssigning(true)}><i className="fa-solid fa-user-pen" /> Assign {sel.size}</button>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              try { const r = await dq.verify([...sel]); toast(`${r.verified} verified${r.skipped ? ` · ${r.skipped} skipped (you can't verify fixes assigned to you)` : ''}`); onChanged(); load(); }
              catch (err) { toast(errorMessage(err), 'error'); }
            }}><i className="fa-solid fa-check-double" /> Mark verified</button>
          </div>}
        </div>
      </div>
      <div className="table-wrap">
        {!data ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : data.assets.length === 0 ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-circle-check" /></div><div className="empty-title">{mine ? 'Nothing assigned to you' : 'No assets with this problem'}</div></div>
          : (
            <table className="data-table">
              <thead><tr>
                {isManager && <th style={{ width: 32 }}><input type="checkbox" aria-label="Select all" checked={sel.size > 0 && sel.size === allIds.length} onChange={e => setSel(e.target.checked ? new Set(allIds) : new Set())} /></th>}
                <th>Asset</th><th>State</th><th>MDA</th><th>Condition</th><th>Fix status</th><th />
              </tr></thead>
              <tbody>{data.assets.map(a => {
                const q = a.dataQuality;
                return (
                  <tr key={a.assetId}>
                    {isManager && <td><input type="checkbox" checked={sel.has(a.assetId)} onChange={() => toggle(a.assetId)} aria-label={`Select ${a.name}`} /></td>}
                    <td><strong>{a.name}</strong><div className="id-cell" style={{ maxWidth: 'none' }}>{a.assetId}{a.assetCode ? ` · ${a.assetCode}` : ''}</div></td>
                    <td>{a.state || <span className="cell-sub">—</span>}</td>
                    <td style={{ fontSize: 12 }}>{a.mda || <span className="cell-sub">—</span>}</td>
                    <td>{a.condition || <span className="cell-sub">—</span>}{a.nextInspection && <div className="cell-sub">next inspection {formatDate(a.nextInspection)}</div>}</td>
                    <td style={{ fontSize: 12 }}>
                      {q?.verifiedAt ? <Tag tone="green">Verified{q.verifiedBy?.name ? ` by ${q.verifiedBy.name}` : ''}</Tag>
                        : q?.assignedTo ? <><Tag tone="warn">With {q.assignedTo.name}</Tag>{q.note && <div className="cell-sub">{q.note}</div>}</>
                        : <span className="cell-sub">Not assigned</span>}
                    </td>
                    <td><Link className="btn btn-ghost btn-xs" to={`/assets/${encodeURIComponent(a.assetId)}`}>Open & fix</Link></td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
      </div>
      {data && data.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', padding: 12 }}>
          <button className="btn btn-ghost btn-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span className="cell-sub">Page {page} of {data.pages}</span>
          <button className="btn btn-ghost btn-xs" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
      {assigning && <AssignModal assetIds={[...sel]} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); onChanged(); load(); }} />}
    </div>
  );
}

function AssignModal({ assetIds, onClose, onDone }: { assetIds: string[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<{ _id: string; name: string; role: string }[]>([]);
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { dq.assignees().then(setUsers).catch(err => toast(errorMessage(err), 'error')); }, [toast]);
  return (
    <Modal title={`Assign ${assetIds.length} asset(s) to fix`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={busy || !userId} onClick={async () => {
        setBusy(true);
        try { const r = await dq.assign(assetIds, userId, note); toast(`${r.assigned} asset(s) assigned — they've been notified`); onDone(); }
        catch (err) { toast(errorMessage(err), 'error'); setBusy(false); }
      }}>Assign</button>
    </>}>
      <label className="form-label" htmlFor="dq-user">Who should fix them?</label>
      <select id="dq-user" className="form-control" value={userId} onChange={e => setUserId(e.target.value)}>
        <option value="">— Choose a person —</option>{users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
      </select>
      <label className="form-label" htmlFor="dq-note" style={{ marginTop: 12 }}>Note (what to fix)</label>
      <input id="dq-note" className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Capture GPS on your next site visit" maxLength={500} />
      <p className="cell-sub" style={{ marginTop: 8 }}>They get a notification (and an email when email is set up). Once fixed, someone else marks the assets verified.</p>
    </Modal>
  );
}
