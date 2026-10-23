import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import { activeListingFor, currentValuation, isSealed } from '../../rms/domain';
import { MODE_FOR_STATUS, naira } from '../../rms/format';
import { Money, RmsHeader } from '../../rms/ui';
import { timeAgo } from '../../lib/assets';

export default function RevenueOverview() {
  const db = useRms();
  const persona = usePersona();

  const s = useMemo(() => {
    const eligible = db.assets.filter(a => MODE_FOR_STATUS[a.revenueStatus]);
    const today = new Date().toISOString().slice(0, 10);
    return {
      eligible: eligible.length,
      needValuation: eligible.filter(a => !currentValuation(db, a.id)),
      readyToList: eligible.filter(a => currentValuation(db, a.id) && !activeListingFor(db, a.id)),
      open: db.listings.filter(l => l.status === 'open'),
      toClose: db.listings.filter(l => l.status === 'open' && !isSealed(l)),
      toEvaluate: db.listings.filter(l => l.status === 'closed' && db.applications.some(a => a.listingId === l.id && a.status === 'submitted') && !db.applications.some(a => a.listingId === l.id && a.status === 'recommended')),
      draftVals: db.valuations.filter(v => v.status === 'draft'),
      recommended: db.applications.filter(a => a.status === 'recommended'),
      kyc: db.customers.filter(c => c.kycStatus === 'pending'),
      outstanding: db.invoices.filter(i => i.status === 'unpaid' || i.status === 'part_paid'),
      overdue: db.invoices.filter(i => (i.status === 'unpaid' || i.status === 'part_paid') && i.dueDate < today),
      collected: db.payments.reduce((t, p) => t + p.amountKobo, 0),
      offers: db.awards.filter(a => a.status === 'offered' || a.status === 'accepted'),
      done: db.contracts.length,
      applications: db.applications.filter(a => a.status !== 'withdrawn').length,
    };
  }, [db]);
  const outstandingKobo = s.outstanding.reduce((t, i) => t + i.totalKobo - i.paidKobo, 0);

  const tasks: { icon: string; text: string; to: string; count: number }[] = {
    revenue: [
      { icon: 'fa-lock-open', text: 'Listings past their closing date — close and open the bids', to: '/revenue/listings?status=open', count: s.toClose.length },
      { icon: 'fa-scale-balanced', text: 'Closed listings waiting for evaluation and a recommendation', to: '/revenue/listings?status=closed', count: s.toEvaluate.length },
      { icon: 'fa-bullhorn', text: 'Valued assets ready to list', to: '/revenue/assets?ready=1', count: s.readyToList.length },
      { icon: 'fa-id-card', text: 'Customers waiting for KYC verification', to: '/revenue/billing?tab=customers', count: s.kyc.length },
    ],
    valuer: [{ icon: 'fa-ruler-combined', text: 'Revenue-eligible assets without a current valuation', to: '/revenue/valuations', count: s.needValuation.length }],
    committee: [
      { icon: 'fa-stamp', text: 'Valuations awaiting approval', to: '/revenue/approvals', count: s.draftVals.filter(v => v.valuer !== persona.name).length },
      { icon: 'fa-gavel', text: 'Award recommendations awaiting the committee', to: '/revenue/approvals', count: s.recommended.length },
    ],
    finance: [
      { icon: 'fa-file-invoice', text: 'Outstanding bills', to: '/revenue/billing', count: s.outstanding.length },
      { icon: 'fa-clock', text: 'Overdue bills', to: '/revenue/billing?status=overdue', count: s.overdue.length },
    ],
    auditor: [{ icon: 'fa-link', text: 'Verify the ledger hash chain', to: '/revenue/ledger', count: 0 }],
  }[persona.role];

  const chain = [
    ['Revenue-eligible assets', s.eligible, 'fa-building'],
    ['Open listings', s.open.length, 'fa-bullhorn'],
    ['Applications & bids', s.applications, 'fa-file-signature'],
    ['Awards / offers', s.offers.length, 'fa-gavel'],
    ['Payments', db.payments.length, 'fa-money-bill-transfer'],
    ['Sold / leased', s.done, 'fa-key'],
  ] as const;

  return (
    <div className="page">
      <RmsHeader title="Revenue overview" sub="Asset → listing → application → valuation → award → invoice → Remita → receipt"
        actions={<Link className="btn btn-ghost btn-sm" to="/properties" target="_blank"><i className="fa-solid fa-arrow-up-right-from-square" /> Public portal</Link>} />

      <div className="kpi-row">
        <div className="card kpi kpi-green"><div className="kpi-label">Collected</div><div className="kpi-value">{naira(s.collected)}</div><div className="kpi-sub">{db.payments.length} Remita payments</div></div>
        <div className="card kpi kpi-orange"><div className="kpi-label">Outstanding</div><div className="kpi-value">{naira(outstandingKobo)}</div><div className="kpi-sub">{s.outstanding.length} bills · {s.overdue.length} overdue</div></div>
        <div className="card kpi kpi-blue"><div className="kpi-label">Open listings</div><div className="kpi-value">{s.open.length}</div><div className="kpi-sub">{s.toClose.length} past closing date</div></div>
        <div className="card kpi kpi-navy"><div className="kpi-label">Awaiting committee</div><div className="kpi-value">{s.draftVals.length + s.recommended.length}</div><div className="kpi-sub">{s.draftVals.length} valuations · {s.recommended.length} awards</div></div>
      </div>

      <div className="card form-section" style={{ marginBottom: 14 }}>
        <div className="form-section-title">Revenue chain</div>
        <div className="rms-chain">
          {chain.map(([label, n, icon], i) => (
            <div key={label} className="rms-chain-step">
              <div className="rms-chain-icon"><i className={`fa-solid ${icon}`} /></div>
              <div className="rms-chain-n">{n}</div>
              <div className="rms-chain-label">{label}</div>
              {i < chain.length - 1 && <i className="fa-solid fa-chevron-right rms-chain-arrow" />}
            </div>
          ))}
        </div>
      </div>

      <div className="dash-split">
        <div className="card form-section">
          <div className="form-section-title">To do — {persona.title}</div>
          <div className="list">
            {tasks.map(t => (
              <Link key={t.text} to={t.to} className="list-row rms-task">
                <i className={`fa-solid ${t.icon}`} style={{ width: 18, color: 'var(--accent)' }} />
                <span style={{ flex: 1 }}>{t.text}</span>
                {persona.role !== 'auditor' && <span className={`rms-count${t.count ? '' : ' zero'}`}>{t.count}</span>}
              </Link>
            ))}
          </div>
          <p className="cell-sub" style={{ marginTop: 10 }}>Switch “Acting as” above to see each role’s queue. Segregation of duties is enforced: a valuer can’t approve their own valuation or the award on an asset they valued, and an evaluator can’t approve their own recommendation.</p>
        </div>
        <div className="card form-section">
          <div className="form-section-title">Recent activity</div>
          <div className="list">
            {db.audit.slice(-8).reverse().map(e => (
              <div key={e.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}><strong>{e.actor}</strong> · {e.action.replace(/_/g, ' ').toLowerCase()} <span className="id-cell" style={{ maxWidth: 'none' }}>{e.entityId}</span></div>
                  {e.detail && <div className="cell-sub">{e.detail}</div>}
                </div>
                <span className="cell-sub" style={{ whiteSpace: 'nowrap' }}>{timeAgo(e.at)}</span>
              </div>
            ))}
          </div>
          <Link to="/revenue/ledger?tab=audit" className="btn btn-ghost btn-xs" style={{ marginTop: 10 }}>Full audit trail</Link>
        </div>
      </div>
      {s.offers.length > 0 && <p className="cell-sub" style={{ marginTop: 12 }}>Offers in progress: {s.offers.map(o => <span key={o.id}>{o.offerNo} (<Money kobo={o.amountKobo} />) </span>)}</p>}
    </div>
  );
}
