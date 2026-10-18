import { useState } from 'react';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { Asset } from '../../types';
import { CONDITIONS, STATUSES, assetKey } from '../../lib/assets';

interface Props { asset: Asset; mdas: string[]; onClose: () => void; onSaved: (a: Asset) => void }

export default function EditAssetModal({ asset, mdas, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: asset.name || '', condition: asset.condition || '', status: asset.status || 'Active',
    mda: asset.mda || '', state: asset.state || '', lga: asset.lga || '', notes: asset.notes || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setBusy(true); setError('');
    const data: Record<string, unknown> = { ...form, name: form.name.trim(), condition: form.condition || null };
    // Lets the backend record the change in conditionHistory.
    if (asset.condition && form.condition !== asset.condition) data.previousCondition = asset.condition;
    try {
      const updated = await assetsApi.updateAsset(assetKey(asset), data);
      toast('Asset updated');
      onSaved(updated);
    } catch (err) {
      // Stay open so the user can fix e.g. a duplicate name.
      setError(errorMessage(err));
    } finally { setBusy(false); }
  }

  // Keep the current MDA selectable even if it's no longer in the active list.
  const mdaOptions = form.mda && !mdas.includes(form.mda) ? [form.mda, ...mdas] : mdas;

  return (
    <Modal title={`Edit ${asset.name}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={busy}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> Save changes
      </button>
    </>}>
      <div className="form-grid">
        <div className="full"><label className="form-label">Name</label>
          <input className="form-control" value={form.name} onChange={set('name')} /></div>
        <div><label className="form-label">Condition</label>
          <select className="form-control" value={form.condition} onChange={set('condition')}>
            <option value="">— Not set —</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div><label className="form-label">Status</label>
          <select className="form-control" value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select></div>
        <div className="full"><label className="form-label">MDA / Agency</label>
          <select className="form-control" value={form.mda} onChange={set('mda')}>
            <option value="">— Select MDA —</option>{mdaOptions.map(m => <option key={m}>{m}</option>)}
          </select></div>
        <div><label className="form-label">State</label>
          <input className="form-control" value={form.state} onChange={set('state')} /></div>
        <div><label className="form-label">LGA</label>
          <input className="form-control" value={form.lga} onChange={set('lga')} /></div>
        <div className="full"><label className="form-label">Notes</label>
          <textarea className="form-control" value={form.notes} onChange={set('notes')} /></div>
      </div>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}
