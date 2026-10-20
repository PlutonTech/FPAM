// RMS phase one — business rules. Every function takes the database draft
// from tx() and mutates it; throwing aborts the whole change.
import { sha256 } from './sha256';
import type {
  Application, Award, Contract, Customer, Invoice, InvoiceLine, LedgerEntry, Listing, ListingMode,
  PayChannel, Payment, RevenueStatus, RmsDb, Valuation, ValuationMethod,
} from './types';
import { MANUAL_STATUSES, MODE_FOR_STATUS, REVENUE_STATUS } from './format';

// ── Staff identity ────────────────────────────────────────────────────────────
export type StaffRole = 'revenue' | 'valuer' | 'committee' | 'finance' | 'auditor';
export interface Actor { name: string; role: StaffRole }
export const ROLE_LABEL: Record<StaffRole, string> = {
  revenue: 'Revenue Officer', valuer: 'Valuer', committee: 'Approval Committee', finance: 'Finance / Reconciliation', auditor: 'Auditor (read-only)',
};
function requireRole(actor: Actor, ...roles: StaffRole[]) {
  if (!roles.includes(actor.role)) throw new Error(`Only ${roles.map(r => ROLE_LABEL[r]).join(' or ')} can do this`);
}

// ── Chart of accounts ─────────────────────────────────────────────────────────
export const ACCOUNTS: Record<string, string> = {
  '1000': 'Remita / TSA collections',
  '1100': 'Customer receivables',
  '4100': 'Revenue — asset sales',
  '4200': 'Revenue — auctions',
  '4300': 'Revenue — leases & rentals',
  '4400': 'Revenue — transaction fees',
  '4500': 'Revenue — penalties',
};
const REVENUE_ACCOUNT: Record<ListingMode, string> = { sale: '4100', auction: '4200', lease: '4300' };

// ── Small helpers ─────────────────────────────────────────────────────────────
export const nowIso = () => new Date().toISOString();
const addDays = (days: number, from = new Date()) => new Date(from.getTime() + days * 86400000).toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

function nextNo(db: RmsDb, key: string, prefix: string, pad = 4) {
  db.counters[key] = (db.counters[key] || 0) + 1;
  return `${prefix}-${new Date().getFullYear()}-${String(db.counters[key]).padStart(pad, '0')}`;
}

function audit(db: RmsDb, actor: string, action: string, entity: string, entityId: string, detail = '') {
  db.audit.push({ id: uid(), at: nowIso(), actor, action, entity, entityId, detail });
}

function find<T extends { id: string }>(list: T[], id: string, what: string): T {
  const item = list.find(x => x.id === id);
  if (!item) throw new Error(`${what} not found`);
  return item;
}

function setStatus(db: RmsDb, assetId: string, status: RevenueStatus, by: string, note?: string) {
  const a = find(db.assets, assetId, 'Asset');
  if (a.revenueStatus === status) return;
  a.revenueStatus = status;
  a.statusHistory.push({ status, at: nowIso(), by, note });
  audit(db, by, 'REVENUE_STATUS', 'Asset', a.assetCode, `→ ${REVENUE_STATUS[status].label}${note ? ` (${note})` : ''}`);
}

export const passwordHash = (email: string, password: string) => sha256(`fpam-rms:${email.toLowerCase()}:${password}`);

/** The fee in force today for a fee code (fee schedules are versioned, never edited). */
export function activeFee(db: RmsDb, code: string, at = nowIso()) {
  const fee = db.feeSchedules
    .filter(f => f.code === code && f.effectiveFrom <= at && (!f.effectiveTo || f.effectiveTo > at))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!fee) throw new Error(`No fee in force for ${code}`);
  return fee;
}

/** Current, approved, unexpired valuation of an asset. */
export function currentValuation(db: RmsDb, assetId: string): Valuation | undefined {
  const a = db.assets.find(x => x.id === assetId);
  const v = a?.currentValuationId ? db.valuations.find(x => x.id === a.currentValuationId) : undefined;
  return v && v.status === 'approved' && v.validUntil >= nowIso().slice(0, 10) ? v : undefined;
}

export const activeListingFor = (db: RmsDb, assetId: string) =>
  db.listings.find(l => l.assetId === assetId && (l.status === 'open' || l.status === 'closed'));

/** Bids stay sealed (amounts hidden from staff) until the closing date has passed. */
export const isSealed = (l: Listing) => l.status === 'open' && new Date(l.closeDate).getTime() > Date.now();

// ── Ledger (double-entry, append-only, hash-chained) ─────────────────────────
interface PostLine { account: string; debitKobo?: number; creditKobo?: number }

function entryHashInput(e: Omit<LedgerEntry, 'hash'>) {
  return [e.seq, e.txnId, e.account, e.debitKobo, e.creditKobo, e.refType, e.refId, e.memo, e.postedAt, e.prevHash].join('|');
}

function post(db: RmsDb, refType: string, refId: string, memo: string, lines: PostLine[]) {
  const debit = lines.reduce((s, l) => s + (l.debitKobo || 0), 0);
  const credit = lines.reduce((s, l) => s + (l.creditKobo || 0), 0);
  if (!lines.every(l => Number.isInteger(l.debitKobo || 0) && Number.isInteger(l.creditKobo || 0))) throw new Error('Ledger amounts must be whole kobo');
  if (debit !== credit || debit <= 0) throw new Error(`Unbalanced posting (${debit} ≠ ${credit})`);
  const txnId = 'TXN-' + uid().slice(0, 8).toUpperCase();
  const postedAt = nowIso();
  for (const l of lines) {
    const prev = db.ledger[db.ledger.length - 1];
    const base = {
      seq: (prev?.seq || 0) + 1, txnId, account: l.account, debitKobo: l.debitKobo || 0, creditKobo: l.creditKobo || 0,
      refType, refId, memo, postedAt, prevHash: prev?.hash || 'GENESIS',
    };
    db.ledger.push({ ...base, hash: sha256(entryHashInput(base)) });
  }
  return txnId;
}

/** Recompute the chain. Any edited, removed or reordered entry breaks it. */
export function verifyLedger(db: RmsDb): { ok: boolean; count: number; brokenAt?: number; reason?: string } {
  let prevHash = 'GENESIS';
  for (let i = 0; i < db.ledger.length; i++) {
    const e = db.ledger[i];
    if (e.seq !== i + 1) return { ok: false, count: db.ledger.length, brokenAt: i + 1, reason: 'sequence gap' };
    if (e.prevHash !== prevHash) return { ok: false, count: db.ledger.length, brokenAt: e.seq, reason: 'previous-hash mismatch' };
    const { hash, ...rest } = e;
    if (sha256(entryHashInput(rest)) !== hash) return { ok: false, count: db.ledger.length, brokenAt: e.seq, reason: 'entry contents changed' };
    prevHash = hash;
  }
  const byTxn = new Map<string, number>();
  db.ledger.forEach(e => byTxn.set(e.txnId, (byTxn.get(e.txnId) || 0) + e.debitKobo - e.creditKobo));
  const unbalanced = [...byTxn.entries()].find(([, v]) => v !== 0);
  if (unbalanced) return { ok: false, count: db.ledger.length, reason: `transaction ${unbalanced[0]} does not balance` };
  return { ok: true, count: db.ledger.length };
}

export function trialBalance(db: RmsDb) {
  const m = new Map<string, { debit: number; credit: number }>();
  db.ledger.forEach(e => {
    const t = m.get(e.account) || { debit: 0, credit: 0 };
    t.debit += e.debitKobo; t.credit += e.creditKobo; m.set(e.account, t);
  });
  return Object.keys(ACCOUNTS).filter(a => m.has(a)).map(account => ({ account, name: ACCOUNTS[account], ...m.get(account)! }));
}

// ── Invoices & Remita ────────────────────────────────────────────────────────
function genRrr(db: RmsDb) {
  for (;;) {
    const rrr = '2804' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    if (!db.invoices.some(i => i.rrr === rrr)) return rrr;
  }
}

function raiseInvoice(db: RmsDb, raisedBy: string, customerId: string, ref: Invoice['ref'], lines: InvoiceLine[], dueDays: number): Invoice {
  const total = lines.reduce((s, l) => s + l.amountKobo, 0);
  const inv: Invoice = {
    id: uid(), invoiceNo: nextNo(db, 'invoice', 'INV', 5), customerId, ref, lines, totalKobo: total, paidKobo: 0,
    rrr: genRrr(db), issuedAt: nowIso(), dueDate: addDays(dueDays).slice(0, 10), status: 'unpaid', raisedBy,
  };
  db.invoices.push(inv);
  post(db, 'invoice', inv.invoiceNo, `Invoice ${inv.invoiceNo} raised`, [
    { account: '1100', debitKobo: total },
    ...lines.map(l => ({ account: l.account, creditKobo: l.amountKobo })),
  ]);
  audit(db, raisedBy, 'INVOICE_RAISED', 'Invoice', inv.invoiceNo, `RRR ${inv.rrr}, ${total / 100} NGN`);
  return inv;
}

/** Cancel an unpaid invoice by reversal entries — the original entries are never touched. */
function cancelInvoice(db: RmsDb, by: string, inv: Invoice, reason: string) {
  if (inv.status !== 'unpaid') throw new Error('Only unpaid invoices can be cancelled');
  inv.status = 'cancelled';
  post(db, 'invoice-reversal', inv.invoiceNo, `Reversal of ${inv.invoiceNo}: ${reason}`, [
    ...inv.lines.map(l => ({ account: l.account, debitKobo: l.amountKobo })),
    { account: '1100', creditKobo: inv.totalKobo },
  ]);
  audit(db, by, 'INVOICE_CANCELLED', 'Invoice', inv.invoiceNo, reason);
}

// Stand-in for the shared secret Remita signs callbacks with.
const REMITA_SECRET = 'demo-remita-shared-secret';
export const signCallback = (rrr: string, amountKobo: number, remitaRef: string) =>
  sha256(`${REMITA_SECRET}|${rrr}|${amountKobo}|${remitaRef}`).slice(0, 40);

export interface RemitaCallback { rrr: string; amountKobo: number; channel: PayChannel; remitaRef: string; signature: string }

/**
 * Remita notification handler: verify signature → re-check the RRR against our
 * invoice ("status re-query") → post payment + ledger in one transaction.
 * Idempotent: the same remitaRef is acknowledged but never posted twice.
 */
export function processRemitaCallback(db: RmsDb, cb: RemitaCallback): { result: 'posted' | 'duplicate'; payment: Payment } {
  const log = (result: 'posted' | 'duplicate' | 'rejected', detail: string) =>
    db.callbacks.push({ at: nowIso(), rrr: cb.rrr, remitaRef: cb.remitaRef, result, detail });

  if (signCallback(cb.rrr, cb.amountKobo, cb.remitaRef) !== cb.signature) throw new Error('Callback signature invalid — rejected');
  const existing = db.payments.find(p => p.remitaRef === cb.remitaRef);
  if (existing) { log('duplicate', `Already posted as ${existing.receiptNo}; acknowledged, not re-posted`); return { result: 'duplicate', payment: existing }; }
  const inv = db.invoices.find(i => i.rrr === cb.rrr);
  if (!inv) throw new Error(`No invoice carries RRR ${cb.rrr}`);
  if (inv.status === 'cancelled') throw new Error(`Invoice ${inv.invoiceNo} was cancelled`);
  const outstanding = inv.totalKobo - inv.paidKobo;
  if (cb.amountKobo <= 0 || cb.amountKobo > outstanding) throw new Error(`Amount does not match the outstanding balance on ${inv.invoiceNo}`);

  const payment: Payment = {
    id: uid(), receiptNo: nextNo(db, 'receipt', 'RCT', 6), rrr: cb.rrr, invoiceId: inv.id, customerId: inv.customerId,
    amountKobo: cb.amountKobo, channel: cb.channel, remitaRef: cb.remitaRef, paidAt: nowIso(), verified: true,
    rawCallback: JSON.stringify(cb),
  };
  db.payments.push(payment);
  inv.paidKobo += cb.amountKobo;
  inv.status = inv.paidKobo >= inv.totalKobo ? 'paid' : 'part_paid';
  post(db, 'payment', payment.receiptNo, `Remita payment ${cb.remitaRef} for ${inv.invoiceNo}`, [
    { account: '1000', debitKobo: cb.amountKobo },
    { account: '1100', creditKobo: cb.amountKobo },
  ]);
  audit(db, 'Remita', 'PAYMENT_POSTED', 'Payment', payment.receiptNo, `RRR ${cb.rrr} via ${cb.channel}`);
  log('posted', `Posted as ${payment.receiptNo}`);
  if (inv.status === 'paid') onInvoicePaid(db, inv);
  return { result: 'posted', payment };
}

/** Simulates the customer paying on Remita and Remita calling us back. */
export function simulateRemitaPayment(db: RmsDb, customerId: string, invoiceId: string, channel: PayChannel) {
  const inv = find(db.invoices, invoiceId, 'Invoice');
  if (inv.customerId !== customerId) throw new Error('This bill belongs to another customer');
  if (inv.status === 'paid') throw new Error('This bill is already paid');
  const amountKobo = inv.totalKobo - inv.paidKobo;
  const remitaRef = 'RMT' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1e4);
  const cb: RemitaCallback = { rrr: inv.rrr, amountKobo, channel, remitaRef, signature: signCallback(inv.rrr, amountKobo, remitaRef) };
  return processRemitaCallback(db, cb);
}

function onInvoicePaid(db: RmsDb, inv: Invoice) {
  if (inv.ref.type === 'application') {
    const app = find(db.applications, inv.ref.id, 'Application');
    if (app.status === 'awaiting_fee') { app.status = 'submitted'; app.submittedAt = nowIso(); }
    audit(db, 'System', 'APPLICATION_SUBMITTED', 'Application', app.applicationNo, 'Fee paid; application is now in the evaluation queue');
    return;
  }
  const award = find(db.awards, inv.ref.id, 'Award');
  const listing = find(db.listings, award.listingId, 'Listing');
  const asset = find(db.assets, listing.assetId, 'Asset');
  award.status = 'completed';
  const contract: Contract = {
    id: uid(), contractNo: nextNo(db, 'contract', listing.mode === 'lease' ? 'LSE' : 'OTR'),
    type: listing.mode === 'lease' ? 'lease' : 'sale', assetId: asset.id, customerId: award.customerId, awardId: award.id,
    amountKobo: award.amountKobo, startDate: nowIso().slice(0, 10),
    endDate: listing.mode === 'lease' ? addDays(365 * (listing.leaseYears || 1)).slice(0, 10) : undefined, createdAt: nowIso(),
  };
  db.contracts.push(contract);
  asset.currentContractId = contract.id;
  setStatus(db, asset.id, listing.mode === 'lease' ? 'leased' : 'sold', 'System',
    listing.mode === 'lease' ? `Lease ${contract.contractNo}` : `Ownership transfer ${contract.contractNo}`);
  audit(db, 'System', listing.mode === 'lease' ? 'LEASE_RECORDED' : 'OWNERSHIP_TRANSFERRED', 'Contract', contract.contractNo, asset.assetCode);
}

// ── 4.3 Asset revenue interface ───────────────────────────────────────────────
export function setRevenueStatus(db: RmsDb, actor: Actor, assetId: string, status: RevenueStatus, note: string) {
  requireRole(actor, 'revenue');
  const a = find(db.assets, assetId, 'Asset');
  if (!MANUAL_STATUSES.includes(status)) throw new Error('That status is set by the workflow, not by hand');
  if (!MANUAL_STATUSES.includes(a.revenueStatus)) throw new Error(`${REVENUE_STATUS[a.revenueStatus].label} assets can't be changed by hand${a.revenueStatus === 'sold' || a.revenueStatus === 'disposed' ? ' — disposal is irreversible' : ''}`);
  if (activeListingFor(db, a.id)) throw new Error('This asset has an active listing — cancel or complete it first');
  setStatus(db, a.id, status, actor.name, note || undefined);
}

// ── 4.5 Valuation ────────────────────────────────────────────────────────────
export function createValuation(db: RmsDb, actor: Actor, v: { assetId: string; method: ValuationMethod; valueKobo: number; annualRentKobo: number; notes: string; validUntil: string }) {
  requireRole(actor, 'valuer');
  find(db.assets, v.assetId, 'Asset');
  if (!(v.valueKobo > 0)) throw new Error('Enter the market value');
  if (!(v.annualRentKobo >= 0)) throw new Error('Enter the market rent (0 if the asset cannot be let)');
  if (v.validUntil <= nowIso().slice(0, 10)) throw new Error('"Valid until" must be in the future');
  const val: Valuation = { id: uid(), valuationNo: nextNo(db, 'valuation', 'VAL'), ...v, valuer: actor.name, status: 'draft', createdAt: nowIso() };
  db.valuations.push(val);
  audit(db, actor.name, 'VALUATION_CREATED', 'Valuation', val.valuationNo, `${v.method}, ${v.valueKobo / 100} NGN`);
  return val;
}

export function decideValuation(db: RmsDb, actor: Actor, id: string, approve: boolean, reason = '') {
  requireRole(actor, 'committee');
  const v = find(db.valuations, id, 'Valuation');
  if (v.status !== 'draft') throw new Error('Approved and rejected valuations are final');
  if (v.valuer === actor.name) throw new Error('Segregation of duties: you cannot approve your own valuation');
  if (!approve && !reason.trim()) throw new Error('Give a reason for rejecting');
  v.status = approve ? 'approved' : 'rejected';
  v.approvedBy = actor.name; v.decidedAt = nowIso();
  if (!approve) v.rejectReason = reason;
  if (approve) find(db.assets, v.assetId, 'Asset').currentValuationId = v.id;
  audit(db, actor.name, approve ? 'VALUATION_APPROVED' : 'VALUATION_REJECTED', 'Valuation', v.valuationNo, reason);
}

// ── 4.4 Listings ─────────────────────────────────────────────────────────────
export function createListing(db: RmsDb, actor: Actor, l: { assetId: string; title: string; description: string; reservePriceKobo: number; leaseYears?: number; closeDate: string }) {
  requireRole(actor, 'revenue');
  const asset = find(db.assets, l.assetId, 'Asset');
  const mode = MODE_FOR_STATUS[asset.revenueStatus];
  if (!mode) throw new Error('Mark the asset as available for sale, lease or auction first');
  if (activeListingFor(db, asset.id)) throw new Error('This asset already has an active listing');
  const val = currentValuation(db, asset.id);
  if (!val) throw new Error('The asset needs an approved, unexpired valuation before it can be listed');
  const floor = mode === 'lease' ? val.annualRentKobo : val.valueKobo;
  if (mode === 'lease' && !floor) throw new Error('The approved valuation has no market rent, so the asset cannot be leased');
  if (!(l.reservePriceKobo >= floor)) throw new Error(`The ${mode === 'lease' ? 'rent' : 'price'} can't be below the approved valuation (₦${(floor / 100).toLocaleString('en-NG')})`);
  if (new Date(l.closeDate).getTime() <= Date.now()) throw new Error('The closing date must be in the future');
  if (!l.title.trim()) throw new Error('Give the listing a title');
  const listing: Listing = {
    id: uid(), listingNo: nextNo(db, 'listing', 'LST'), assetId: asset.id, mode, title: l.title.trim(), description: l.description.trim(),
    reservePriceKobo: l.reservePriceKobo, leaseYears: mode === 'lease' ? Math.max(1, l.leaseYears || 1) : undefined,
    openDate: nowIso(), closeDate: l.closeDate, status: 'open', valuationId: val.id, createdBy: actor.name, createdAt: nowIso(),
  };
  db.listings.push(listing);
  audit(db, actor.name, 'LISTING_PUBLISHED', 'Listing', listing.listingNo, `${asset.assetCode} for ${mode}`);
  return listing;
}

export function cancelListing(db: RmsDb, actor: Actor, id: string, reason: string) {
  requireRole(actor, 'revenue');
  const l = find(db.listings, id, 'Listing');
  if (l.status !== 'open' && l.status !== 'closed') throw new Error('Only open or closed listings can be cancelled');
  if (!reason.trim()) throw new Error('Give a reason');
  for (const app of db.applications.filter(a => a.listingId === l.id && ['awaiting_fee', 'submitted', 'recommended'].includes(a.status))) {
    const inv = db.invoices.find(i => i.id === app.feeInvoiceId);
    if (inv?.status === 'unpaid') cancelInvoice(db, actor.name, inv, 'Listing cancelled');
    app.status = 'withdrawn';
  }
  l.status = 'cancelled';
  audit(db, actor.name, 'LISTING_CANCELLED', 'Listing', l.listingNo, reason);
}

/** After the closing date: reveal bids for evaluation. Unpaid applications lapse. */
export function closeListing(db: RmsDb, actor: Actor, id: string) {
  requireRole(actor, 'revenue');
  const l = find(db.listings, id, 'Listing');
  if (l.status !== 'open') throw new Error('Listing is not open');
  if (isSealed(l)) throw new Error('Bids are sealed until the closing date');
  for (const app of db.applications.filter(a => a.listingId === l.id && a.status === 'awaiting_fee')) {
    const inv = db.invoices.find(i => i.id === app.feeInvoiceId);
    if (inv?.status === 'unpaid') cancelInvoice(db, actor.name, inv, 'Fee not paid before closing date');
    app.status = 'withdrawn';
  }
  l.status = 'closed';
  audit(db, actor.name, 'LISTING_CLOSED', 'Listing', l.listingNo, 'Bids opened for evaluation');
}

// ── Public customers ─────────────────────────────────────────────────────────
export function registerCustomer(db: RmsDb, c: { type: Customer['type']; name: string; idNumber: string; email: string; phone: string; address: string; password: string }) {
  const email = c.email.trim().toLowerCase();
  if (!c.name.trim() || !email || !c.phone.trim() || !c.idNumber.trim()) throw new Error('Fill in all required fields');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address');
  if (c.type === 'individual' && !/^\d{11}$/.test(c.idNumber.trim())) throw new Error('NIN must be 11 digits');
  if (c.type === 'corporate' && !/^(RC|BN)?\s?\d{4,8}$/i.test(c.idNumber.trim())) throw new Error('Enter a valid RC/BN number (e.g. RC 123456)');
  if (c.password.length < 8) throw new Error('Password must be at least 8 characters');
  if (db.customers.some(x => x.email === email)) throw new Error('An account with this email already exists — sign in instead');
  const customer: Customer = {
    id: uid(), customerNo: nextNo(db, 'customer', 'CUS', 5), type: c.type, name: c.name.trim(), idNumber: c.idNumber.trim().toUpperCase(),
    email, phone: c.phone.trim(), address: c.address.trim(), passwordHash: passwordHash(email, c.password), kycStatus: 'pending', createdAt: nowIso(),
  };
  db.customers.push(customer);
  audit(db, customer.name, 'CUSTOMER_REGISTERED', 'Customer', customer.customerNo, c.type);
  return customer;
}

export function authenticateCustomer(db: RmsDb, email: string, password: string) {
  const e = email.trim().toLowerCase();
  const c = db.customers.find(x => x.email === e);
  if (!c || c.passwordHash !== passwordHash(e, password)) throw new Error('Incorrect email or password');
  return c;
}

export function verifyKyc(db: RmsDb, actor: Actor, customerId: string) {
  requireRole(actor, 'revenue');
  const c = find(db.customers, customerId, 'Customer');
  c.kycStatus = 'verified';
  audit(db, actor.name, 'KYC_VERIFIED', 'Customer', c.customerNo);
}

export function submitApplication(db: RmsDb, customerId: string, a: { listingId: string; amountKobo: number; statement: string; documents: { name: string; size: number }[] }) {
  const customer = find(db.customers, customerId, 'Customer');
  const l = find(db.listings, a.listingId, 'Listing');
  if (l.status !== 'open' || !isSealed(l)) throw new Error('This listing is no longer accepting applications');
  if (db.applications.some(x => x.listingId === l.id && x.customerId === customerId && x.status !== 'withdrawn')) throw new Error('You have already applied for this listing');
  if (!(a.amountKobo >= l.reservePriceKobo)) throw new Error(`Your ${l.mode === 'auction' ? 'bid' : 'offer'} can't be below ₦${(l.reservePriceKobo / 100).toLocaleString('en-NG')}`);
  if (!a.documents.length) throw new Error('Attach at least one supporting document (ID, CAC certificate, etc.)');
  const fee = activeFee(db, l.mode === 'auction' ? 'BID-PART' : 'APP-FORM');
  const app: Application = {
    id: uid(), applicationNo: nextNo(db, 'application', 'APP'), listingId: l.id, customerId, amountKobo: a.amountKobo,
    documents: a.documents, statement: a.statement.trim(), status: 'awaiting_fee', feeInvoiceId: '', submittedAt: nowIso(),
  };
  db.applications.push(app);
  const inv = raiseInvoice(db, 'System', customerId, { type: 'application', id: app.id },
    [{ code: fee.code, description: `${fee.description} — ${l.listingNo}`, amountKobo: fee.amountKobo, account: '4400' }], 3);
  app.feeInvoiceId = inv.id;
  audit(db, customer.name, 'APPLICATION_CREATED', 'Application', app.applicationNo, l.listingNo);
  return { app, invoice: inv };
}

export function withdrawApplication(db: RmsDb, customerId: string, appId: string) {
  const app = find(db.applications, appId, 'Application');
  if (app.customerId !== customerId) throw new Error('Not your application');
  if (!['awaiting_fee', 'submitted'].includes(app.status)) throw new Error('This application can no longer be withdrawn');
  const l = find(db.listings, app.listingId, 'Listing');
  if (l.status !== 'open') throw new Error('Bidding has closed — applications can no longer be withdrawn');
  const inv = db.invoices.find(i => i.id === app.feeInvoiceId);
  if (inv?.status === 'unpaid') cancelInvoice(db, 'System', inv, 'Application withdrawn');
  app.status = 'withdrawn';
  audit(db, find(db.customers, customerId, 'Customer').name, 'APPLICATION_WITHDRAWN', 'Application', app.applicationNo, inv?.status === 'paid' ? 'Fee is non-refundable' : '');
}

// ── 4.6 Evaluation & approval ────────────────────────────────────────────────
export function evaluateApplication(db: RmsDb, actor: Actor, appId: string, score: number, notes: string) {
  requireRole(actor, 'revenue');
  const app = find(db.applications, appId, 'Application');
  const l = find(db.listings, app.listingId, 'Listing');
  if (l.status !== 'closed') throw new Error('Close the listing before evaluating');
  if (!['submitted', 'recommended'].includes(app.status)) throw new Error('Only submitted applications can be evaluated');
  if (!(score >= 0 && score <= 100)) throw new Error('Score must be 0–100');
  app.evaluation = { score, notes: notes.trim(), by: actor.name, at: nowIso() };
  audit(db, actor.name, 'APPLICATION_EVALUATED', 'Application', app.applicationNo, `Score ${score}`);
}

export function recommendApplication(db: RmsDb, actor: Actor, appId: string) {
  requireRole(actor, 'revenue');
  const app = find(db.applications, appId, 'Application');
  const l = find(db.listings, app.listingId, 'Listing');
  if (l.status !== 'closed') throw new Error('Close the listing first');
  if (!app.evaluation) throw new Error('Evaluate the application before recommending it');
  if (app.status !== 'submitted') throw new Error('Only submitted applications can be recommended');
  db.applications.filter(a => a.listingId === l.id && a.status === 'recommended').forEach(a => { a.status = 'submitted'; });
  app.status = 'recommended';
  audit(db, actor.name, 'AWARD_RECOMMENDED', 'Application', app.applicationNo, l.listingNo);
}

export function decideAward(db: RmsDb, actor: Actor, appId: string, approve: boolean, note: string) {
  requireRole(actor, 'committee');
  const app = find(db.applications, appId, 'Application');
  if (app.status !== 'recommended') throw new Error('Only recommended applications reach the committee');
  const l = find(db.listings, app.listingId, 'Listing');
  const val = l.valuationId ? db.valuations.find(v => v.id === l.valuationId) : undefined;
  if (val && val.valuer === actor.name) throw new Error('Segregation of duties: the valuer of this asset cannot approve its award');
  if (app.evaluation?.by === actor.name) throw new Error('Segregation of duties: you evaluated this application');
  if (!approve) {
    if (!note.trim()) throw new Error('Give a reason for sending it back');
    app.status = 'submitted';
    audit(db, actor.name, 'AWARD_REJECTED', 'Application', app.applicationNo, note);
    return;
  }
  const award: Award = {
    id: uid(), offerNo: nextNo(db, 'offer', 'OFR'), listingId: l.id, applicationId: app.id, customerId: app.customerId,
    amountKobo: app.amountKobo, recommendedBy: app.evaluation?.by || '', approvedBy: actor.name, approvedAt: nowIso(), note: note.trim(), status: 'offered',
  };
  db.awards.push(award);
  app.status = 'awarded';
  db.applications.filter(a => a.listingId === l.id && a.id !== app.id && a.status === 'submitted').forEach(a => { a.status = 'not_successful'; });
  l.status = 'awarded';
  setStatus(db, l.assetId, 'under_offer', actor.name, `Offer ${award.offerNo}`);
  audit(db, actor.name, 'AWARD_APPROVED', 'Award', award.offerNo, `${app.applicationNo}, ${app.amountKobo / 100} NGN`);
  return award;
}

// ── Offer acceptance → billing ───────────────────────────────────────────────
export function respondToOffer(db: RmsDb, customerId: string, awardId: string, accept: boolean) {
  const award = find(db.awards, awardId, 'Offer');
  if (award.customerId !== customerId) throw new Error('Not your offer');
  if (award.status !== 'offered') throw new Error('This offer has already been answered');
  const l = find(db.listings, award.listingId, 'Listing');
  const customer = find(db.customers, customerId, 'Customer');
  award.respondedAt = nowIso();
  if (!accept) {
    award.status = 'declined';
    find(db.applications, award.applicationId, 'Application').status = 'not_successful';
    // Back to the committee: the listing reopens for evaluation of the remaining bids.
    db.applications.filter(a => a.listingId === l.id && a.status === 'not_successful' && a.id !== award.applicationId).forEach(a => { a.status = 'submitted'; });
    l.status = 'closed';
    setStatus(db, l.assetId, l.mode === 'lease' ? 'available_lease' : l.mode === 'sale' ? 'available_sale' : 'available_auction', 'System', `Offer ${award.offerNo} declined`);
    audit(db, customer.name, 'OFFER_DECLINED', 'Award', award.offerNo);
    return;
  }
  award.status = 'accepted';
  const doc = activeFee(db, 'DOC');
  const main: InvoiceLine = {
    code: l.mode.toUpperCase(),
    description: l.mode === 'lease' ? `Rent — year 1 of ${l.leaseYears || 1} (${l.listingNo})` : l.mode === 'auction' ? `Winning bid balance (${l.listingNo})` : `Purchase price (${l.listingNo})`,
    amountKobo: award.amountKobo, account: REVENUE_ACCOUNT[l.mode],
  };
  const inv = raiseInvoice(db, 'System', customerId, { type: 'award', id: award.id },
    [main, { code: doc.code, description: doc.description, amountKobo: doc.amountKobo, account: '4400' }], 30);
  award.invoiceId = inv.id;
  audit(db, customer.name, 'OFFER_ACCEPTED', 'Award', award.offerNo, `Invoice ${inv.invoiceNo}`);
  return inv;
}

// ── Fee schedules (versioned) ────────────────────────────────────────────────
export function newFeeVersion(db: RmsDb, actor: Actor, code: string, amountKobo: number, legalReference: string, effectiveFrom: string) {
  requireRole(actor, 'finance');
  const current = activeFee(db, code);
  if (!(amountKobo > 0)) throw new Error('Enter an amount');
  if (!legalReference.trim()) throw new Error('Cite the instrument that approves this fee');
  const from = new Date(effectiveFrom + 'T00:00:00').toISOString();
  if (from <= current.effectiveFrom) throw new Error('The new version must start after the current one');
  current.effectiveTo = from;
  db.feeSchedules.push({ id: uid(), code, description: current.description, amountKobo, legalReference: legalReference.trim(), effectiveFrom: from });
  audit(db, actor.name, 'FEE_VERSION_ADDED', 'FeeSchedule', code, `${amountKobo / 100} NGN from ${effectiveFrom}`);
}
