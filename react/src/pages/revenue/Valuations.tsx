import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { formatDate } from '../../lib/assets';
import { useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import * as d from '../../rms/domain';
import { MODE_FOR_STATUS, naira, toKobo } from '../../rms/format';
import { Empty, RmsHeader, useRmsAction } from '../../rms/ui';
import type { Valuation, ValuationMethod } from '../../rms/types';
import { DecideValuationModal } from './RevenueApprovals';

const METHODS: ValuationMethod[] = ['Market comparison', 'Income capitalisation', 'Depreciated replacement cost', 'Residual'];
const TONE = { draft: 'warn', approved: 'green', rejected: 'red' } as const;

export default function Valuations() {
  const db = useRms();
  const persona = usePersona();
  const [creating, setCreating] = useState<string | null>(null);   // assetId or '' for picker
  const [deciding, setDeciding] = useState<Valuation | null>(null);
  const [status, setStatus] = useState('');

  const needing = useMemo(() => db.assets.filter(a => MODE_FOR_STATUS[a.revenueStatus] && !d.currentValuation(db, a.id) && !db.valuations.some(v => v.assetId === a.id && v.status === 'draft')), [db]);
  const rows = [...db.valuations].reverse().filter(v => !status || v.status === status);
  const assetOf = (id: string) => db.assets.find(a => a.id === id);

  return (
    <div className="page">
      <RmsHeader title="Valuations" sub="Approved valuations set the floor for sale prices, reserves and rents (4.5). Approved valuations can't be edited."
        actions={persona.role === 'valuer' && <button className="btn btn-primary btn-sm" onClick={() => setCreating('')}><i className="fa-solid fa-plus" /> New valuation</button>} />

      {needing.length > 0 && (
        <div className="card form-section" style={{ marginBottom: 14 }}>
          <div className="form-section-title">Revenue-eligible assets without a current valuation</div>
          <div className="list">
            {needing.map(a => (
              <div key={a.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}><strong>{a.name}</strong><div className="cell-sub">{a.assetCode} · {a.state}</div></div>
                {persona.role === 'valuer' ? <button className="btn btn-secondary btn-xs" onClick={() => setCreating(a.id)}>Value this asset</button> : <span className="cell-sub">Valuer to action</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="filter-bar">
        <select className="filter-input" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
          <option value="">All valuations</option><option value="draft">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="card table-wrap">
        {rows.length === 0 ? <Empty icon="fa-ruler-combined" title="No valuations" /> : (
          <table className="data-table">
            <thead><tr><th>Valuation</th><th>Asset</th><th>Method</th><th>Market value</th><th>Market rent / yr</th><th>Status</th><th /></tr></thead>
            <tbody>{rows.map(v => {
              const a = assetOf(v.assetId);
              return (
                <tr key={v.id}>
                  <td><strong>{v.valuationNo}</strong><div className="cell-sub">by {v.valuer} · {formatDate(v.createdAt)}</div></td>
                  <td>{a?.name}<div className="id-cell" style={{ maxWidth: 'none' }}>{a?.assetCode}</div></td>
                  <td style={{ fontSize: 12 }}>{v.method}</td>
                  <td>{naira(v.valueKobo)}</td>
                  <td>{v.annualRentKobo ? naira(v.annualRentKobo) : '—'}</td>
                  <td><Tag tone={TONE[v.status]}>{v.status === 'draft' ? 'Awaiting approval' : v.status}</Tag>
                    <div className="cell-sub">{v.approvedBy ? `${v.approvedBy}` : ''}{v.status === 'approved' ? ` · valid to ${formatDate(v.validUntil)}` : ''}{v.rejectReason ? ` · ${v.rejectReason}` : ''}</div></td>
                  <td>{v.status === 'draft' && persona.role === 'committee' && <button className="btn btn-secondary btn-xs" onClick={() => setDeciding(v)}>Review</button>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
      {creating !== null && <NewValuationModal assetId={creating} onClose={() => setCreating(null)} />}
      {deciding && <DecideValuationModal valuation={deciding} onClose={() => setDeciding(null)} />}
    </div>
  );
}

function NewValuationModal({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const db = useRms();
  const persona = usePersona();
  const run = useRmsAction();
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ assetId, method: METHODS[0] as ValuationMethod, value: '', rent: '', validUntil: nextYear, notes: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));
  const candidates = db.assets.filter(a => !['sold', 'disposed'].includes(a.revenueStatus));

  function save() {
    const v = run(dbx => d.createValuation(dbx, persona, {
      assetId: f.assetId, method: f.method, valueKobo: toKobo(f.value), annualRentKobo: f.rent.trim() ? toKobo(f.rent) : 0, notes: f.notes, validUntil: f.validUntil,
    }), v => `${v.valuationNo} sent to the committee for approval`);
    if (v) onClose();
  }
  return (
    <Modal title="New valuation" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={!f.assetId}>Submit for approval</button>
    </>}>
      <div className="form-grid">
        <div className="full"><label className="form-label">Asset</label>
          <select className="form-control" value={f.assetId} onChange={set('assetId')}>
            <option value="">— Choose an asset —</option>
            {candidates.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>)}
          </select></div>
        <div><label className="form-label">Method</label><select className="form-control" value={f.method} onChange={set('method')}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></div>
        <div><label className="form-label">Valid until</label><input className="form-control" type="date" value={f.validUntil} onChange={set('validUntil')} /></div>
        <div><label className="form-label">Market value (₦)</label><input className="form-control" inputMode="decimal" value={f.value} onChange={set('value')} placeholder="e.g. 145000000" /></div>
        <div><label className="form-label">Market rent per year (₦)</label><input className="form-control" inputMode="decimal" value={f.rent} onChange={set('rent')} placeholder="0 if it can't be let" /></div>
        <div className="full"><label className="form-label">Basis / comparables</label><textarea className="form-control" rows={3} value={f.notes} onChange={set('notes')} /></div>
      </div>
      <p className="cell-sub" style={{ marginTop: 8 }}>A committee member (not you) must approve it. Once approved it can't be changed — a new valuation replaces it.</p>
    </Modal>
  );
}
