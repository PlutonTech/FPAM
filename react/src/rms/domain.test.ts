import { describe, expect, it } from 'vitest';
import * as d from './domain';
import { buildSeed } from './seed';
import { sha256 } from './sha256';
import { naira, toKobo } from './format';
import { personaFor } from './personas';
import type { RmsDb } from './types';

const fresh = (): RmsDb => structuredClone(buildSeed());
const ro = personaFor('revenue'), val = personaFor('valuer'), com = personaFor('committee'), fin = personaFor('finance');
const com2 = { name: 'Grace Effiong', role: 'committee' as const };

describe('sha256', () => {
  it('matches known digests', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('money', () => {
  it('parses naira into whole kobo without floating-point error', () => {
    expect(toKobo('1,250,000.50')).toBe(125000050);
    expect(toKobo('0.1')).toBe(10);
    expect(toKobo('₦36,200,000')).toBe(3620000000);
    expect(Number.isNaN(toKobo('12.345'))).toBe(true);
    expect(naira(3620000000)).toBe('₦36,200,000');
  });
});

describe('ledger', () => {
  it('seed data starts verified and balanced', () => {
    const db = fresh();
    expect(d.verifyLedger(db).ok).toBe(true);
    const tb = d.trialBalance(db);
    expect(tb.reduce((t, r) => t + r.debit, 0)).toBe(tb.reduce((t, r) => t + r.credit, 0));
  });
  it('detects any edit to a posted entry', () => {
    const db = fresh();
    db.ledger[3].creditKobo += 1;
    expect(d.verifyLedger(db)).toMatchObject({ ok: false, brokenAt: 4 });
  });
  it('detects a removed entry', () => {
    const db = fresh();
    db.ledger.splice(2, 1);
    expect(d.verifyLedger(db).ok).toBe(false);
  });
});

describe('Remita callbacks', () => {
  function unpaidInvoice(db: RmsDb) { return db.invoices.find(i => i.status === 'unpaid')!; }

  it('posts once; a replay is acknowledged but not posted again', () => {
    const db = fresh();
    const inv = unpaidInvoice(db);
    const amountKobo = inv.totalKobo;
    const cb = { rrr: inv.rrr, amountKobo, channel: 'Card' as const, remitaRef: 'RMT-TEST-1', signature: d.signCallback(inv.rrr, amountKobo, 'RMT-TEST-1') };
    expect(d.processRemitaCallback(db, cb).result).toBe('posted');
    const payments = db.payments.length, entries = db.ledger.length;
    expect(d.processRemitaCallback(db, cb).result).toBe('duplicate');
    expect(db.payments.length).toBe(payments);
    expect(db.ledger.length).toBe(entries);
    expect(d.verifyLedger(db).ok).toBe(true);
  });
  it('rejects a tampered amount', () => {
    const db = fresh();
    const inv = unpaidInvoice(db);
    const sig = d.signCallback(inv.rrr, inv.totalKobo, 'RMT-TEST-2');
    expect(() => d.processRemitaCallback(db, { rrr: inv.rrr, amountKobo: inv.totalKobo + 100, channel: 'Card', remitaRef: 'RMT-TEST-2', signature: sig })).toThrow(/signature/);
  });
});

describe('segregation of duties', () => {
  it("a valuer can't approve their own valuation", () => {
    const db = fresh();
    const v = d.createValuation(db, val, { assetId: db.assets[7].id, method: 'Market comparison', valueKobo: 1000_00, annualRentKobo: 100_00, notes: '', validUntil: '2099-01-01' });
    expect(() => d.decideValuation(db, { name: val.name, role: 'committee' }, v.id, true)).toThrow(/own valuation/);
    d.decideValuation(db, com, v.id, true);
    expect(db.valuations.find(x => x.id === v.id)!.status).toBe('approved');
  });

  it('runs the full chain: close → evaluate → recommend → award → accept → pay → sold', () => {
    const db = fresh();
    const kano = db.listings.find(l => l.title.includes('Kano'))!;
    d.closeListing(db, ro, kano.id);
    const apps = db.applications.filter(a => a.listingId === kano.id && a.status === 'submitted').sort((a, b) => b.amountKobo - a.amountKobo);
    d.evaluateApplication(db, ro, apps[0].id, 90, 'Highest bid');
    d.recommendApplication(db, ro, apps[0].id);
    expect(() => d.decideAward(db, fin, apps[0].id, true, '')).toThrow(/Approval Committee/);
    const award = d.decideAward(db, com2, apps[0].id, true, 'Minutes 1')!;
    expect(db.assets.find(a => a.id === kano.assetId)!.revenueStatus).toBe('under_offer');
    const inv = d.respondToOffer(db, award.customerId, award.id, true)!;
    d.simulateRemitaPayment(db, award.customerId, inv.id, 'Bank transfer');
    expect(db.assets.find(a => a.id === kano.assetId)!.revenueStatus).toBe('sold');
    expect(db.contracts).toHaveLength(1);
    expect(d.verifyLedger(db).ok).toBe(true);
  });

  it("listings can't be priced below the approved valuation", () => {
    const db = fresh();
    const warehouse = db.assets.find(a => a.name.startsWith('Warehouse'))!;
    const v = d.createValuation(db, val, { assetId: warehouse.id, method: 'Income capitalisation', valueKobo: 1_000_000_00, annualRentKobo: 80_000_00, notes: '', validUntil: '2099-01-01' });
    d.decideValuation(db, com, v.id, true);
    const closeDate = new Date(Date.now() + 7 * 86400000).toISOString();
    expect(() => d.createListing(db, ro, { assetId: warehouse.id, title: 'x', description: '', reservePriceKobo: 79_999_00, closeDate })).toThrow(/below the approved valuation/);
    expect(d.createListing(db, ro, { assetId: warehouse.id, title: 'Warehouse to let', description: '', reservePriceKobo: 80_000_00, closeDate }).status).toBe('open');
  });
});
