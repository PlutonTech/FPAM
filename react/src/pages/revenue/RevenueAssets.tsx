import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import { activeListingFor, currentValuation } from '../../rms/domain';
import { MODE_FOR_STATUS, REVENUE_STATUS, naira } from '../../rms/format';
import { Empty, RmsHeader } from '../../rms/ui';
import type { RevenueStatus, RmsAsset } from '../../rms/types';
import { AssetDetailModal, CreateListingModal, StatusModal, StatusTag } from './shared';

export default function RevenueAssets() {
  const db = useRms();
  const persona = usePersona();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const status = params.get('status') || '';
  const ready = params.get('ready') === '1';
  const [modal, setModal] = useState<{ kind: 'detail' | 'status' | 'list'; asset: RmsAsset } | null>(null);
  const isRevenue = persona.role === 'revenue';

  const rows = useMemo(() => db.assets.filter(a => {
    if (status && a.revenueStatus !== status) return false;
    if (ready && !(MODE_FOR_STATUS[a.revenueStatus] && currentValuation(db, a.id) && !activeListingFor(db, a.id))) return false;
    const t = q.trim().toLowerCase();
    return !t || [a.name, a.assetCode, a.state, a.mda, a.type].some(v => v.toLowerCase().includes(t));
  }), [db, q, status, ready]);

  const counts = useMemo(() => {
    const m: Partial<Record<RevenueStatus, number>> = {};
    db.assets.forEach(a => { m[a.revenueStatus] = (m[a.revenueStatus] || 0) + 1; });
    return m;
  }, [db]);
  const setFilter = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p); };

  return (
    <div className="page">
      <RmsHeader title="Revenue assets" sub="Assets from the FPAMAS register with their revenue status and eligibility (4.3)" />
      <div className="filter-bar">
        <div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="form-control" placeholder="Search name, code, state, occupant…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="filter-input" value={status} onChange={e => setFilter('status', e.target.value)} aria-label="Revenue status">
          <option value="">All statuses</option>
          {(Object.keys(REVENUE_STATUS) as RevenueStatus[]).map(s => <option key={s} value={s}>{REVENUE_STATUS[s].label} ({counts[s] || 0})</option>)}
        </select>
        <label className="check-label"><input type="checkbox" checked={ready} onChange={e => setFilter('ready', e.target.checked ? '1' : '')} /> Ready to list</label>
      </div>
      <div className="card table-wrap">
        {rows.length === 0 ? <Empty icon="fa-building" title="No assets match" /> : (
          <table className="data-table">
            <thead><tr><th>Asset</th><th>State</th><th>Revenue status</th><th>Current valuation</th><th>Listing</th><th /></tr></thead>
            <tbody>
              {rows.map(a => {
                const val = currentValuation(db, a.id);
                const listing = activeListingFor(db, a.id) || db.listings.filter(l => l.assetId === a.id && l.status === 'awarded').pop();
                const mode = MODE_FOR_STATUS[a.revenueStatus];
                return (
                  <tr key={a.id} className="row-link" onClick={e => { if (!(e.target as HTMLElement).closest('button, a')) setModal({ kind: 'detail', asset: a }); }}>
                    <td><strong>{a.name}</strong><div className="id-cell" style={{ maxWidth: 'none' }}>{a.assetCode}</div><div className="cell-sub">{a.type} · {a.mda}</div></td>
                    <td>{a.state}</td>
                    <td><StatusTag status={a.revenueStatus} /></td>
                    <td>{val ? <>{naira(val.valueKobo)}<div className="cell-sub">{val.valuationNo}</div></> : mode ? <span className="cell-sub">Needs valuation</span> : <span className="cell-sub">—</span>}</td>
                    <td>{listing ? <Link to={`/revenue/listings/${listing.id}`}>{listing.listingNo}</Link> : <span className="cell-sub">—</span>}</td>
                    <td><div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                      {isRevenue && mode && val && !activeListingFor(db, a.id) && <button className="btn btn-primary btn-xs" onClick={() => setModal({ kind: 'list', asset: a })}><i className="fa-solid fa-bullhorn" /> List</button>}
                      {isRevenue && <button className="btn btn-ghost btn-xs" title="Change revenue status" onClick={() => setModal({ kind: 'status', asset: a })}><i className="fa-solid fa-pen" /></button>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!isRevenue && <p className="cell-sub" style={{ marginTop: 10 }}>Switch to the Revenue Officer to change statuses or create listings.</p>}
      {modal?.kind === 'detail' && <AssetDetailModal asset={db.assets.find(a => a.id === modal.asset.id)!} onClose={() => setModal(null)} />}
      {modal?.kind === 'status' && <StatusModal asset={modal.asset} onClose={() => setModal(null)} />}
      {modal?.kind === 'list' && <CreateListingModal asset={modal.asset} onClose={() => setModal(null)} />}
    </div>
  );
}
