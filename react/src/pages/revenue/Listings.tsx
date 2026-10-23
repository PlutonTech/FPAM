import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { formatDate } from '../../lib/assets';
import { useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import { activeListingFor, currentValuation, isSealed } from '../../rms/domain';
import { AMOUNT_LABEL, LISTING_TONE, MODE_FOR_STATUS, MODE_LABEL, MODE_TONE, daysLeft, naira } from '../../rms/format';
import { Empty, RmsHeader } from '../../rms/ui';
import type { RmsAsset } from '../../rms/types';
import { CreateListingModal } from './shared';

export default function Listings() {
  const db = useRms();
  const persona = usePersona();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [picking, setPicking] = useState(false);
  const [asset, setAsset] = useState<RmsAsset | null>(null);

  const rows = useMemo(() => [...db.listings].reverse().filter(l => !status || l.status === status), [db, status]);
  const ready = db.assets.filter(a => MODE_FOR_STATUS[a.revenueStatus] && currentValuation(db, a.id) && !activeListingFor(db, a.id));

  return (
    <div className="page">
      <RmsHeader title="Listings" sub="Assets offered to the public for sale, lease or auction (4.4)"
        actions={persona.role === 'revenue' && <button className="btn btn-primary btn-sm" onClick={() => setPicking(true)}><i className="fa-solid fa-plus" /> New listing</button>} />
      <div className="filter-bar">
        <select className="filter-input" value={status} onChange={e => setParams(e.target.value ? { status: e.target.value } : {})} aria-label="Status">
          <option value="">All listings</option><option value="open">Open</option><option value="closed">Closed — evaluating</option><option value="awarded">Awarded</option><option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="card table-wrap">
        {rows.length === 0 ? <Empty icon="fa-bullhorn" title="No listings" /> : (
          <table className="data-table">
            <thead><tr><th>Listing</th><th>Mode</th><th>Amount</th><th>Closes</th><th>Applications</th><th>Status</th></tr></thead>
            <tbody>{rows.map(l => {
              const apps = db.applications.filter(a => a.listingId === l.id && a.status !== 'withdrawn');
              const dl = daysLeft(l.closeDate);
              return (
                <tr key={l.id} className="row-link" onClick={() => navigate(`/revenue/listings/${l.id}`)}>
                  <td><strong>{l.title}</strong><div className="cell-sub">{l.listingNo}</div></td>
                  <td><Tag tone={MODE_TONE[l.mode]}>{MODE_LABEL[l.mode]}</Tag></td>
                  <td>{naira(l.reservePriceKobo)}<div className="cell-sub">{AMOUNT_LABEL[l.mode]}</div></td>
                  <td>{formatDate(l.closeDate)}<div className="cell-sub">{l.status === 'open' ? (dl > 0 ? `${dl} day${dl === 1 ? '' : 's'} left` : 'Closing date passed') : ''}</div></td>
                  <td>{apps.length}{isSealed(l) && apps.length > 0 && <div className="cell-sub"><i className="fa-solid fa-lock" /> sealed</div>}</td>
                  <td><Tag tone={LISTING_TONE[l.status]}>{l.status === 'closed' ? 'Evaluating' : l.status}</Tag>
                    {l.status === 'open' && !isSealed(l) && <div className="cell-sub" style={{ color: 'var(--danger)' }}>Ready to close</div>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      {picking && (
        <Modal title="List an asset" onClose={() => setPicking(false)} footer={<button className="btn btn-ghost" onClick={() => setPicking(false)}>Cancel</button>}>
          {ready.length === 0 ? <p style={{ fontSize: 13 }}>No asset is ready. An asset needs to be marked available for sale, lease or auction (<Link to="/revenue/assets">Revenue assets</Link>) and have an approved valuation.</p> : (
            <div className="picker-list" style={{ maxHeight: 360 }}>
              {ready.map(a => <button key={a.id} className="picker-item" onClick={() => { setPicking(false); setAsset(a); }}>
                <strong>{a.name}</strong><span className="cell-sub">{a.assetCode} · {a.state} · {MODE_LABEL[MODE_FOR_STATUS[a.revenueStatus]!]}</span></button>)}
            </div>
          )}
        </Modal>
      )}
      {asset && <CreateListingModal asset={asset} onClose={() => setAsset(null)} />}
    </div>
  );
}
