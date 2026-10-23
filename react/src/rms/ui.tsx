import { useCallback, type ReactNode } from 'react';
import { Tag } from '../components/Tags';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/assets';
import { tx, resetDemoData } from './store';
import { PERSONAS, setPersona, usePersona } from './personas';
import { ROLE_LABEL } from './domain';
import { formatRrr, naira } from './format';
import type { Customer, Invoice, Payment, RmsDb } from './types';

/** Run a domain change; toast the result. Returns the value, or undefined on error. */
export function useRmsAction() {
  const toast = useToast();
  return useCallback(<T,>(fn: (db: RmsDb) => T, success?: string | ((v: T) => string)): T | undefined => {
    try {
      const v = tx(fn);
      if (success) toast(typeof success === 'function' ? success(v) : success);
      return v;
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
      return undefined;
    }
  }, [toast]);
}

export function DemoBadge() {
  return <Tag tone="warn" title="Phase-one prototype: all revenue data is kept in this browser's local storage. Nothing is sent to the server."><i className="fa-solid fa-flask" /> Demo · stored in this browser</Tag>;
}

/** Page header for staff RMS pages, with the "acting as" persona switcher. */
export function RmsHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  const persona = usePersona();
  const toast = useToast();
  return (
    <>
      <div className="rms-persona card">
        <div className="row" style={{ gap: 10 }}>
          <i className="fa-solid fa-user-tie" style={{ color: 'var(--accent)' }} />
          <label htmlFor="rms-persona" className="rms-persona-label">Acting as</label>
          <select id="rms-persona" className="filter-input" value={persona.id} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name} — {ROLE_LABEL[p.role]}</option>)}
          </select>
        </div>
        <div className="row">
          <DemoBadge />
          <button className="btn btn-ghost btn-xs" onClick={() => {
            if (!confirm('Reset all revenue demo data in this browser? Everything you added is lost.')) return;
            resetDemoData(); toast('Demo data reset');
          }}><i className="fa-solid fa-rotate-left" /> Reset demo data</button>
        </div>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {sub && <div className="page-sub">{sub}</div>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </header>
    </>
  );
}

export const Money = ({ kobo, strong }: { kobo?: number; strong?: boolean }) =>
  strong ? <strong className="money">{naira(kobo)}</strong> : <span className="money">{naira(kobo)}</span>;

export function Empty({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><i className={`fa-solid ${icon}`} /></div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  );
}

// ── Printable documents ──────────────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function printHtml(title: string, body: string) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) { alert('Allow pop-ups to print this document.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#1c2b39;margin:40px;font-size:13px}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0B2545;padding-bottom:12px;margin-bottom:22px}
    .org{font-weight:800;color:#0B2545;font-size:15px}.sub{color:#5A6A7A;font-size:11px}
    h1{font-size:20px;color:#0B2545;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:14px 0}
    th,td{border:1px solid #d5dde5;padding:7px 9px;text-align:left}th{background:#F4F6F9;font-size:11px;text-transform:uppercase}
    .r{text-align:right}.tot td{font-weight:800}.meta td{border:none;padding:3px 0}.meta td:first-child{color:#5A6A7A;width:170px}
    .stamp{display:inline-block;border:2px solid #0f7a4d;color:#0f7a4d;padding:4px 12px;font-weight:800;transform:rotate(-4deg);margin-top:10px}
    .demo{margin-top:30px;padding:8px 10px;background:#fff6db;border:1px solid #f0d58a;font-size:11px}
    .sig{margin-top:40px;display:flex;gap:60px}.sig div{border-top:1px solid #1c2b39;padding-top:4px;width:200px;font-size:11px}
  </style></head><body>
    <div class="hd"><div><div class="org">Federal Public Assets Maintenance Department</div><div class="sub">Federal Ministry of Housing and Urban Development · Revenue Management System</div></div>
    <div class="sub">Printed ${esc(new Date().toLocaleString('en-NG'))}</div></div>
    ${body}
    <div class="demo">PROTOTYPE DOCUMENT — generated by the phase-one demo. Not a valid receipt, invoice or offer.</div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export function printInvoice(inv: Invoice, customer?: Customer) {
  printHtml(`Invoice ${inv.invoiceNo}`, `
    <h1>${inv.ref.type === 'award' ? 'Demand notice' : 'Invoice'} ${esc(inv.invoiceNo)}</h1>
    <table class="meta"><tr><td>Billed to</td><td>${esc(customer?.name)} (${esc(customer?.customerNo)})</td></tr>
      <tr><td>Remita RRR</td><td><strong>${esc(formatRrr(inv.rrr))}</strong></td></tr>
      <tr><td>Issued</td><td>${esc(formatDate(inv.issuedAt))}</td></tr><tr><td>Due</td><td>${esc(formatDate(inv.dueDate))}</td></tr></table>
    <table><tr><th>Code</th><th>Description</th><th class="r">Amount</th></tr>
      ${inv.lines.map(l => `<tr><td>${esc(l.code)}</td><td>${esc(l.description)}</td><td class="r">${esc(naira(l.amountKobo, { decimals: true }))}</td></tr>`).join('')}
      <tr class="tot"><td colspan="2">Total</td><td class="r">${esc(naira(inv.totalKobo, { decimals: true }))}</td></tr>
      <tr><td colspan="2">Paid</td><td class="r">${esc(naira(inv.paidKobo, { decimals: true }))}</td></tr>
      <tr class="tot"><td colspan="2">Balance</td><td class="r">${esc(naira(inv.totalKobo - inv.paidKobo, { decimals: true }))}</td></tr></table>
    <p>Pay with the RRR above on Remita (card, bank transfer, USSD) or at any bank branch. Payments go to the Consolidated Revenue Fund via the TSA.</p>`);
}

export function printReceipt(p: Payment, inv?: Invoice, customer?: Customer) {
  printHtml(`Receipt ${p.receiptNo}`, `
    <h1>Official receipt ${esc(p.receiptNo)}</h1>
    <table class="meta"><tr><td>Received from</td><td>${esc(customer?.name)} (${esc(customer?.customerNo)})</td></tr>
      <tr><td>Amount</td><td><strong>${esc(naira(p.amountKobo, { decimals: true }))}</strong></td></tr>
      <tr><td>For</td><td>${esc(inv?.lines.map(l => l.description).join('; '))}</td></tr>
      <tr><td>Invoice</td><td>${esc(inv?.invoiceNo)}</td></tr><tr><td>Remita RRR</td><td>${esc(formatRrr(p.rrr))}</td></tr>
      <tr><td>Remita reference</td><td>${esc(p.remitaRef)}</td></tr><tr><td>Channel</td><td>${esc(p.channel)}</td></tr>
      <tr><td>Date</td><td>${esc(new Date(p.paidAt).toLocaleString('en-NG'))}</td></tr></table>
    <div class="stamp">PAID · VERIFIED WITH REMITA</div>`);
}

export function printOfferLetter(o: { offerNo: string; approvedAt: string; approvedBy: string; amountKobo: number; mode: string; title: string; assetCode: string; address: string; leaseYears?: number; customer?: Customer }) {
  const what = o.mode === 'lease' ? `a lease of the property for ${o.leaseYears || 1} year(s) at an annual rent of` : `the ${o.mode === 'auction' ? 'winning bid for' : 'purchase of'} the asset at`;
  printHtml(`Offer ${o.offerNo}`, `
    <h1>Letter of offer ${esc(o.offerNo)}</h1>
    <p>${esc(formatDate(o.approvedAt))}</p>
    <p>${esc(o.customer?.name)}<br>${esc(o.customer?.address)}</p>
    <p>Dear Sir/Madam,</p>
    <p><strong>RE: ${esc(o.title)} (${esc(o.assetCode)})</strong></p>
    <p>Following the evaluation of applications and the approval of the Approval Committee, we are pleased to offer you ${what} <strong>${esc(naira(o.amountKobo))}</strong>, located at ${esc(o.address)}.</p>
    <p>To accept, sign in to the FPAM customer portal and click <em>Accept offer</em>. A demand notice with a Remita RRR will be issued for the amount above plus the documentation fee, payable within 30 days. The offer lapses if not accepted within 14 days.</p>
    <div class="sig"><div>For: Director, FPAM<br>(approved by ${esc(o.approvedBy)})</div><div>Accepted by applicant</div></div>`);
}
