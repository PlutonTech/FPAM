import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as btmApi from '../../api/btm';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { useToast } from '../../components/Toast';
import { assetKey, formatDate, formatNaira, type Tone } from '../../lib/assets';
import type { Asset } from '../../types';
import type { BtmSummary, MaintenancePlan, TrainingSession, WorkOrder } from '../../api/btm';

// Building Training & Maintenance division: planned maintenance, work orders
// and training sessions. Everyone on staff can view; changes need the
// division (or System Admin / cross-division) — the backend enforces it.

const TABS = [['overview', 'Overview', 'fa-gauge'], ['work-orders', 'Work orders', 'fa-screwdriver-wrench'], ['plans', 'Planned maintenance', 'fa-calendar-check'], ['training', 'Training', 'fa-chalkboard-user']] as const;
type TabKey = typeof TABS[number][0];
const WO_TONE: Record<string, Tone> = { Open: 'orange', 'In progress': 'blue', Completed: 'green', Cancelled: 'gray' };
const PRI_TONE: Record<string, Tone> = { Urgent: 'red', High: 'red', Medium: 'orange', Low: 'gray' };
const today = () => new Date().toISOString().slice(0, 10);
const isPast = (d?: string | null) => !!d && new Date(d).getTime() < Date.now();
const dayInput = (d?: string | null) => (d ? d.slice(0, 10) : '');

export default function BtmPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(t => t[0] === params.get('tab'))?.[0] || 'overview') as TabKey;
  const [summary, setSummary] = useState<BtmSummary | null>(null);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => { btmApi.summary().then(setSummary).catch(err => setError(errorMessage(err))); }, [version]);
  useEffect(() => { assetsApi.fetchAllAssets().then(setAssets).catch(() => {}); }, []);

  return (
    <div className="page">
      <header className="page-header">
        <div><h1 className="page-title">Building Training &amp; Maintenance</h1>
          <div className="page-sub">Planned maintenance, work orders and training across federal buildings</div></div>
      </header>
      {error && <div className="form-error">{error}</div>}
      {summary && !summary.canManage && <div className="alert alert-info" style={{ marginBottom: 12 }}><i className="fa-solid fa-eye" /> View only. Changes are made by the Building Training &amp; Maintenance division.</div>}
      <div className="tab-bar card" role="tablist" style={{ marginBottom: 12 }}>
        {TABS.map(([k, l, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setParams(k === 'overview' ? {} : { tab: k })}>
            <i className={`fa-solid ${icon}`} /> {l}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview summary={summary} version={version} go={k => setParams({ tab: k })} />}
      {tab === 'work-orders' && summary && <WorkOrders summary={summary} assets={assets} version={version} onChange={refresh} />}
      {tab === 'plans' && summary && <Plans summary={summary} assets={assets} version={version} onChange={refresh} />}
      {tab === 'training' && summary && <Training summary={summary} assets={assets} version={version} onChange={refresh} />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview({ summary, version, go }: { summary: BtmSummary | null; version: number; go: (k: TabKey) => void }) {
  const [due, setDue] = useState<MaintenancePlan[]>([]);
  const [active, setActive] = useState<WorkOrder[]>([]);
  useEffect(() => {
    btmApi.listPlans().then(p => setDue(p.filter(x => new Date(x.nextDue).getTime() < Date.now() + 14 * 86400000).slice(0, 8))).catch(() => {});
    btmApi.listWorkOrders('active').then(w => setActive(w.slice(0, 8))).catch(() => {});
  }, [version]);
  if (!summary) return <div className="card loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>;
  const k = summary;
  return (
    <>
      <div className="kpi-row">
        {([['Open work orders', k.workOrders.open, 'orange'], ['In progress', k.workOrders.inProgress, 'blue'], ['Overdue work orders', k.workOrders.overdue, 'red'],
           ['Planned tasks overdue', k.plans.overdue, 'red'], ['Due in 7 days', k.plans.dueThisWeek, 'navy'], ['Trained this year', k.training.attendeesThisYear, 'green']] as const).map(([l, v, t]) => (
          <div key={l} className={`card kpi kpi-${t}`}><div className="kpi-label">{l}</div><div className="kpi-value">{v}</div></div>
        ))}
      </div>
      <div className="btm-two">
        <div className="card">
          <div className="card-header"><div className="card-title"><i className="fa-solid fa-calendar-check" /> Planned tasks due in the next 14 days</div>
            <button className="btn btn-ghost btn-xs" onClick={() => go('plans')}>All plans</button></div>
          {due.length === 0 ? <div className="cell-sub" style={{ padding: 14 }}>Nothing due.</div> : (
            <table className="data-table"><tbody>{due.map(p => (
              <tr key={p._id}><td><strong>{p.task}</strong><div className="cell-sub">{p.assetName}</div></td>
                <td style={{ color: isPast(p.nextDue) ? 'var(--danger)' : undefined }}>{formatDate(p.nextDue)}</td></tr>
            ))}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title"><i className="fa-solid fa-screwdriver-wrench" /> Active work orders</div>
            <button className="btn btn-ghost btn-xs" onClick={() => go('work-orders')}>All work orders</button></div>
          {active.length === 0 ? <div className="cell-sub" style={{ padding: 14 }}>No open work orders.</div> : (
            <table className="data-table"><tbody>{active.map(w => (
              <tr key={w._id}><td><strong>{w.title}</strong><div className="cell-sub">{w.ref} · {w.assetName}</div></td>
                <td><Tag tone={PRI_TONE[w.priority]}>{w.priority}</Tag></td><td><Tag tone={WO_TONE[w.status]}>{w.status}</Tag></td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
    </>
  );
}

// ── Asset picker (type to search the register) ───────────────────────────────
function AssetPicker({ assets, value, onChange, optional }: { assets: Asset[]; value: string; onChange: (id: string) => void; optional?: boolean }) {
  const label = (a: Asset) => `${a.name} — ${assetKey(a)}`;
  const current = assets.find(a => assetKey(a) === value);
  const [text, setText] = useState(current ? label(current) : value);
  useEffect(() => { if (current) setText(label(current)); }, [current]);
  return (
    <>
      <input className="form-control" list="btm-assets" value={text} placeholder={optional ? 'Optional: building on the register' : 'Type a name or asset ID'}
        onChange={e => {
          setText(e.target.value);
          const hit = assets.find(a => label(a) === e.target.value || assetKey(a) === e.target.value.trim());
          onChange(hit ? assetKey(hit) : '');
        }} />
      <datalist id="btm-assets">{assets.slice(0, 3000).map(a => <option key={assetKey(a)} value={label(a)} />)}</datalist>
    </>
  );
}

// ── Work orders ──────────────────────────────────────────────────────────────
function WorkOrders({ summary, assets, version, onChange }: { summary: BtmSummary; assets: Asset[]; version: number; onChange: () => void }) {
  const [list, setList] = useState<WorkOrder[] | null>(null);
  const [filter, setFilter] = useState('active');
  const [editing, setEditing] = useState<WorkOrder | 'new' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { btmApi.listWorkOrders(filter).then(setList).catch(err => setError(errorMessage(err))); }, [filter, version]);
  return (
    <>
      <div className="filter-bar">
        <select className="filter-input" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Status" style={{ maxWidth: 220 }}>
          <option value="active">Open and in progress</option><option value="">All</option>
          {summary.options.statuses.map(s => <option key={s}>{s}</option>)}
        </select>
        {summary.canManage && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> New work order</button>}
      </div>
      <div className="card table-wrap">
        {list === null ? <div className="loading">{error || <><i className="fa-solid fa-spinner fa-spin" /> Loading…</>}</div>
          : list.length === 0 ? <div className="empty-state"><div className="empty-title">No work orders</div></div> : (
          <table className="data-table">
            <thead><tr><th>Work order</th><th>Asset</th><th>Priority</th><th>Assigned to</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>{list.map(w => (
              <tr key={w._id} className="row-link" onClick={() => setEditing(w)}>
                <td><strong>{w.title}</strong><div className="cell-sub mono">{w.ref}{w.source.type !== 'manual' && <> · from {w.source.type === 'plan' ? 'planned task' : 'public report'}</>}</div></td>
                <td><Link to={`/assets/${encodeURIComponent(w.assetId)}`} onClick={e => e.stopPropagation()}>{w.assetName}</Link></td>
                <td><Tag tone={PRI_TONE[w.priority]}>{w.priority}</Tag></td>
                <td>{w.assignedTo || <span className="cell-sub">—</span>}</td>
                <td style={{ color: w.status !== 'Completed' && isPast(w.dueDate) ? 'var(--danger)' : undefined }}>{w.dueDate ? formatDate(w.dueDate) : '—'}</td>
                <td><Tag tone={WO_TONE[w.status]}>{w.status}</Tag></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {editing && <WorkOrderModal wo={editing === 'new' ? null : editing} summary={summary} assets={assets}
                                  onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />}
    </>
  );
}

function WorkOrderModal({ wo, summary, assets, onClose, onSaved }: { wo: WorkOrder | null; summary: BtmSummary; assets: Asset[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const closed = wo?.status === 'Completed' || wo?.status === 'Cancelled';
  const readOnly = !summary.canManage || closed;
  const [f, setF] = useState({
    assetId: wo?.assetId || '', title: wo?.title || '', description: wo?.description || '', category: wo?.category || 'Other',
    priority: wo?.priority || 'Medium', assignedTo: wo?.assignedTo || '', dueDate: dayInput(wo?.dueDate), cost: wo?.cost ?? '',
  });
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); onSaved(); } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  const save = () => {
    if (!f.assetId) { toast('Choose an asset from the register', 'error'); return; }
    if (!f.title.trim()) { toast('Give the work order a title', 'error'); return; }
    return run(() => (wo ? btmApi.updateWorkOrder(wo._id, f) : btmApi.createWorkOrder(f)), wo ? 'Work order saved' : 'Work order raised');
  };
  const setStatus = (status: string) => {
    if (status === 'Completed' && !note.trim()) { toast('Say what was done', 'error'); return; }
    return run(() => btmApi.updateWorkOrder(wo!._id, { ...f, status, completionNote: note }), status === 'Completed' ? 'Completed and logged on the asset' : `Marked ${status.toLowerCase()}`);
  };

  return (
    <Modal wide title={wo ? <>Work order <span className="mono">{wo.ref}</span></> : 'New work order'} onClose={onClose}
      footer={readOnly ? <button className="btn btn-ghost" onClick={onClose}>Close</button> : <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        {wo && wo.status === 'Open' && <button className="btn btn-secondary" disabled={busy} onClick={() => setStatus('In progress')}><i className="fa-solid fa-play" /> Start</button>}
        {wo && <button className="btn btn-secondary" disabled={busy} onClick={() => setCompleting(c => !c)}><i className="fa-solid fa-circle-check" /> Complete…</button>}
        <button className="btn btn-primary" disabled={busy} onClick={save}><i className="fa-solid fa-floppy-disk" /> {wo ? 'Save' : 'Raise work order'}</button>
      </>}>
      {wo && <div className="row" style={{ marginBottom: 12 }}><Tag tone={WO_TONE[wo.status]}>{wo.status}</Tag>
        <span className="cell-sub">Raised {formatDate(wo.createdAt)}{wo.createdByName ? ` by ${wo.createdByName}` : ''}</span></div>}
      <fieldset disabled={readOnly} className="plain-fieldset">
        <div className="form-grid">
          <div className="full"><label className="form-label">Asset *</label>
            {wo ? <div><Link to={`/assets/${encodeURIComponent(wo.assetId)}`}>{wo.assetName}</Link> <span className="cell-sub mono">{wo.assetId}</span></div>
              : <AssetPicker assets={assets} value={f.assetId} onChange={id => setF(p => ({ ...p, assetId: id }))} />}</div>
          <div className="full"><label className="form-label">Title *</label><input className="form-control" value={f.title} onChange={set('title')} maxLength={200} placeholder="e.g. Repair leaking roof, Block B" /></div>
          <div className="full"><label className="form-label">Details</label><textarea className="form-control" value={f.description} onChange={set('description')} /></div>
          <div><label className="form-label">Category</label><select className="form-control" value={f.category} onChange={set('category')}>{summary.options.categories.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="form-label">Priority</label><select className="form-control" value={f.priority} onChange={set('priority')}>{['Low', 'Medium', 'High', 'Urgent'].map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="form-label">Assigned to</label><input className="form-control" value={f.assignedTo} onChange={set('assignedTo')} placeholder="Technician or contractor" /></div>
          <div><label className="form-label">Due date</label><input className="form-control" type="date" value={f.dueDate} onChange={set('dueDate')} /></div>
          <div><label className="form-label">Cost (₦)</label><input className="form-control" type="number" min={0} value={f.cost} onChange={set('cost')} /></div>
        </div>
      </fieldset>
      {wo?.status === 'Completed' && <div className="alert alert-success" style={{ marginTop: 12 }}>
        <strong>Completed {formatDate(wo.completedAt)}</strong>{wo.cost != null && <> · {formatNaira(wo.cost)}</>}<div>{wo.completionNote}</div></div>}
      {completing && !readOnly && (
        <div className="report-actions" style={{ marginTop: 12 }}>
          <label className="form-label">What was done? *</label>
          <textarea className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="This goes on the asset's maintenance log" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setStatus('Completed')}><i className="fa-solid fa-circle-check" /> Mark completed</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('Cancelled')}>Cancel work order</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Planned maintenance ──────────────────────────────────────────────────────
function Plans({ summary, assets, version, onChange }: { summary: BtmSummary; assets: Asset[]; version: number; onChange: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<MaintenancePlan[] | null>(null);
  const [editing, setEditing] = useState<MaintenancePlan | 'new' | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { btmApi.listPlans().then(setList).catch(err => toast(errorMessage(err), 'error')); }, [version, toast]);
  const shown = useMemo(() => (list || []).filter(p => !q.trim() || `${p.task} ${p.assetName} ${p.assignedTo}`.toLowerCase().includes(q.trim().toLowerCase())), [list, q]);

  const raise = async (p: MaintenancePlan) => {
    try { const { workOrder } = await btmApi.raiseFromPlan(p._id); toast(`Work order ${workOrder.ref} raised`); onChange(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <>
      <div className="filter-bar">
        <div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="form-control" placeholder="Search task, asset, assignee…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {summary.canManage && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> New planned task</button>}
      </div>
      <div className="card table-wrap">
        {list === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : shown.length === 0 ? <div className="empty-state"><div className="empty-title">No planned maintenance</div><div className="empty-sub">Add recurring tasks such as generator servicing, fumigation or fire-equipment checks.</div></div> : (
          <table className="data-table">
            <thead><tr><th>Task</th><th>Asset</th><th>Every</th><th>Last done</th><th>Next due</th><th /></tr></thead>
            <tbody>{shown.map(p => (
              <tr key={p._id}>
                <td><strong>{p.task}</strong><div className="cell-sub">{p.category}{p.assignedTo ? ` · ${p.assignedTo}` : ''}</div></td>
                <td><Link to={`/assets/${encodeURIComponent(p.assetId)}`}>{p.assetName}</Link></td>
                <td>{p.frequency}</td>
                <td>{p.lastDone ? formatDate(p.lastDone) : <span className="cell-sub">—</span>}</td>
                <td style={{ color: isPast(p.nextDue) ? 'var(--danger)' : undefined, fontWeight: isPast(p.nextDue) ? 600 : undefined }}>{formatDate(p.nextDue)}{isPast(p.nextDue) && <div className="cell-sub">Overdue</div>}</td>
                <td>{summary.canManage && <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => raise(p)} title="Raise a work order for this task"><i className="fa-solid fa-screwdriver-wrench" /> Work order</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditing(p)} aria-label="Edit"><i className="fa-solid fa-pen" /></button>
                </div>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {editing && <PlanModal plan={editing === 'new' ? null : editing} summary={summary} assets={assets} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />}
    </>
  );
}

function PlanModal({ plan, summary, assets, onClose, onSaved }: { plan: MaintenancePlan | null; summary: BtmSummary; assets: Asset[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    assetId: plan?.assetId || '', task: plan?.task || '', category: plan?.category || 'Other', frequency: plan?.frequency || 'Monthly',
    nextDue: dayInput(plan?.nextDue) || today(), assignedTo: plan?.assignedTo || '', notes: plan?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    if (!f.assetId) { toast('Choose an asset from the register', 'error'); return; }
    if (!f.task.trim()) { toast('Describe the task', 'error'); return; }
    setBusy(true);
    try { await (plan ? btmApi.updatePlan(plan._id, f) : btmApi.createPlan(f)); toast('Planned task saved'); onSaved(); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!plan || !confirm('Delete this planned task?')) return;
    try { await btmApi.deletePlan(plan._id); toast('Deleted'); onSaved(); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <Modal title={plan ? 'Edit planned task' : 'New planned task'} onClose={onClose}
      footer={<>{plan && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}><i className="fa-solid fa-trash" /> Delete</button>}
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <div className="full"><label className="form-label">Asset *</label>
          {plan ? <div>{plan.assetName} <span className="cell-sub mono">{plan.assetId}</span></div>
            : <AssetPicker assets={assets} value={f.assetId} onChange={id => setF(p => ({ ...p, assetId: id }))} />}</div>
        <div className="full"><label className="form-label">Task *</label><input className="form-control" value={f.task} onChange={set('task')} maxLength={200} placeholder="e.g. Service standby generator" /></div>
        <div><label className="form-label">Category</label><select className="form-control" value={f.category} onChange={set('category')}>{summary.options.categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="form-label">Repeats</label><select className="form-control" value={f.frequency} onChange={set('frequency')}>{summary.options.frequencies.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="form-label">Next due *</label><input className="form-control" type="date" value={f.nextDue} onChange={set('nextDue')} /></div>
        <div><label className="form-label">Assigned to</label><input className="form-control" value={f.assignedTo} onChange={set('assignedTo')} /></div>
        <div className="full"><label className="form-label">Notes</label><textarea className="form-control" value={f.notes} onChange={set('notes')} /></div>
      </div>
    </Modal>
  );
}

// ── Training ─────────────────────────────────────────────────────────────────
function Training({ summary, assets, version, onChange }: { summary: BtmSummary; assets: Asset[]; version: number; onChange: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<TrainingSession[] | null>(null);
  const [editing, setEditing] = useState<TrainingSession | 'new' | null>(null);
  useEffect(() => { btmApi.listTraining().then(setList).catch(err => toast(errorMessage(err), 'error')); }, [version, toast]);
  return (
    <>
      <div className="filter-bar">
        <span className="cell-sub">{summary.training.sessionsThisYear} session{summary.training.sessionsThisYear === 1 ? '' : 's'} and {summary.training.attendeesThisYear} attendee{summary.training.attendeesThisYear === 1 ? '' : 's'} this year</span>
        {summary.canManage && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> Record a session</button>}
      </div>
      <div className="card table-wrap">
        {list === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
          : list.length === 0 ? <div className="empty-state"><div className="empty-title">No training recorded</div><div className="empty-sub">Record sessions for facility managers, maintenance staff and occupants.</div></div> : (
          <table className="data-table">
            <thead><tr><th>Session</th><th>Date</th><th>Venue</th><th>Facilitator</th><th>Attendees</th></tr></thead>
            <tbody>{list.map(s => (
              <tr key={s._id} className="row-link" onClick={() => setEditing(s)}>
                <td><strong>{s.title}</strong>{s.topic && <div className="cell-sub">{s.topic}</div>}</td>
                <td>{formatDate(s.date)}</td>
                <td>{s.assetName || s.venue || '—'}</td>
                <td>{s.facilitator || '—'}</td>
                <td>{s.attendees.length}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {editing && <TrainingModal session={editing === 'new' ? null : editing} canManage={summary.canManage} assets={assets} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />}
    </>
  );
}

function TrainingModal({ session, canManage, assets, onClose, onSaved }: { session: TrainingSession | null; canManage: boolean; assets: Asset[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: session?.title || '', topic: session?.topic || '', date: dayInput(session?.date) || today(), durationHours: session?.durationHours ?? '',
    venue: session?.venue || '', assetId: session?.assetId || '', facilitator: session?.facilitator || '', notes: session?.notes || '',
  });
  // One attendee per line: "Name, Organisation".
  const [attendees, setAttendees] = useState((session?.attendees || []).map(a => (a.organisation ? `${a.name}, ${a.organisation}` : a.name)).join('\n'));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));
  const parsed = attendees.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [name, ...org] = l.split(',');
    return { name: name.trim(), organisation: org.join(',').trim() };
  });
  const save = async () => {
    if (!f.title.trim()) { toast('Give the session a title', 'error'); return; }
    setBusy(true);
    const body = { ...f, attendees: parsed };
    try { await (session ? btmApi.updateTraining(session._id, body) : btmApi.createTraining(body)); toast('Training session saved'); onSaved(); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!session || !confirm('Delete this training session?')) return;
    try { await btmApi.deleteTraining(session._id); toast('Deleted'); onSaved(); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <Modal wide title={session ? 'Training session' : 'Record a training session'} onClose={onClose}
      footer={canManage ? <>{session && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}><i className="fa-solid fa-trash" /> Delete</button>}
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>Save</button></>
        : <button className="btn btn-ghost" onClick={onClose}>Close</button>}>
      <fieldset disabled={!canManage} className="plain-fieldset">
        <div className="form-grid">
          <div className="full"><label className="form-label">Title *</label><input className="form-control" value={f.title} onChange={set('title')} maxLength={200} placeholder="e.g. Fire safety and extinguisher use" /></div>
          <div><label className="form-label">Topic</label><input className="form-control" value={f.topic} onChange={set('topic')} /></div>
          <div><label className="form-label">Facilitator</label><input className="form-control" value={f.facilitator} onChange={set('facilitator')} /></div>
          <div><label className="form-label">Date *</label><input className="form-control" type="date" value={f.date} onChange={set('date')} /></div>
          <div><label className="form-label">Duration (hours)</label><input className="form-control" type="number" min={0} step={0.5} value={f.durationHours} onChange={set('durationHours')} /></div>
          <div className="full"><label className="form-label">Building</label><AssetPicker assets={assets} value={f.assetId} onChange={id => setF(p => ({ ...p, assetId: id }))} optional /></div>
          <div className="full"><label className="form-label">Venue (room or address)</label><input className="form-control" value={f.venue} onChange={set('venue')} /></div>
          <div className="full"><label className="form-label">Attendees ({parsed.length}) — one per line: Name, Organisation</label>
            <textarea className="form-control" style={{ minHeight: 120 }} value={attendees} onChange={e => setAttendees(e.target.value)} placeholder={'Amina Bello, FMHUD\nChidi Okafor, Facility contractor'} /></div>
          <div className="full"><label className="form-label">Notes</label><textarea className="form-control" value={f.notes} onChange={set('notes')} /></div>
        </div>
      </fieldset>
    </Modal>
  );
}
