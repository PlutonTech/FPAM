import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { formatDate } from '../../lib/assets';
import { useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import * as d from '../../rms/domain';
import { AMOUNT_LABEL, APP_STATUS, LISTING_TONE, MANUAL_STATUSES, MODE_FOR_STATUS, MODE_LABEL, MODE_TONE, REVENUE_STATUS, koboToInput, naira, toKobo } from '../../rms/format';
import { useRmsAction } from '../../rms/ui';
import type { RevenueStatus, RmsAsset } from '../../rms/types';

export const StatusTag = ({ status }: { status: RevenueStatus }) =>
  <Tag tone={REVENUE_STATUS[status].tone}>{REVENUE_STATUS[status].label}</Tag>;

export function AssetDetailModal({ asset, onClose }: { asset: RmsAsset; onClose: () => void }) {
  const db = useRms();
  const vals = db.valuations.filter(v => v.assetId === asset.id).reverse();
  const listings = db.listings.filter(l => l.assetId === asset.id).reverse();
  const contract = asset.currentContractId ? db.contracts.find(c => c.id === asset.currentContractId) : undefined;
  const holder = contract ? db.customers.find(c => c.id === contract.customerId) : undefined;
  return (
    <Modal wide title={asset.name} onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Close</button>}>
      <div className="row" style={{ marginBottom: 12 }}><span className="id-cell" style={{ maxWidth: 'none' }}>{asset.assetCode}</span><StatusTag status={asset.revenueStatus} /></div>
      <div className="meta-grid" style={{ marginBottom: 16 }}>
        <div><div className="meta-key">Type</div><div className="meta-val">{asset.type}</div></div>
        <div><div className="meta-key">State / LGA</div><div className="meta-val">{asset.state} · {asset.lga}</div></div>
        <div className="full"><div className="meta-key">Address</div><div className="meta-val">{asset.address}</div></div>
        <div className="full"><div className="meta-key">Occupant / allocatee (not billed)</div><div className="meta-val">{asset.mda}</div></div>
        {contract && <div className="full"><div className="meta-key">{contract.type === 'lease' ? 'Lessee' : 'Buyer'}</div><div className="meta-val">{holder?.name} · {contract.contractNo} · {naira(contract.amountKobo)}{contract.endDate ? ` · until ${formatDate(contract.endDate)}` : ''}</div></div>}
      </div>
      <div className="form-section-title">Status history</div>
      <table className="data-table" style={{ marginBottom: 16 }}><tbody>
        {[...asset.statusHistory].reverse().map((h, i) => <tr key={i}><td style={{ width: 150 }}>{formatDate(h.at)}</td><td><StatusTag status={h.status} /></td><td>{h.by}</td><td className="cell-sub">{h.note}</td></tr>)}
      </tbody></table>
      <div className="form-section-title">Valuations</div>
      {vals.length ? <table className="data-table" style={{ marginBottom: 16 }}><tbody>
        {vals.map(v => <tr key={v.id}><td>{v.valuationNo}</td><td>{v.method}</td><td>{naira(v.valueKobo)}<div className="cell-sub">rent {naira(v.annualRentKobo)}/yr</div></td><td><Tag tone={v.status === 'approved' ? 'green' : v.status === 'draft' ? 'warn' : 'red'}>{v.status}</Tag>{v.id === asset.currentValuationId && <Tag tone="blue">current</Tag>}</td><td className="cell-sub">by {v.valuer}{v.approvedBy ? `, ${v.status} by ${v.approvedBy}` : ''}<br />valid until {formatDate(v.validUntil)}</td></tr>)}
      </tbody></table> : <p className="cell-sub" style={{ marginBottom: 16 }}>No valuations yet.</p>}
      <div className="form-section-title">Listings</div>
      {listings.length ? <table className="data-table"><tbody>
        {listings.map(l => <tr key={l.id}><td>{l.listingNo}</td><td><Tag tone={MODE_TONE[l.mode]}>{MODE_LABEL[l.mode]}</Tag></td><td>{naira(l.reservePriceKobo)}</td><td><Tag tone={LISTING_TONE[l.status]}>{l.status}</Tag></td><td className="cell-sub">{db.applications.filter(a => a.listingId === l.id && a.status !== 'withdrawn').length} applications</td></tr>)}
      </tbody></table> : <p className="cell-sub">Never listed.</p>}
    </Modal>
  );
}

export function StatusModal({ asset, onClose }: { asset: RmsAsset; onClose: () => void }) {
  const persona = usePersona();
  const run = useRmsAction();
  const [status, setStatus] = useState<RevenueStatus>(asset.revenueStatus);
  const [note, setNote] = useState('');
  return (
    <Modal title={`Revenue status — ${asset.name}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={status === asset.revenueStatus}
        onClick={() => { if (run(db => { d.setRevenueStatus(db, persona, asset.id, status, note); return true; }, 'Status updated')) onClose(); }}>Save</button>
    </>}>
      <label className="form-label" htmlFor="rs">New status</label>
      <select id="rs" className="form-control" value={status} onChange={e => setStatus(e.target.value as RevenueStatus)}>
        {MANUAL_STATUSES.map(s => <option key={s} value={s}>{REVENUE_STATUS[s].label}</option>)}
      </select>
      <p className="cell-sub" style={{ marginTop: 6 }}>Under offer, leased and sold are set automatically by the workflow. MDA-allocated assets are tracked but never billed.</p>
      <label className="form-label" htmlFor="rs-note" style={{ marginTop: 12 }}>Note / authority (optional)</label>
      <input id="rs-note" className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Disposal approval FMHUD/DISP/2026/014" />
    </Modal>
  );
}

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 16);

export function CreateListingModal({ asset, onClose }: { asset: RmsAsset; onClose: () => void }) {
  const db = useRms();
  const persona = usePersona();
  const run = useRmsAction();
  const navigate = useNavigate();
  const mode = MODE_FOR_STATUS[asset.revenueStatus];
  const val = d.currentValuation(db, asset.id);
  const floor = mode === 'lease' ? val?.annualRentKobo : val?.valueKobo;
  const [f, setF] = useState({
    title: `${mode === 'lease' ? 'To let' : mode === 'auction' ? 'Auction' : 'For sale'}: ${asset.name}`,
    description: asset.description, amount: floor ? koboToInput(floor) : '', leaseYears: '1', closeDate: inDays(21),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));
  if (!mode) return null;

  function publish() {
    const l = run(dbx => d.createListing(dbx, persona, {
      assetId: asset.id, title: f.title, description: f.description, reservePriceKobo: toKobo(f.amount),
      leaseYears: Number(f.leaseYears) || 1, closeDate: new Date(f.closeDate).toISOString(),
    }), v => `${v.listingNo} published on the public portal`);
    if (l) { onClose(); navigate(`/revenue/listings/${l.id}`); }
  }

  return (
    <Modal title={`New ${MODE_LABEL[mode].toLowerCase()} listing`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={publish} disabled={!val}><i className="fa-solid fa-bullhorn" /> Publish listing</button>
    </>}>
      <div className="row" style={{ marginBottom: 12 }}><strong>{asset.name}</strong><span className="id-cell" style={{ maxWidth: 'none' }}>{asset.assetCode}</span></div>
      {!val ? <div className="form-error" style={{ marginTop: 0 }}><i className="fa-solid fa-triangle-exclamation" /> This asset has no approved, unexpired valuation. Ask a Valuer to value it and the committee to approve it first.</div> : (
        <div className="form-grid">
          <div className="full"><label className="form-label">Title</label><input className="form-control" value={f.title} onChange={set('title')} /></div>
          <div className="full"><label className="form-label">Description</label><textarea className="form-control" rows={3} value={f.description} onChange={set('description')} /></div>
          <div><label className="form-label">{AMOUNT_LABEL[mode]} (₦)</label><input className="form-control" inputMode="decimal" value={f.amount} onChange={set('amount')} />
            <div className="cell-sub">Approved valuation {val.valuationNo}: {naira(floor)}{mode === 'lease' ? '/yr' : ''} — the floor.</div></div>
          {mode === 'lease'
            ? <div><label className="form-label">Lease term (years)</label><input className="form-control" type="number" min={1} max={25} value={f.leaseYears} onChange={set('leaseYears')} /></div>
            : <div />}
          <div><label className="form-label">Applications close</label><input className="form-control" type="datetime-local" value={f.closeDate} onChange={set('closeDate')} />
            {mode === 'auction' && <div className="cell-sub">Bids stay sealed until this time.</div>}</div>
          <div><label className="form-label">Fee to apply</label><div className="meta-val" style={{ paddingTop: 8 }}>{(() => { try { const fee = d.activeFee(db, mode === 'auction' ? 'BID-PART' : 'APP-FORM'); return `${fee.description}: ${naira(fee.amountKobo)}`; } catch { return '—'; } })()}</div></div>
        </div>
      )}
    </Modal>
  );
}

export const AppStatusTag = ({ status }: { status: keyof typeof APP_STATUS }) =>
  <Tag tone={APP_STATUS[status].tone}>{APP_STATUS[status].label}</Tag>;
