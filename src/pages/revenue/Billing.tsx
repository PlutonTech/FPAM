import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import { Tag } from '../../components/Tags';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../lib/assets';
import { tx, useRms } from '../../rms/store';
import { usePersona } from '../../rms/personas';
import * as d from '../../rms/domain';
import { INVOICE_LABEL, INVOICE_TONE, formatRrr, naira, toKobo } from '../../rms/format';
import { Empty, RmsHeader, printInvoice, printReceipt, useRmsAction } from '../../rms/ui';
import type { FeeSchedule, Payment } from '../../rms/types';

const TABS = [['invoices', 'Invoices', 'fa-file-invoice'], ['payments', 'Payments', 'fa-money-bill-transfer'], ['callbacks', 'Remita callbacks', 'fa-satellite-dish'], ['customers', 'Customers', 'fa-users'], ['fees', 'Fee schedules', 'fa-tags']] as const;

export default function Billing() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'invoices';
  return (
    <div className="page">
      <RmsHeader title="Billing & payments" sub="Invoices and demand notices with Remita RRRs, payments, callbacks and fees (4.7, 4.8)" />
      <div className="card">
        <div className="tab-bar">
          {TABS.map(([k, label, icon]) => <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setParams({ tab: k })}><i className={`fa-solid ${icon}`} /> {label}</button>)}
        </div>
        {tab === 'invoices' && <Invoices />}
        {tab === 'payments' && <Payments />}
        {tab === 'callbacks' && <Callbacks />}
        {tab === 'customers' && <Customers />}
        {tab === 'fees' && <Fees />}
      </div>
    </div>
  );
}

function Invoices() {
  const db = useRms();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const today = new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => [...db.invoices].reverse().filter(i => !status || (status === 'overdue' ? (i.status === 'unpaid' || i.status === 'part_paid') && i.dueDate < today : i.status === status)), [db, status, today]);
  const cust = (id: string) => db.customers.find(c => c.id === id);
  return (
    <div className="tab-body">
      <div className="filter-bar">
        <select className="filter-input" value={status} onChange={e => setParams(e.target.value ? { tab: 'invoices', status: e.target.value } : { tab: 'invoices' })} aria-label="Status">
          <option value="">All invoices</option><option value="unpaid">Unpaid</option><option value="part_paid">Part-paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
        </select>
      </div>
      {rows.length === 0 ? <Empty icon="fa-file-invoice" title="No invoices" /> : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Invoice</th><th>Customer</th><th>For</th><th>Total</th><th>Paid</th><th>RRR</th><th>Due</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map(i => (
            <tr key={i.id}>
              <td><strong>{i.invoiceNo}</strong><div className="cell-sub">{i.ref.type === 'award' ? 'Demand notice' : 'Fee'}</div></td>
              <td>{cust(i.customerId)?.name}</td>
              <td style={{ fontSize: 12, maxWidth: 260 }}>{i.lines.map(l => l.description).join('; ')}</td>
              <td>{naira(i.totalKobo)}</td><td>{naira(i.paidKobo)}</td>
              <td className="mono">{formatRrr(i.rrr)}</td>
              <td>{formatDate(i.dueDate)}{(i.status === 'unpaid' || i.status === 'part_paid') && i.dueDate < today && <div className="cell-sub" style={{ color: 'var(--danger)' }}>Overdue</div>}</td>
              <td><Tag tone={INVOICE_TONE[i.status]}>{INVOICE_LABEL[i.status]}</Tag></td>
              <td><button className="btn btn-ghost btn-xs" title="Print" onClick={() => printInvoice(i, cust(i.customerId))}><i className="fa-solid fa-print" /></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function Payments() {
  const db = useRms();
  const persona = usePersona();
  const toast = useToast();
  const rows = [...db.payments].reverse();
  const cust = (id: string) => db.customers.find(c => c.id === id);

  // Demonstrates the callback safeguards: replays are acknowledged but not
  // re-posted; a tampered payload fails the signature check.
  function replay(p: Payment, tamper: boolean) {
    const cb = JSON.parse(p.rawCallback) as d.RemitaCallback;
    if (tamper) cb.amountKobo += 100000;
    try {
      const r = tx(dbx => d.processRemitaCallback(dbx, cb));
      toast(r.result === 'duplicate' ? `Duplicate callback for ${p.receiptNo} acknowledged — nothing posted twice` : 'Posted', 'info');
    } catch (err) {
      if (tamper) tx(dbx => { dbx.callbacks.push({ at: d.nowIso(), rrr: cb.rrr, remitaRef: cb.remitaRef, result: 'rejected', detail: (err as Error).message }); });
      toast((err as Error).message, 'error');
    }
  }

  return (
    <div className="tab-body">
      {rows.length === 0 ? <Empty icon="fa-money-bill-transfer" title="No payments yet" /> : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Receipt</th><th>Customer</th><th>Amount</th><th>Channel</th><th>RRR / Remita ref</th><th>Paid</th><th /></tr></thead>
          <tbody>{rows.map(p => {
            const inv = db.invoices.find(i => i.id === p.invoiceId);
            return (
              <tr key={p.id}>
                <td><strong>{p.receiptNo}</strong><div className="cell-sub">{inv?.invoiceNo}</div></td>
                <td>{cust(p.customerId)?.name}</td>
                <td><strong>{naira(p.amountKobo)}</strong></td>
                <td>{p.channel}{p.verified && <div className="cell-sub"><i className="fa-solid fa-circle-check" style={{ color: 'var(--success)' }} /> verified</div>}</td>
                <td className="mono" style={{ fontSize: 11 }}>{formatRrr(p.rrr)}<div className="cell-sub">{p.remitaRef}</div></td>
                <td>{new Date(p.paidAt).toLocaleString('en-NG')}</td>
                <td><div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <button className="btn btn-ghost btn-xs" title="Print receipt" onClick={() => printReceipt(p, inv, cust(p.customerId))}><i className="fa-solid fa-print" /></button>
                  {persona.role === 'finance' && <>
                    <button className="btn btn-ghost btn-xs" title="Send the same Remita callback again" onClick={() => replay(p, false)}>Replay</button>
                    <button className="btn btn-ghost btn-xs" title="Send a callback with a changed amount but the old signature" onClick={() => replay(p, true)}>Tamper</button>
                  </>}
                </div></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {persona.role === 'finance' && <p className="cell-sub" style={{ marginTop: 10 }}>Replay and Tamper test the Remita webhook safeguards: a repeated callback is acknowledged but never posted twice, and a changed payload fails signature verification.</p>}
    </div>
  );
}

function Callbacks() {
  const db = useRms();
  const rows = [...db.callbacks].reverse();
  return (
    <div className="tab-body">
      {rows.length === 0 ? <Empty icon="fa-satellite-dish" title="No callbacks received" /> : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Received</th><th>RRR</th><th>Remita ref</th><th>Result</th><th>Detail</th></tr></thead>
          <tbody>{rows.map((c, i) => (
            <tr key={i}><td>{new Date(c.at).toLocaleString('en-NG')}</td><td className="mono">{formatRrr(c.rrr)}</td><td className="mono" style={{ fontSize: 11 }}>{c.remitaRef}</td>
              <td><Tag tone={c.result === 'posted' ? 'green' : c.result === 'duplicate' ? 'warn' : 'red'}>{c.result}</Tag></td><td className="cell-sub">{c.detail}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function Customers() {
  const db = useRms();
  const persona = usePersona();
  const run = useRmsAction();
  return (
    <div className="tab-body">
      {db.customers.length === 0 ? <Empty icon="fa-users" title="No customers registered" /> : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Customer</th><th>Type</th><th>NIN / RC</th><th>Contact</th><th>Applications</th><th>Paid</th><th>KYC</th></tr></thead>
          <tbody>{db.customers.map(c => (
            <tr key={c.id}>
              <td><strong>{c.name}</strong><div className="cell-sub">{c.customerNo} · since {formatDate(c.createdAt)}</div></td>
              <td>{c.type}</td><td className="mono">{c.idNumber}</td>
              <td style={{ fontSize: 12 }}>{c.email}<div className="cell-sub">{c.phone}</div></td>
              <td>{db.applications.filter(a => a.customerId === c.id && a.status !== 'withdrawn').length}</td>
              <td>{naira(db.payments.filter(p => p.customerId === c.id).reduce((t, p) => t + p.amountKobo, 0))}</td>
              <td>{c.kycStatus === 'verified' ? <Tag tone="green">Verified</Tag> : persona.role === 'revenue'
                ? <button className="btn btn-secondary btn-xs" onClick={() => run(dbx => { d.verifyKyc(dbx, persona, c.id); return true; }, `${c.name} verified`)}>Verify KYC</button>
                : <Tag tone="warn">Pending</Tag>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="cell-sub" style={{ marginTop: 10 }}>Public customers have their own sign-in, separate from staff accounts. Customer identity data is visible only to staff.</p>
    </div>
  );
}

function Fees() {
  const db = useRms();
  const persona = usePersona();
  const [editing, setEditing] = useState<FeeSchedule | null>(null);
  const codes = [...new Set(db.feeSchedules.map(f => f.code))];
  return (
    <div className="tab-body">
      {codes.map(code => {
        const versions = db.feeSchedules.filter(f => f.code === code).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        let current: FeeSchedule | undefined;
        try { current = d.activeFee(db, code); } catch { /* none */ }
        return (
          <div key={code} style={{ marginBottom: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div><strong>{versions[0].description}</strong> <span className="id-cell" style={{ maxWidth: 'none' }}>{code}</span></div>
              {persona.role === 'finance' && current && <button className="btn btn-ghost btn-xs" onClick={() => setEditing(current!)}>New version</button>}
            </div>
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th>Amount</th><th>Effective from</th><th>Effective to</th><th>Legal reference</th><th /></tr></thead>
              <tbody>{versions.map(f => (
                <tr key={f.id}><td><strong>{naira(f.amountKobo)}</strong></td><td>{formatDate(f.effectiveFrom)}</td><td>{f.effectiveTo ? formatDate(f.effectiveTo) : '—'}</td>
                  <td className="cell-sub" style={{ fontSize: 11 }}>{f.legalReference}</td><td>{f.id === current?.id && <Tag tone="green">In force</Tag>}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        );
      })}
      <p className="cell-sub">Fee versions are never edited: a change adds a new version with its own start date and legal reference. All amounts are placeholders until FPAM confirms the approved fee schedule.</p>
      {editing && <FeeModal fee={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FeeModal({ fee, onClose }: { fee: FeeSchedule; onClose: () => void }) {
  const persona = usePersona();
  const run = useRmsAction();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ amount: String(fee.amountKobo / 100), ref: '', from: tomorrow });
  return (
    <Modal title={`New version — ${fee.description}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={() => { if (run(db => { d.newFeeVersion(db, persona, fee.code, toKobo(f.amount), f.ref, f.from); return true; }, 'Fee version added')) onClose(); }}>Add version</button>
    </>}>
      <div className="form-grid">
        <div><label className="form-label">Amount (₦)</label><input className="form-control" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></div>
        <div><label className="form-label">Effective from</label><input className="form-control" type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
        <div className="full"><label className="form-label">Legal / administrative reference</label><input className="form-control" value={f.ref} onChange={e => setF({ ...f, ref: e.target.value })} placeholder="e.g. FMHUD Circular REV/2026/03" /></div>
      </div>
      <p className="cell-sub" style={{ marginTop: 8 }}>Current: {naira(fee.amountKobo)} since {formatDate(fee.effectiveFrom)}. Bills already issued keep the old amount.</p>
    </Modal>
  );
}
