import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { formatDate } from '../../lib/assets';
import { useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import * as d from '../../rms/domain';
import { AMOUNT_LABEL, INVOICE_LABEL, INVOICE_TONE, LISTING_TONE, MODE_LABEL, MODE_TONE, daysLeft, naira } from '../../rms/format';
import { Empty, RmsHeader, printOfferLetter, useRmsAction } from '../../rms/ui';
import type { Application } from '../../rms/types';
import { AppStatusTag } from './shared';

export default function ListingDetail() {
  const { id } = useParams();
  const db = useRms();
  const persona = usePersona();
  const run = useRmsAction();
  const [evaluating, setEvaluating] = useState<Application | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const l = db.listings.find(x => x.id === id);
  if (!l) return <div className="page"><RmsHeader title="Listing not found" /><Link to="/revenue/listings">Back to listings</Link></div>;
  const asset = db.assets.find(a => a.id === l.assetId)!;
  const val = db.valuations.find(v => v.id === l.valuationId);
  const apps = db.applications.filter(a => a.listingId === l.id).sort((a, b) => b.amountKobo - a.amountKobo);
  const sealed = d.isSealed(l);
  const award = db.awards.filter(a => a.listingId === l.id).pop();
  const isRevenue = persona.role === 'revenue';
  const dl = daysLeft(l.closeDate);
  const customer = (cid: string) => db.customers.find(c => c.id === cid);

  return (
    <div className="page">
      <RmsHeader title={l.title} sub={`${l.listingNo} · ${asset.assetCode}`} actions={<>
        <Link className="btn btn-ghost btn-sm" to="/revenue/listings"><i className="fa-solid fa-arrow-left" /> Listings</Link>
        {l.status !== 'cancelled' && <Link className="btn btn-ghost btn-sm" to={`/properties/${l.id}`} target="_blank"><i className="fa-solid fa-arrow-up-right-from-square" /> Public page</Link>}
        {isRevenue && l.status === 'open' && <button className="btn btn-primary btn-sm" disabled={sealed} title={sealed ? 'Bids are sealed until the closing date' : undefined}
          onClick={() => run(dbx => { d.closeListing(dbx, persona, l.id); return true; }, 'Listing closed — bids opened for evaluation')}><i className="fa-solid fa-lock-open" /> Close & open bids</button>}
        {isRevenue && (l.status === 'open' || l.status === 'closed') && <button className="btn btn-danger btn-sm" onClick={() => setCancelling(true)}>Cancel listing</button>}
      </>} />

      <div className="dash-split" style={{ marginBottom: 14 }}>
        <div className="card form-section">
          <div className="row" style={{ marginBottom: 10 }}><Tag tone={MODE_TONE[l.mode]}>{MODE_LABEL[l.mode]}</Tag><Tag tone={LISTING_TONE[l.status]}>{l.status === 'closed' ? 'Closed — evaluating' : l.status}</Tag></div>
          <div className="meta-grid">
            <div><div className="meta-key">{AMOUNT_LABEL[l.mode]}</div><div className="meta-val"><strong>{naira(l.reservePriceKobo)}</strong>{l.mode === 'lease' ? ` /yr × ${l.leaseYears} yr` : ''}</div></div>
            <div><div className="meta-key">Approved valuation</div><div className="meta-val">{val ? `${naira(l.mode === 'lease' ? val.annualRentKobo : val.valueKobo)} (${val.valuationNo})` : '—'}</div></div>
            <div><div className="meta-key">Opened</div><div className="meta-val">{formatDate(l.openDate)} by {l.createdBy}</div></div>
            <div><div className="meta-key">Closes</div><div className="meta-val">{new Date(l.closeDate).toLocaleString('en-NG')}{l.status === 'open' && <div className="cell-sub">{dl > 0 ? `${dl} day(s) left` : 'Closing date passed'}</div>}</div></div>
            <div className="full"><div className="meta-key">Asset</div><div className="meta-val">{asset.name} — {asset.address}</div></div>
            <div className="full"><div className="meta-key">Description</div><div className="meta-val">{l.description}</div></div>
          </div>
        </div>
        <div className="card form-section">
          <div className="form-section-title">Award</div>
          {award ? (
            <>
              <div className="meta-grid">
                <div><div className="meta-key">Offer</div><div className="meta-val">{award.offerNo}</div></div>
                <div><div className="meta-key">Status</div><div className="meta-val"><Tag tone={award.status === 'completed' ? 'green' : award.status === 'declined' ? 'gray' : 'warn'}>{award.status}</Tag></div></div>
                <div><div className="meta-key">Awarded to</div><div className="meta-val">{customer(award.customerId)?.name}</div></div>
                <div><div className="meta-key">Amount</div><div className="meta-val">{naira(award.amountKobo)}</div></div>
                <div><div className="meta-key">Recommended by</div><div className="meta-val">{award.recommendedBy}</div></div>
                <div><div className="meta-key">Approved by</div><div className="meta-val">{award.approvedBy}</div></div>
                {award.invoiceId && (() => { const inv = db.invoices.find(i => i.id === award.invoiceId)!; return <div className="full"><div className="meta-key">Demand notice</div><div className="meta-val">{inv.invoiceNo} · {naira(inv.totalKobo)} · <Tag tone={INVOICE_TONE[inv.status]}>{INVOICE_LABEL[inv.status]}</Tag></div></div>; })()}
              </div>
              <button className="btn btn-ghost btn-xs" style={{ marginTop: 12 }} onClick={() => printOfferLetter({ ...award, mode: l.mode, title: l.title, assetCode: asset.assetCode, address: asset.address, leaseYears: l.leaseYears, customer: customer(award.customerId) })}><i className="fa-solid fa-print" /> Offer letter</button>
            </>
          ) : <p className="cell-sub">{l.status === 'closed' ? 'Evaluate the applications, recommend one, and the Approval Committee decides.' : sealed ? 'Applications close first; bids stay sealed until then.' : 'No award yet.'}</p>}
        </div>
      </div>

      <div className="card table-wrap">
        <div className="form-section" style={{ paddingBottom: 0 }}><div className="form-section-title">Applications {sealed && <Tag tone="gray"><i className="fa-solid fa-lock" /> Amounts sealed until {formatDate(l.closeDate)}</Tag>}</div></div>
        {apps.length === 0 ? <Empty icon="fa-file-signature" title="No applications yet" /> : (
          <table className="data-table">
            <thead><tr><th>Application</th><th>Applicant</th><th>{l.mode === 'auction' ? 'Bid' : 'Offer'}</th><th>Fee</th><th>Evaluation</th><th>Status</th><th /></tr></thead>
            <tbody>{apps.map(a => {
              const c = customer(a.customerId);
              const fee = db.invoices.find(i => i.id === a.feeInvoiceId);
              return (
                <tr key={a.id}>
                  <td><strong>{a.applicationNo}</strong><div className="cell-sub">{formatDate(a.submittedAt)}</div></td>
                  <td>{c?.name}<div className="cell-sub">{c?.customerNo} · {c?.type} · KYC {c?.kycStatus}</div><div className="cell-sub">{a.documents.map(x => x.name).join(', ')}</div></td>
                  <td>{sealed ? <span className="cell-sub"><i className="fa-solid fa-lock" /> sealed</span> : <strong>{naira(a.amountKobo)}</strong>}</td>
                  <td>{fee && <Tag tone={INVOICE_TONE[fee.status]}>{INVOICE_LABEL[fee.status]}</Tag>}</td>
                  <td>{a.evaluation ? <><strong>{a.evaluation.score}/100</strong><div className="cell-sub">{a.evaluation.by}: {a.evaluation.notes}</div></> : <span className="cell-sub">—</span>}</td>
                  <td><AppStatusTag status={a.status} /></td>
                  <td><div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                    {isRevenue && l.status === 'closed' && ['submitted', 'recommended'].includes(a.status) && <button className="btn btn-secondary btn-xs" onClick={() => setEvaluating(a)}>Evaluate</button>}
                    {isRevenue && l.status === 'closed' && a.status === 'submitted' && a.evaluation && <button className="btn btn-primary btn-xs" onClick={() => run(dbx => { d.recommendApplication(dbx, persona, a.id); return true; }, 'Recommended — sent to the Approval Committee')}>Recommend</button>}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
      {!isRevenue && l.status === 'closed' && <p className="cell-sub" style={{ marginTop: 10 }}>Evaluation and recommendation are done by the Revenue Officer; the award decision by the Approval Committee.</p>}

      {evaluating && <EvaluateModal app={evaluating} onClose={() => setEvaluating(null)} />}
      {cancelling && <CancelModal listingId={l.id} onClose={() => setCancelling(false)} />}
    </div>
  );
}

function EvaluateModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const persona = usePersona();
  const run = useRmsAction();
  const [score, setScore] = useState(String(app.evaluation?.score ?? ''));
  const [notes, setNotes] = useState(app.evaluation?.notes || '');
  return (
    <Modal title={`Evaluate ${app.applicationNo}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={() => { if (run(db => { d.evaluateApplication(db, persona, app.id, Number(score), notes); return true; }, 'Evaluation saved')) onClose(); }}>Save evaluation</button>
    </>}>
      <label className="form-label" htmlFor="ev-score">Score (0–100)</label>
      <input id="ev-score" className="form-control" type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} />
      <label className="form-label" htmlFor="ev-notes" style={{ marginTop: 12 }}>Notes (responsiveness, documents, financial capacity)</label>
      <textarea id="ev-notes" className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
    </Modal>
  );
}

function CancelModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const persona = usePersona();
  const run = useRmsAction();
  const [reason, setReason] = useState('');
  return (
    <Modal title="Cancel listing" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Keep listing</button>
      <button className="btn btn-danger" onClick={() => { if (run(db => { d.cancelListing(db, persona, listingId, reason); return true; }, 'Listing cancelled')) onClose(); }}>Cancel listing</button>
    </>}>
      <p style={{ fontSize: 13, marginBottom: 10 }}>Open applications are withdrawn and unpaid fee bills are reversed in the ledger. Fees already paid are not refunded automatically.</p>
      <label className="form-label" htmlFor="cl-r">Reason</label>
      <input id="cl-r" className="form-control" value={reason} onChange={e => setReason(e.target.value)} />
    </Modal>
  );
}
