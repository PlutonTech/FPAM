import { useState } from 'react';
import Modal from '../../components/Modal';
import { useCustomer } from '../../rms/customerSession';
import { useRms } from '../../rms/store';
import { simulateRemitaPayment } from '../../rms/domain';
import { formatRrr, naira } from '../../rms/format';
import { printReceipt, useRmsAction } from '../../rms/ui';
import type { Invoice, PayChannel, Payment } from '../../rms/types';

const CHANNELS: { id: PayChannel; icon: string; note: string }[] = [
  { id: 'Card', icon: 'fa-credit-card', note: 'Verve, Mastercard, Visa' },
  { id: 'Bank transfer', icon: 'fa-building-columns', note: 'Internet / mobile banking' },
  { id: 'USSD', icon: 'fa-mobile-screen', note: '*bank code# on any phone' },
  { id: 'Bank branch', icon: 'fa-landmark', note: 'Pay over the counter with the RRR' },
];

/** Simulated Remita checkout: pay → Remita "calls back" → payment posted → receipt. */
export default function RemitaPayModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const db = useRms();
  const customer = useCustomer();
  const run = useRmsAction();
  const [channel, setChannel] = useState<PayChannel>('Card');
  const [stage, setStage] = useState<'choose' | 'processing' | 'done'>('choose');
  const [payment, setPayment] = useState<Payment | null>(null);
  const balance = invoice.totalKobo - invoice.paidKobo;

  function pay() {
    setStage('processing');
    // A short pause stands in for the Remita round trip.
    setTimeout(() => {
      const r = run(d => simulateRemitaPayment(d, customer!.id, invoice.id, channel));
      if (r) { setPayment(r.payment); setStage('done'); } else setStage('choose');
    }, 1200);
  }

  return (
    <Modal title={stage === 'done' ? 'Payment successful' : 'Pay with Remita'} onClose={onClose} footer={
      stage === 'done' ? <>
        <button className="btn btn-ghost" onClick={() => payment && printReceipt(payment, db.invoices.find(i => i.id === invoice.id), customer || undefined)}><i className="fa-solid fa-print" /> Print receipt</button>
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </> : <>
        <button className="btn btn-ghost" onClick={onClose} disabled={stage === 'processing'}>Cancel</button>
        <button className="btn btn-primary" onClick={pay} disabled={stage === 'processing'}>{stage === 'processing' ? <><i className="fa-solid fa-spinner fa-spin" /> Waiting for Remita…</> : `Pay ${naira(balance)}`}</button>
      </>}>
      <div className="remita-box">
        <div className="remita-brand">remita <span>· simulated checkout</span></div>
        <div className="meta-grid">
          <div><div className="meta-key">RRR</div><div className="meta-val mono"><strong>{formatRrr(invoice.rrr)}</strong></div></div>
          <div><div className="meta-key">Amount</div><div className="meta-val"><strong>{naira(balance, { decimals: true })}</strong></div></div>
          <div className="full"><div className="meta-key">Payee</div><div className="meta-val">Federal Public Assets Maintenance Department — {invoice.invoiceNo}</div></div>
        </div>
      </div>
      {stage === 'done' && payment ? (
        <div className="form-ok" style={{ marginTop: 14 }}><i className="fa-solid fa-circle-check" /> Receipt <strong>{payment.receiptNo}</strong>. Remita confirmed the payment (ref {payment.remitaRef}) and it has been posted to your account.</div>
      ) : (
        <div className="remita-channels">
          {CHANNELS.map(c => (
            <label key={c.id} className={`remita-ch${channel === c.id ? ' on' : ''}`}>
              <input type="radio" name="ch" checked={channel === c.id} onChange={() => setChannel(c.id)} disabled={stage === 'processing'} />
              <i className={`fa-solid ${c.icon}`} /><div><strong>{c.id}</strong><div className="cell-sub">{c.note}</div></div>
            </label>
          ))}
        </div>
      )}
      <p className="cell-sub" style={{ marginTop: 12 }}>Prototype: no money moves. In production this opens Remita's payment page and the receipt is issued when Remita's signed notification arrives.</p>
    </Modal>
  );
}
