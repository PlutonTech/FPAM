import { useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { formatDate } from '../../lib/assets';
import { useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import * as d from '../../rms/domain';
import { MODE_LABEL, MODE_TONE, naira } from '../../rms/format';
import { Empty, RmsHeader, useRmsAction } from '../../rms/ui';
import type { Application, Valuation } from '../../rms/types';
import { AppStatusTag } from './shared';

export default function RevenueApprovals() {
  const db = useRms();
  const persona = usePersona();
  const [deciding, setDeciding] = useState<Valuation | null>(null);
  const [award, setAward] = useState<{ app: Application; approve: boolean } | null>(null);
  const isCommittee = persona.role === 'committee';

  const vals = db.valuations.filter(v => v.status === 'draft');
  const recs = db.applications.filter(a => a.status === 'recommended');

  return (
    <div className="page">
      <RmsHeader title="Approval committee" sub="Valuation approvals and award decisions (4.6). Every decision is audit-trailed." />
      {!isCommittee && <div className="card form-section" style={{ marginBottom: 14, fontSize: 13 }}><i className="fa-solid fa-circle-info" style={{ color: 'var(--accent)' }} /> You're viewing as {persona.title}. Switch “Acting as” to a committee member to decide.</div>}

      <div className="section-title">Valuations awaiting approval</div>
      <div className="card table-wrap" style={{ marginBottom: 20 }}>
        {vals.length === 0 ? <Empty icon="fa-ruler-combined" title="Nothing waiting" /> : (
          <table className="data-table">
            <thead><tr><th>Valuation</th><th>Asset</th><th>Value</th><th>Rent / yr</th><th>Valuer</th><th /></tr></thead>
            <tbody>{vals.map(v => {
              const a = db.assets.find(x => x.id === v.assetId);
              return (
                <tr key={v.id}>
                  <td><strong>{v.valuationNo}</strong><div className="cell-sub">{v.method}</div></td>
                  <td>{a?.name}<div className="id-cell" style={{ maxWidth: 'none' }}>{a?.assetCode}</div></td>
                  <td>{naira(v.valueKobo)}</td><td>{v.annualRentKobo ? naira(v.annualRentKobo) : '—'}</td>
                  <td>{v.valuer}<div className="cell-sub">{formatDate(v.createdAt)}</div></td>
                  <td>{isCommittee && <button className="btn btn-secondary btn-xs" onClick={() => setDeciding(v)}>Review</button>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      <div className="section-title">Award recommendations</div>
      {recs.length === 0 ? <div className="card"><Empty icon="fa-gavel" title="No recommendations waiting" sub="The Revenue Officer recommends an application after a listing closes." /></div> : recs.map(rec => {
        const l = db.listings.find(x => x.id === rec.listingId)!;
        const asset = db.assets.find(a => a.id === l.assetId)!;
        const val = db.valuations.find(v => v.id === l.valuationId);
        const field = db.applications.filter(a => a.listingId === l.id && ['submitted', 'recommended'].includes(a.status)).sort((a, b) => b.amountKobo - a.amountKobo);
        const floor = l.mode === 'lease' ? val?.annualRentKobo : val?.valueKobo;
        return (
          <div key={rec.id} className="card" style={{ marginBottom: 14 }}>
            <div className="form-section" style={{ paddingBottom: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div><div className="row"><Tag tone={MODE_TONE[l.mode]}>{MODE_LABEL[l.mode]}</Tag><Link to={`/revenue/listings/${l.id}`}><strong>{l.title}</strong></Link></div>
                  <div className="cell-sub">{l.listingNo} · {asset.assetCode} · valuation {val?.valuationNo} by {val?.valuer}: {naira(floor)}{l.mode === 'lease' ? '/yr' : ''}</div></div>
                {isCommittee && <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => setAward({ app: rec, approve: false })}>Send back</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setAward({ app: rec, approve: true })}><i className="fa-solid fa-gavel" /> Approve award</button>
                </div>}
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Rank</th><th>Applicant</th><th>{l.mode === 'auction' ? 'Bid' : 'Offer'}</th><th>vs valuation</th><th>Score</th><th>Status</th></tr></thead>
                <tbody>{field.map((a, i) => {
                  const c = db.customers.find(x => x.id === a.customerId);
                  const pct = floor ? Math.round(((a.amountKobo - floor) / floor) * 1000) / 10 : 0;
                  return (
                    <tr key={a.id} className={a.id === rec.id ? 'rms-row-rec' : undefined}>
                      <td>#{i + 1}</td>
                      <td>{c?.name}<div className="cell-sub">{a.applicationNo} · KYC {c?.kycStatus}</div></td>
                      <td><strong>{naira(a.amountKobo)}</strong></td>
                      <td><Tag tone={pct >= 0 ? 'green' : 'red'}>{pct >= 0 ? '+' : ''}{pct}%</Tag></td>
                      <td>{a.evaluation ? `${a.evaluation.score}/100` : '—'}<div className="cell-sub">{a.evaluation?.notes}</div></td>
                      <td><AppStatusTag status={a.status} />{a.id === rec.id && <div className="cell-sub">by {a.evaluation?.by}</div>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        );
      })}

      {deciding && <DecideValuationModal valuation={deciding} onClose={() => setDeciding(null)} />}
      {award && <AwardModal app={award.app} approve={award.approve} onClose={() => setAward(null)} />}
    </div>
  );
}

export function DecideValuationModal({ valuation: v, onClose }: { valuation: Valuation; onClose: () => void }) {
  const db = useRms();
  const persona = usePersona();
  const run = useRmsAction();
  const [reason, setReason] = useState('');
  const asset = db.assets.find(a => a.id === v.assetId);
  const decide = (approve: boolean) => { if (run(dbx => { d.decideValuation(dbx, persona, v.id, approve, reason); return true; }, approve ? `${v.valuationNo} approved` : `${v.valuationNo} rejected`)) onClose(); };
  return (
    <Modal title={`Review ${v.valuationNo}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-danger" onClick={() => decide(false)}>Reject</button>
      <button className="btn btn-primary" onClick={() => decide(true)}>Approve</button>
    </>}>
      <div className="meta-grid" style={{ marginBottom: 12 }}>
        <div className="full"><div className="meta-key">Asset</div><div className="meta-val">{asset?.name} ({asset?.assetCode})</div></div>
        <div><div className="meta-key">Method</div><div className="meta-val">{v.method}</div></div>
        <div><div className="meta-key">Valuer</div><div className="meta-val">{v.valuer}</div></div>
        <div><div className="meta-key">Market value</div><div className="meta-val"><strong>{naira(v.valueKobo)}</strong></div></div>
        <div><div className="meta-key">Market rent / yr</div><div className="meta-val">{v.annualRentKobo ? naira(v.annualRentKobo) : '—'}</div></div>
        <div className="full"><div className="meta-key">Basis</div><div className="meta-val">{v.notes || '—'}</div></div>
        <div><div className="meta-key">Valid until</div><div className="meta-val">{formatDate(v.validUntil)}</div></div>
      </div>
      <label className="form-label" htmlFor="dv-r">Reason (required to reject)</label>
      <input id="dv-r" className="form-control" value={reason} onChange={e => setReason(e.target.value)} />
    </Modal>
  );
}

function AwardModal({ app, approve, onClose }: { app: Application; approve: boolean; onClose: () => void }) {
  const persona = usePersona();
  const run = useRmsAction();
  const [note, setNote] = useState('');
  return (
    <Modal title={approve ? `Approve award — ${app.applicationNo}` : `Send back — ${app.applicationNo}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className={`btn ${approve ? 'btn-primary' : 'btn-danger'}`} onClick={() => {
        if (run(db => { d.decideAward(db, persona, app.id, approve, note); return true; }, approve ? 'Award approved — offer letter issued to the applicant' : 'Sent back to the Revenue Officer')) onClose();
      }}>{approve ? 'Approve and issue offer' : 'Send back'}</button>
    </>}>
      <p style={{ fontSize: 13, marginBottom: 10 }}>{approve
        ? `Award for ${naira(app.amountKobo)}. Other applicants are marked not successful, the asset goes under offer, and the applicant can accept the offer in the customer portal.`
        : 'The recommendation returns to the Revenue Officer for re-evaluation.'}</p>
      <label className="form-label" htmlFor="aw-n">{approve ? 'Committee minute reference / note' : 'Reason (required)'}</label>
      <input id="aw-n" className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder={approve ? 'e.g. Minutes of meeting 14/2026, item 3' : ''} />
    </Modal>
  );
}
