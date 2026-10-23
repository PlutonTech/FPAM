import { useMemo, useState } from 'react';
import * as inspApi from '../../api/inspections';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { Asset } from '../../types';
import { assetKey } from '../../lib/assets';

interface Props {
  /** Asset to schedule for; omit to show an asset picker. */
  asset?: Asset;
  /** Assets to pick from when no asset is given. */
  assets?: Asset[];
  defaultDate?: string;
  onClose: () => void;
  onDone: (i: inspApi.Inspection) => void;
}

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function ScheduleInspectionModal({ asset, assets = [], defaultDate, onClose, onDone }: Props) {
  const toast = useToast();
  const [picked, setPicked] = useState<Asset | undefined>(asset);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ type: 'Routine', scheduledDate: defaultDate || tomorrow(), assignedTo: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return assets.filter(a => [a.name, a.assetId, a.assetCode, a.state, a.mda].some(v => (v || '').toLowerCase().includes(t))).slice(0, 8);
  }, [assets, q]);

  async function save() {
    if (!picked) { setError('Choose an asset'); return; }
    if (!form.scheduledDate) { setError('Set a date'); return; }
    setBusy(true); setError('');
    try {
      const i = await inspApi.scheduleInspection({
        assetId: assetKey(picked), type: form.type, scheduledDate: form.scheduledDate,
        ...(form.assignedTo.trim() ? { assignedTo: form.assignedTo.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      toast(`Inspection scheduled for ${picked.name}`);
      onDone(i);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Schedule inspection" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={busy}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-calendar-check'}`} /> Schedule
      </button>
    </>}>
      <div className="form-grid">
        <div className="full">
          <label className="form-label">Asset</label>
          {picked ? (
            <div className="picked-asset">
              <div><strong>{picked.name}</strong><div className="id-cell" style={{ maxWidth: 'none' }}>{assetKey(picked)}</div></div>
              {!asset && <button className="btn btn-ghost btn-xs" onClick={() => setPicked(undefined)}>Change</button>}
            </div>
          ) : (
            <>
              <input className="form-control" autoFocus placeholder="Search by name, ID, state or MDA…" value={q} onChange={e => setQ(e.target.value)} />
              {matches.length > 0 && (
                <div className="picker-list">
                  {matches.map(a => (
                    <button key={assetKey(a)} className="picker-item" onClick={() => { setPicked(a); setQ(''); }}>
                      <strong>{a.name}</strong><span className="cell-sub">{assetKey(a)} · {a.state || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
              {q.trim() && matches.length === 0 && <div className="cell-sub" style={{ marginTop: 6 }}>No matching assets</div>}
            </>
          )}
        </div>
        <div><label className="form-label">Type</label>
          <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {inspApi.INSPECTION_TYPES.map(t => <option key={t}>{t}</option>)}
          </select></div>
        <div><label className="form-label">Scheduled date</label>
          <input className="form-control" type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} /></div>
        <div className="full"><label className="form-label">Assign to (optional)</label>
          <input className="form-control" placeholder="Inspector's name" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} /></div>
        <div className="full"><label className="form-label">Notes</label>
          <textarea className="form-control" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}
