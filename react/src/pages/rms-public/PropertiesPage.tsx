import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from '../../components/Tags';
import { useRms } from '../../rms/store';
import { isSealed } from '../../rms/domain';
import { AMOUNT_LABEL, MODE_LABEL, MODE_TONE, daysLeft, naira } from '../../rms/format';
import { Empty } from '../../rms/ui';
import type { ListingMode } from '../../rms/types';
import PublicShell from './PublicShell';

const TYPE_ICON: Record<string, string> = { Residential: 'fa-house', 'Administrative Office': 'fa-building', Equipment: 'fa-truck-pickup', 'Land / Property': 'fa-mountain-sun', Warehouse: 'fa-warehouse' };

export default function PropertiesPage() {
  const db = useRms();
  const [mode, setMode] = useState<ListingMode | ''>('');
  const [state, setState] = useState('');
  const [q, setQ] = useState('');

  // Public sees only listings still accepting applications.
  const open = useMemo(() => db.listings.filter(l => l.status === 'open' && isSealed(l)), [db]);
  const states = [...new Set(open.map(l => db.assets.find(a => a.id === l.assetId)?.state || ''))].filter(Boolean).sort();
  const rows = open.filter(l => {
    const a = db.assets.find(x => x.id === l.assetId)!;
    const t = q.trim().toLowerCase();
    return (!mode || l.mode === mode) && (!state || a.state === state) && (!t || [l.title, a.address, a.state, a.lga].some(v => v.toLowerCase().includes(t)));
  });

  return (
    <PublicShell>
      <section className="pub-hero">
        <h1>Federal public assets available to the public</h1>
        <p>Browse properties and movable assets offered by the Federal Public Assets Maintenance Department. Register once, apply or bid online, and pay securely with Remita.</p>
      </section>
      <div className="filter-bar">
        <div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="form-control" placeholder="Search location or title…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="filter-input" value={mode} onChange={e => setMode(e.target.value as ListingMode | '')} aria-label="Type of offer">
          <option value="">Sale, lease & auction</option><option value="sale">For sale</option><option value="lease">To let</option><option value="auction">Auction</option>
        </select>
        <select className="filter-input" value={state} onChange={e => setState(e.target.value)} aria-label="State"><option value="">All states</option>{states.map(s => <option key={s}>{s}</option>)}</select>
      </div>
      {rows.length === 0 ? <div className="card"><Empty icon="fa-house-circle-xmark" title="No properties match" sub="Try another filter, or check back later." /></div> : (
        <div className="pub-grid">
          {rows.map(l => {
            const a = db.assets.find(x => x.id === l.assetId)!;
            const dl = daysLeft(l.closeDate);
            return (
              <Link key={l.id} to={`/properties/${l.id}`} className="card pub-card">
                <div className="pub-card-img"><i className={`fa-solid ${TYPE_ICON[a.type] || 'fa-landmark'}`} /><Tag tone={MODE_TONE[l.mode]}>{MODE_LABEL[l.mode]}</Tag></div>
                <div className="pub-card-body">
                  <div className="pub-card-title">{l.title}</div>
                  <div className="cell-sub"><i className="fa-solid fa-location-dot" /> {a.lga}, {a.state}</div>
                  <div className="pub-card-price">{naira(l.reservePriceKobo)}<span>{l.mode === 'lease' ? ' / year' : ''}</span></div>
                  <div className="cell-sub">{AMOUNT_LABEL[l.mode]}{l.mode === 'auction' ? ' · sealed bids' : ''}</div>
                  <div className={`pub-card-close${dl <= 3 ? ' soon' : ''}`}><i className="fa-regular fa-clock" /> Closes in {dl} day{dl === 1 ? '' : 's'}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}
