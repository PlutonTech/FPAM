import { useState } from 'react';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { Asset } from '../../types';
import { CONDITIONS } from '../../lib/assets';

interface Props { ids: string[]; byKey: Map<string, Asset>; onClose: () => void; onDone: () => void }

export default function SetConditionModal({ ids, byKey, onClose, onDone }: Props) {
  const toast = useToast();
  const [cond, setCond] = useState<string>('Good');
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    let done = 0, skipped = 0; const failures: string[] = [];
    for (const id of ids) {
      const prev = byKey.get(id)?.condition;
      if (prev === cond) { skipped++; continue; }
      try {
        await assetsApi.updateAsset(id, { condition: cond, ...(prev ? { previousCondition: prev } : {}) });
        done++;
      } catch (err) { failures.push(`${id}: ${errorMessage(err)}`); }
    }
    const msg = `${done} updated${skipped ? `, ${skipped} already ${cond}` : ''}`;
    if (failures.length) toast(`${msg}, ${failures.length} failed — ${failures[0]}`, 'error');
    else toast(msg);
    onDone();
  }

  return (
    <Modal title={`Set condition — ${ids.length} asset${ids.length === 1 ? '' : 's'}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={apply} disabled={busy}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> Apply
      </button>
    </>}>
      <label className="form-label">New condition</label>
      <select className="form-control" value={cond} onChange={e => setCond(e.target.value)}>
        {CONDITIONS.map(c => <option key={c}>{c}</option>)}
      </select>
    </Modal>
  );
}
