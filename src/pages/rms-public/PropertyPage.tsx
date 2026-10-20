import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { Tag } from '../../components/Tags';
import { useRms } from '../../rms/store';
import { useCustomer } from '../../rms/customerSession';
import * as d from '../../rms/domain';
import { AMOUNT_LABEL, APP_STATUS, MODE_LABEL, MODE_TONE, daysLeft, koboToInput, naira, toKobo } from '../../rms/format';
import { useRmsAction } from '../../rms/ui';
import type { Invoice } from '../../rms/types';
import PublicShell from './PublicShell';
import RemitaPayModal from './RemitaPayModal';

const MAX_DOC_MB = 10;

export default function PropertyPage() {
  const { id } = useParams();
  const db = useRms();
  const customer = useCustomer();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const l = db.listings.find(x => x.id === id);

  if (!l || l.status === 'cancelled') return <PublicShell><div className="card form-section"><h2>Listing not found</h2><Link to="/properties">See available properties</Link></div></PublicShell>;
  const a = db.assets.find(x => x.id === l.assetId)!;
  const accepting = l.status === 'open' && d.isSealed(l);
  const mine = customer ? db.applications.find(x => x.listingId === l.id && x.customerId === customer.id && x.status !== 'withdrawn') : undefined;
  let fee: { description: string; amountKobo: number } | undefined;
  try { fee = d.activeFee(db, l.mode === 'auction' ? 'BID-PART' : 'APP-FORM'); } catch { /* none */ }
  const dl = daysLeft(l.closeDate);

  return (
    <PublicShell>
      <Link to="/properties" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}><i className="fa-solid fa-arrow-left" /> All properties</Link>
      <div className="pub-detail">
        <div>
          <div className="card form-section" style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 8 }}><Tag tone={MODE_TONE[l.mode]}>{MODE_LABEL[l.mode]}</Tag><span className="cell-sub">{l.listingNo}</span></div>
            <h1 className="av-name" style={{ marginBottom: 6 }}>{l.title}</h1>
            <div className="cell-sub" style={{ fontSize: 12, marginBottom: 14 }}><i className="fa-solid fa-location-dot" /> {a.address}</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{l.description}</p>
            <div className="meta-grid">
              <div><div className="meta-key">Type</div><div className="meta-val">{a.type}</div></div>
              <div><div className="meta-key">Size</div><div className="meta-val">{a.sizeSqm ? `${a.sizeSqm.toLocaleString('en-NG')} m²` : '—'}</div></div>
              <div><div className="meta-key">State / LGA</div><div className="meta-val">{a.state} · {a.lga}</div></div>
              <div><div className="meta-key">Asset code</div><div className="meta-val mono" style={{ fontSize: 12 }}>{a.assetCode}</div></div>
              {l.mode === 'lease' && <div><div className="meta-key">Lease term</div><div className="meta-val">{l.leaseYears} year{l.leaseYears === 1 ? '' : 's'}</div></div>}
            </div>
          </div>
          <div className="card pub-map">
            <MapContainer center={[a.lat, a.lng]} zoom={14} scrollWheelZoom={false} style={{ height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <CircleMarker center={[a.lat, a.lng]} radius={11} pathOptions={{ color: '#0B2545', fillColor: '#4A90D9', fillOpacity: 0.8 }} />
            </MapContainer>
          </div>
        </div>

        <div>
          <div className="card form-section pub-side">
            <div className="meta-key">{AMOUNT_LABEL[l.mode]}</div>
            <div className="pub-price">{naira(l.reservePriceKobo)}<span>{l.mode === 'lease' ? ' / year' : ''}</span></div>
            <div className={`pub-card-close${dl <= 3 ? ' soon' : ''}`} style={{ marginBottom: 14 }}><i className="fa-regular fa-clock" /> {accepting ? `Closes ${new Date(l.closeDate).toLocaleString('en-NG')} (${dl} day${dl === 1 ? '' : 's'})` : 'Applications closed'}</div>
            {mine ? <MyApplication appId={mine.id} onPay={setPaying} />
              : !accepting ? <p style={{ fontSize: 13 }}>This listing is no longer accepting applications.</p>
              : !customer ? <>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>Register or sign in to {l.mode === 'auction' ? 'place a sealed bid' : 'apply'}.</p>
                  <div className="row"><Link className="btn btn-primary btn-sm" to={`/customer/register?next=/properties/${l.id}`}>Register</Link><Link className="btn btn-ghost btn-sm" to={`/customer/login?next=/properties/${l.id}`}>Sign in</Link></div>
                </>
              : <ApplyForm listingId={l.id} onCreated={setPaying} />}
            {fee && !mine && accepting && <p className="cell-sub" style={{ marginTop: 12 }}>{fee.description}: {naira(fee.amountKobo)}, paid with Remita when you {l.mode === 'auction' ? 'bid' : 'apply'}. Non-refundable.</p>}
            {l.mode === 'auction' && <p className="cell-sub" style={{ marginTop: 6 }}><i className="fa-solid fa-lock" /> Sealed bids: no one at FPAM can see bid amounts before the closing date.</p>}
          </div>
        </div>
      </div>
      {paying && <RemitaPayModal invoice={paying} onClose={() => setPaying(null)} />}
    </PublicShell>
  );
}

function ApplyForm({ listingId, onCreated }: { listingId: string; onCreated: (inv: Invoice) => void }) {
  const db = useRms();
  const customer = useCustomer()!;
  const run = useRmsAction();
  const l = db.listings.find(x => x.id === listingId)!;
  const [amount, setAmount] = useState(koboToInput(l.reservePriceKobo));
  const [statement, setStatement] = useState('');
  const [docs, setDocs] = useState<{ name: string; size: number }[]>([]);
  const [docError, setDocError] = useState('');
  const [agree, setAgree] = useState(false);

  function addFiles(files: FileList | null) {
    setDocError('');
    const ok = Array.from(files || []).filter(f => {
      if (f.size > MAX_DOC_MB * 1024 * 1024) { setDocError(`${f.name} is over ${MAX_DOC_MB} MB`); return false; }
      return true;
    }).map(f => ({ name: f.name, size: f.size }));
    setDocs(v => [...v, ...ok]);
  }

  function submit() {
    if (!agree) { run(() => { throw new Error('Confirm the declaration first'); }); return; }
    const r = run(dbx => d.submitApplication(dbx, customer.id, { listingId, amountKobo: toKobo(amount), statement, documents: docs }),
      v => `${v.app.applicationNo} created — pay the fee to submit it`);
    if (r) onCreated(r.invoice);
  }

  return (
    <>
      <label className="form-label" htmlFor="ap-amt">{l.mode === 'auction' ? 'Your sealed bid (₦)' : l.mode === 'lease' ? 'Annual rent you offer (₦)' : 'Your offer (₦)'}</label>
      <input id="ap-amt" className="form-control" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
      <div className="cell-sub">Minimum {naira(l.reservePriceKobo)}</div>
      <label className="form-label" htmlFor="ap-st" style={{ marginTop: 12 }}>Purpose / statement</label>
      <textarea id="ap-st" className="form-control" rows={2} value={statement} onChange={e => setStatement(e.target.value)} placeholder="How you intend to use the property" />
      <label className="form-label" style={{ marginTop: 12 }}>Supporting documents</label>
      <input type="file" multiple className="form-control" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} accept=".pdf,.jpg,.jpeg,.png" />
      <div className="cell-sub">{customer.type === 'corporate' ? 'CAC certificate, director’s ID, tax clearance.' : 'NIN slip or international passport, proof of address.'} PDF/JPG/PNG, max {MAX_DOC_MB} MB.</div>
      {docError && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {docError}</div>}
      {docs.length > 0 && <div className="list" style={{ marginTop: 6 }}>{docs.map((f, i) => (
        <div key={i} className="list-row" style={{ padding: '5px 0', fontSize: 12 }}><i className="fa-solid fa-paperclip" /><span style={{ flex: 1, overflowWrap: 'anywhere' }}>{f.name}</span>
          <button className="btn btn-ghost btn-xs" aria-label={`Remove ${f.name}`} onClick={() => setDocs(docs.filter((_, k) => k !== i))}><i className="fa-solid fa-xmark" /></button></div>
      ))}</div>}
      <label className="check-label" style={{ marginTop: 12, whiteSpace: 'normal' }}><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> I confirm the information is true and accept the terms of this {l.mode}.</label>
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={submit}>{l.mode === 'auction' ? 'Place bid & pay fee' : 'Apply & pay fee'}</button>
      <p className="cell-sub" style={{ marginTop: 6 }}>Prototype: only file names are kept (in this browser), not the files.</p>
    </>
  );
}

function MyApplication({ appId, onPay }: { appId: string; onPay: (inv: Invoice) => void }) {
  const db = useRms();
  const app = db.applications.find(a => a.id === appId)!;
  const inv = db.invoices.find(i => i.id === app.feeInvoiceId);
  return (
    <div>
      <div className="form-ok" style={{ marginBottom: 10, background: 'var(--accent-bg)', color: 'var(--navy)' }}>
        <i className="fa-solid fa-file-signature" /> Your application <strong>{app.applicationNo}</strong>: {APP_STATUS[app.status].label}
        <div style={{ marginTop: 4 }}>{app.status === 'awaiting_fee' ? 'Pay the fee to submit it before the closing date.' : `Your ${naira(app.amountKobo)} ${app.status === 'submitted' ? 'is sealed until the closing date.' : 'offer is on record.'}`}</div>
      </div>
      {app.status === 'awaiting_fee' && inv && <button className="btn btn-primary btn-block" onClick={() => onPay(inv)}>Pay {naira(inv.totalKobo - inv.paidKobo)} with Remita</button>}
      <Link to="/customer" className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>Go to my account</Link>
    </div>
  );
}
