import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { formatDate } from '../../lib/assets';
import { useRms } from '../../rms/store';
import { useCustomer } from '../../rms/customerSession';
import * as d from '../../rms/domain';
import { APP_STATUS, INVOICE_LABEL, INVOICE_TONE, MODE_LABEL, formatRrr, naira } from '../../rms/format';
import { Empty, printInvoice, printOfferLetter, printReceipt, useRmsAction } from '../../rms/ui';
import type { Award, Invoice } from '../../rms/types';
import PublicShell from './PublicShell';
import RemitaPayModal from './RemitaPayModal';

const TABS = [['applications', 'Applications & offers', 'fa-file-signature'], ['bills', 'Bills', 'fa-file-invoice'], ['receipts', 'Receipts', 'fa-receipt'], ['property', 'My properties', 'fa-key'], ['profile', 'Profile', 'fa-user']] as const;

export default function CustomerAccountPage() {
  const db = useRms();
  const customer = useCustomer();
  const [params, setParams] = useSearchParams();
  const [paying, setPaying] = useState<Invoice | null>(null);
  if (!customer) return <Navigate to="/customer/login?next=/customer" replace />;
  const tab = params.get('tab') || 'applications';
  const unpaid = db.invoices.filter(i => i.customerId === customer.id && (i.status === 'unpaid' || i.status === 'part_paid'));
  const offers = db.awards.filter(a => a.customerId === customer.id && a.status === 'offered');

  return (
    <PublicShell>
      <header className="page-header">
        <div><h1 className="page-title">Welcome, {customer.name}</h1><div className="page-sub">Customer {customer.customerNo} · KYC {customer.kycStatus === 'verified' ? <Tag tone="green">verified</Tag> : <Tag tone="warn">pending</Tag>}</div></div>
        <Link to="/properties" className="btn btn-ghost btn-sm"><i className="fa-solid fa-magnifying-glass" /> Browse properties</Link>
      </header>
      {(offers.length > 0 || unpaid.length > 0) && (
        <div className="card form-section rms-alert" style={{ marginBottom: 14 }}>
          {offers.map(o => <div key={o.id}><i className="fa-solid fa-gavel" /> You have an offer ({o.offerNo}) waiting for your answer. <button className="btn btn-primary btn-xs" onClick={() => setParams({ tab: 'applications' })}>View offer</button></div>)}
          {unpaid.length > 0 && <div><i className="fa-solid fa-file-invoice" /> {unpaid.length} unpaid bill{unpaid.length === 1 ? '' : 's'} totalling {naira(unpaid.reduce((t, i) => t + i.totalKobo - i.paidKobo, 0))}. <button className="btn btn-ghost btn-xs" onClick={() => setParams({ tab: 'bills' })}>View bills</button></div>}
        </div>
      )}
      <div className="card">
        <div className="tab-bar">{TABS.map(([k, label, icon]) => <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setParams({ tab: k })}><i className={`fa-solid ${icon}`} /> {label}</button>)}</div>
        <div className="tab-body">
          {tab === 'applications' && <Applications onPay={setPaying} />}
          {tab === 'bills' && <Bills onPay={setPaying} />}
          {tab === 'receipts' && <Receipts />}
          {tab === 'property' && <Properties />}
          {tab === 'profile' && <Profile />}
        </div>
      </div>
      {paying && <RemitaPayModal invoice={paying} onClose={() => setPaying(null)} />}
    </PublicShell>
  );
}

function Applications({ onPay }: { onPay: (i: Invoice) => void }) {
  const db = useRms();
  const customer = useCustomer()!;
  const run = useRmsAction();
  const [responding, setResponding] = useState<{ award: Award; accept: boolean } | null>(null);
  const apps = db.applications.filter(a => a.customerId === customer.id).reverse();
  if (!apps.length) return <Empty icon="fa-file-signature" title="No applications yet" sub="Find a property and apply or bid." />;
  return (
    <div className="list">
      {apps.map(a => {
        const l = db.listings.find(x => x.id === a.listingId)!;
        const asset = db.assets.find(x => x.id === l.assetId)!;
        const fee = db.invoices.find(i => i.id === a.feeInvoiceId);
        const award = db.awards.filter(w => w.applicationId === a.id).pop();
        const demand = award?.invoiceId ? db.invoices.find(i => i.id === award.invoiceId) : undefined;
        return (
          <div key={a.id} className="list-row rms-app" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/properties/${l.id}`}><strong>{l.title}</strong></Link>
              <div className="cell-sub">{a.applicationNo} · {MODE_LABEL[l.mode]} · {l.mode === 'auction' ? 'bid' : 'offer'} {naira(a.amountKobo)} · {formatDate(a.submittedAt)}</div>
              <div className="row" style={{ marginTop: 6 }}><Tag tone={APP_STATUS[a.status].tone}>{APP_STATUS[a.status].label}</Tag>
                {a.status === 'submitted' && <span className="cell-sub">{l.status === 'open' ? `Sealed until ${formatDate(l.closeDate)}` : 'Under evaluation'}</span>}
                {a.status === 'recommended' && <span className="cell-sub">Under evaluation</span>}</div>
              {award && (
                <div className="rms-offer">
                  {award.status === 'offered' && <><strong><i className="fa-solid fa-gavel" /> Offer {award.offerNo}</strong> — the committee approved your {l.mode === 'auction' ? 'bid' : 'application'} at {naira(award.amountKobo)}{l.mode === 'lease' ? '/year' : ''}.</>}
                  {award.status === 'accepted' && <>Offer {award.offerNo} accepted. Pay the demand notice to complete.</>}
                  {award.status === 'completed' && <><i className="fa-solid fa-circle-check" style={{ color: 'var(--success)' }} /> Completed — {l.mode === 'lease' ? 'your lease is registered' : 'ownership transfer recorded'}. See <em>My properties</em>.</>}
                  {award.status === 'declined' && <>You declined offer {award.offerNo}.</>}
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => printOfferLetter({ ...award, mode: l.mode, title: l.title, assetCode: asset.assetCode, address: asset.address, leaseYears: l.leaseYears, customer })}><i className="fa-solid fa-print" /> Offer letter</button>
                    {award.status === 'offered' && <>
                      <button className="btn btn-primary btn-xs" onClick={() => setResponding({ award, accept: true })}>Accept offer</button>
                      <button className="btn btn-danger btn-xs" onClick={() => setResponding({ award, accept: false })}>Decline</button>
                    </>}
                    {demand && demand.status !== 'paid' && <button className="btn btn-primary btn-xs" onClick={() => onPay(demand)}>Pay {naira(demand.totalKobo - demand.paidKobo)}</button>}
                  </div>
                </div>
              )}
            </div>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              {a.status === 'awaiting_fee' && fee && <button className="btn btn-primary btn-xs" onClick={() => onPay(fee)}>Pay fee</button>}
              {['awaiting_fee', 'submitted'].includes(a.status) && l.status === 'open' && <button className="btn btn-ghost btn-xs" onClick={() => {
                if (confirm(`Withdraw ${a.applicationNo}?${fee?.status === 'paid' ? ' The fee you paid is non-refundable.' : ''}`)) run(dbx => { d.withdrawApplication(dbx, customer.id, a.id); return true; }, 'Application withdrawn');
              }}>Withdraw</button>}
            </div>
          </div>
        );
      })}
      {responding && (
        <Modal title={responding.accept ? `Accept offer ${responding.award.offerNo}` : `Decline offer ${responding.award.offerNo}`} onClose={() => setResponding(null)} footer={<>
          <button className="btn btn-ghost" onClick={() => setResponding(null)}>Cancel</button>
          <button className={`btn ${responding.accept ? 'btn-primary' : 'btn-danger'}`} onClick={() => {
            const ok = run(dbx => { d.respondToOffer(dbx, customer.id, responding.award.id, responding.accept); return true; }, responding.accept ? 'Offer accepted — your demand notice is ready to pay' : 'Offer declined');
            if (ok) setResponding(null);
          }}>{responding.accept ? 'Accept and get demand notice' : 'Decline offer'}</button>
        </>}>
          <p style={{ fontSize: 13 }}>{responding.accept
            ? `A demand notice will be issued for ${naira(responding.award.amountKobo)} plus the documentation fee, payable within 30 days with a Remita RRR.`
            : 'Declining is final. The asset goes back to the committee to consider other applicants.'}</p>
        </Modal>
      )}
    </div>
  );
}

function Bills({ onPay }: { onPay: (i: Invoice) => void }) {
  const db = useRms();
  const customer = useCustomer()!;
  const bills = db.invoices.filter(i => i.customerId === customer.id).reverse();
  if (!bills.length) return <Empty icon="fa-file-invoice" title="No bills" />;
  return (
    <div className="table-wrap"><table className="data-table">
      <thead><tr><th>Bill</th><th>For</th><th>Amount</th><th>RRR</th><th>Due</th><th>Status</th><th /></tr></thead>
      <tbody>{bills.map(i => (
        <tr key={i.id}>
          <td><strong>{i.invoiceNo}</strong><div className="cell-sub">{i.ref.type === 'award' ? 'Demand notice' : 'Fee'}</div></td>
          <td style={{ fontSize: 12 }}>{i.lines.map(l => <div key={l.code}>{l.description}: {naira(l.amountKobo)}</div>)}</td>
          <td><strong>{naira(i.totalKobo)}</strong>{i.paidKobo > 0 && i.status !== 'paid' && <div className="cell-sub">paid {naira(i.paidKobo)}</div>}</td>
          <td className="mono">{formatRrr(i.rrr)}</td>
          <td>{formatDate(i.dueDate)}</td>
          <td><Tag tone={INVOICE_TONE[i.status]}>{INVOICE_LABEL[i.status]}</Tag></td>
          <td><div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
            {(i.status === 'unpaid' || i.status === 'part_paid') && <button className="btn btn-primary btn-xs" onClick={() => onPay(i)}>Pay</button>}
            <button className="btn btn-ghost btn-xs" title="Print" onClick={() => printInvoice(i, customer)}><i className="fa-solid fa-print" /></button>
          </div></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

function Receipts() {
  const db = useRms();
  const customer = useCustomer()!;
  const rows = db.payments.filter(p => p.customerId === customer.id).reverse();
  if (!rows.length) return <Empty icon="fa-receipt" title="No receipts yet" />;
  const total = rows.reduce((t, p) => t + p.amountKobo, 0);
  return (
    <>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Receipt</th><th>Date</th><th>For</th><th>Amount</th><th>Channel</th><th /></tr></thead>
        <tbody>{rows.map(p => {
          const inv = db.invoices.find(i => i.id === p.invoiceId);
          return (
            <tr key={p.id}><td><strong>{p.receiptNo}</strong><div className="cell-sub mono">RRR {formatRrr(p.rrr)}</div></td><td>{new Date(p.paidAt).toLocaleString('en-NG')}</td>
              <td style={{ fontSize: 12 }}>{inv?.lines.map(l => l.description).join('; ')}</td><td><strong>{naira(p.amountKobo)}</strong></td><td>{p.channel}</td>
              <td><button className="btn btn-ghost btn-xs" onClick={() => printReceipt(p, inv, customer)}><i className="fa-solid fa-print" /> Receipt</button></td></tr>
          );
        })}</tbody>
      </table></div>
      <p className="cell-sub" style={{ marginTop: 10 }}>Total paid: <strong>{naira(total)}</strong></p>
    </>
  );
}

function Properties() {
  const db = useRms();
  const customer = useCustomer()!;
  const rows = db.contracts.filter(c => c.customerId === customer.id);
  if (!rows.length) return <Empty icon="fa-key" title="No properties yet" sub="Completed purchases and leases appear here." />;
  return (
    <div className="list">{rows.map(c => {
      const a = db.assets.find(x => x.id === c.assetId)!;
      return (
        <div key={c.id} className="list-row">
          <i className={`fa-solid ${c.type === 'lease' ? 'fa-file-contract' : 'fa-key'}`} style={{ color: 'var(--accent)', width: 18 }} />
          <div style={{ flex: 1, minWidth: 0 }}><strong>{a.name}</strong><div className="cell-sub">{c.contractNo} · {c.type === 'lease' ? `Lease ${formatDate(c.startDate)} – ${formatDate(c.endDate)} · ${naira(c.amountKobo)}/yr` : `Purchased ${formatDate(c.startDate)} for ${naira(c.amountKobo)}`}</div><div className="cell-sub">{a.address}</div></div>
          <Tag tone="green">{c.type === 'lease' ? 'Leased' : 'Owned'}</Tag>
        </div>
      );
    })}</div>
  );
}

function Profile() {
  const customer = useCustomer()!;
  return (
    <div className="meta-grid" style={{ maxWidth: 560 }}>
      <div><div className="meta-key">Customer number</div><div className="meta-val">{customer.customerNo}</div></div>
      <div><div className="meta-key">Type</div><div className="meta-val">{customer.type}</div></div>
      <div className="full"><div className="meta-key">Name</div><div className="meta-val">{customer.name}</div></div>
      <div><div className="meta-key">{customer.type === 'corporate' ? 'RC number' : 'NIN'}</div><div className="meta-val">{customer.idNumber.replace(/.(?=.{3})/g, '•')}</div></div>
      <div><div className="meta-key">KYC</div><div className="meta-val">{customer.kycStatus}</div></div>
      <div><div className="meta-key">Email</div><div className="meta-val">{customer.email}</div></div>
      <div><div className="meta-key">Phone</div><div className="meta-val">{customer.phone}</div></div>
      <div className="full"><div className="meta-key">Address</div><div className="meta-val">{customer.address || '—'}</div></div>
    </div>
  );
}
