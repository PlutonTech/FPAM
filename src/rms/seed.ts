// Demo data for phase one. Built by running the real domain functions so the
// ledger, invoices and audit trail are consistent from the start.
import * as d from './domain';
import { personaFor } from './personas';
import type { RevenueStatus, RmsAsset, RmsDb } from './types';

const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const kobo = (naira: number) => Math.round(naira * 100);
const PLACEHOLDER_REF = 'Placeholder — instrument to be confirmed by FPAM';

type SeedAsset = Omit<RmsAsset, 'id' | 'statusHistory' | 'revenueStatus'> & { status: RevenueStatus };
const ASSETS: SeedAsset[] = [
  { assetCode: 'FGN-FMHUD-RES-001-2019-0004', name: '3-bedroom detached house, Plot 12, Gwarinpa II', type: 'Residential', state: 'FCT', lga: 'AMAC', address: 'Plot 12, 3rd Avenue, Gwarinpa II Estate, Abuja', mda: 'Federal Ministry of Housing and Urban Development', description: 'Detached bungalow on 650 m² with boys’ quarters, perimeter fence and borehole. Vacated in 2024 and approved for outright sale.', sizeSqm: 650, lat: 9.1099, lng: 7.4042, status: 'available_sale' },
  { assetCode: 'FGN-FMHUD-ADM-025-2015-0011', name: 'Former Federal Secretariat Annex, Ikoyi', type: 'Administrative Office', state: 'Lagos', lga: 'Eti-Osa', address: '7 Alfred Rewane Road, Ikoyi, Lagos', mda: 'Federal Ministry of Housing and Urban Development', description: 'Four-storey office building, 2,800 m² lettable, 40 parking spaces. Offered on a 3-year commercial lease.', sizeSqm: 2800, lat: 6.4474, lng: 3.4339, status: 'available_lease' },
  { assetCode: 'FGN-FMW-EQP-001-2017-0032', name: 'Unserviceable Toyota Hilux fleet (6 units)', type: 'Equipment', state: 'FCT', lga: 'AMAC', address: 'FMW Mechanical Yard, Mabushi, Abuja', mda: 'Federal Ministry of Works', description: 'Six 2012–2014 Toyota Hilux double-cab pickups, boarded as unserviceable. Sold as one lot, as seen.', lat: 9.0822, lng: 7.4521, status: 'available_auction' },
  { assetCode: 'FGN-FMHUD-ADM-001-2012-0019', name: 'Multi-purpose event hall, Area 11', type: 'Administrative Office', state: 'FCT', lga: 'AMAC', address: 'Ahmadu Bello Way, Area 11, Garki, Abuja', mda: 'Federal Ministry of Housing and Urban Development', description: '600-seat hall with kitchen and parking, available on a 1-year lease for events management.', sizeSqm: 1200, lat: 9.0412, lng: 7.4893, status: 'available_lease' },
  { assetCode: 'FGN-FMHUD-LND-033-2010-0002', name: 'Vacant land, 2.4 ha, Trans-Amadi', type: 'Land / Property', state: 'Rivers', lga: 'Obio/Akpor', address: 'Trans-Amadi Industrial Layout, Port Harcourt', mda: 'Federal Ministry of Housing and Urban Development', description: 'Fenced industrial plot with Certificate of Occupancy, good road access.', sizeSqm: 24000, lat: 4.8156, lng: 7.0498, status: 'available_sale' },
  { assetCode: 'FGN-FMHUD-RES-019-2008-0007', name: 'Staff quarters, Block C, Kaduna', type: 'Residential', state: 'Kaduna', lga: 'Kaduna North', address: 'Federal Staff Quarters, Malali, Kaduna', mda: 'Federal Ministry of Education', description: 'Twelve 2-bedroom flats allocated to the Federal Ministry of Education.', lat: 10.5481, lng: 7.4384, status: 'allocated_mda' },
  { assetCode: 'FGN-FMOH-HOS-001-2005-0001', name: 'Federal Ministry of Health annex', type: 'Hospital', state: 'FCT', lga: 'AMAC', address: 'Federal Secretariat Complex, Phase III, Abuja', mda: 'Federal Ministry of Health', description: 'Operational office annex. Not a revenue asset.', lat: 9.0579, lng: 7.4951, status: 'non_revenue' },
  { assetCode: 'FGN-FMHUD-WHS-025-2011-0003', name: 'Warehouse, Apapa', type: 'Warehouse', state: 'Lagos', lga: 'Apapa', address: 'Creek Road, Apapa, Lagos', mda: 'Federal Ministry of Housing and Urban Development', description: '4,500 m² warehouse near Apapa port with loading bays and 24-hour access.', sizeSqm: 4500, lat: 6.4489, lng: 3.3645, status: 'available_lease' },
  { assetCode: 'FGN-FMHUD-RES-020-2014-0009', name: 'Residential flat 2B, Nassarawa GRA', type: 'Residential', state: 'Kano', lga: 'Nassarawa', address: 'Block 2, Flat B, Bompai Road, Nassarawa GRA, Kano', mda: 'Federal Ministry of Housing and Urban Development', description: '3-bedroom flat on the first floor with allocated parking.', sizeSqm: 140, lat: 12.0022, lng: 8.5492, status: 'available_auction' },
  { assetCode: 'FGN-FMHUD-ADM-015-2009-0005', name: 'Federal office complex, Independence Layout', type: 'Administrative Office', state: 'Enugu', lga: 'Enugu North', address: 'Independence Layout, Enugu', mda: 'Federal Ministry of Interior', description: 'Allocated to the Federal Ministry of Interior.', lat: 6.4584, lng: 7.5464, status: 'allocated_mda' },
  { assetCode: 'FGN-FMP-EQP-031-2016-0014', name: 'Generator sets (3 × 500 kVA)', type: 'Equipment', state: 'Oyo', lga: 'Ibadan North', address: 'Federal Secretariat, Ikolaba, Ibadan', mda: 'Federal Ministry of Power', description: 'In service at the Federal Secretariat. Not a revenue asset.', lat: 7.4086, lng: 3.9105, status: 'non_revenue' },
  { assetCode: 'FGN-FMHUD-RES-032-2013-0006', name: 'Federal guest house, Rayfield', type: 'Residential', state: 'Plateau', lga: 'Jos South', address: 'Rayfield, Jos', mda: 'Federal Ministry of Housing and Urban Development', description: 'Eight-room guest house currently under review for a revenue decision.', lat: 9.8467, lng: 8.8996, status: 'non_revenue' },
];

export function buildSeed(): RmsDb {
  const db: RmsDb = {
    version: 1, assets: [], customers: [], listings: [], applications: [], valuations: [], feeSchedules: [],
    awards: [], invoices: [], payments: [], ledger: [], contracts: [], audit: [], callbacks: [], counters: {},
  };
  const ro = personaFor('revenue'), val = personaFor('valuer'), com = personaFor('committee');
  const start = days(-90);

  db.feeSchedules = [
    ['APP-FORM', 'Application / expression-of-interest form', 10000],
    ['BID-PART', 'Bid participation fee', 50000],
    ['DOC', 'Documentation & offer-letter processing', 25000],
    ['VAL-INSP', 'Inspection & valuation fee', 30000],
    ['CONSENT', 'Consent / assignment processing', 100000],
  ].map(([code, description, n]) => ({ id: `fee-${code}`, code: code as string, description: description as string, amountKobo: kobo(n as number), legalReference: PLACEHOLDER_REF, effectiveFrom: start }));

  db.assets = ASSETS.map(({ status, ...a }, i) => ({
    ...a, id: `asset-${i + 1}`, revenueStatus: status,
    statusHistory: [{ status, at: start, by: 'Data migration', note: 'Imported from the FPAMAS register' }],
  }));
  const A = (code: string) => db.assets.find(a => a.assetCode === code)!.id;

  // Valuations (approved by the committee chair; one left in draft for the demo)
  const valuate = (code: string, method: Parameters<typeof d.createValuation>[2]['method'], value: number, rent: number, notes: string, approve = true) => {
    const v = d.createValuation(db, val, { assetId: A(code), method, valueKobo: kobo(value), annualRentKobo: kobo(rent), notes, validUntil: days(300).slice(0, 10) });
    if (approve) d.decideValuation(db, com, v.id, true);
    return v;
  };
  valuate('FGN-FMHUD-RES-001-2019-0004', 'Market comparison', 145_000_000, 6_500_000, 'Three comparable sales in Gwarinpa II within 12 months.');
  valuate('FGN-FMHUD-ADM-025-2015-0011', 'Income capitalisation', 2_100_000_000, 168_000_000, 'Prime Ikoyi office rents at ₦60,000/m²/yr.');
  valuate('FGN-FMW-EQP-001-2017-0032', 'Depreciated replacement cost', 21_000_000, 0, 'Scrap/salvage basis; vehicles not roadworthy.');
  valuate('FGN-FMHUD-ADM-001-2012-0019', 'Income capitalisation', 380_000_000, 24_000_000, 'Event venue comparables in Garki and Wuse.');
  valuate('FGN-FMHUD-RES-020-2014-0009', 'Market comparison', 32_000_000, 1_800_000, 'Nassarawa GRA flats, 2025–26 transactions.');
  valuate('FGN-FMHUD-LND-033-2010-0002', 'Market comparison', 960_000_000, 48_000_000, 'Industrial land at ₦40,000/m² in Trans-Amadi.', false);

  // Listings
  const list = (code: string, title: string, description: string, amount: number, closeIn: number, leaseYears?: number) =>
    d.createListing(db, ro, { assetId: A(code), title, description, reservePriceKobo: kobo(amount), leaseYears, closeDate: days(closeIn) });
  list('FGN-FMHUD-RES-001-2019-0004', '3-bedroom detached house for sale — Gwarinpa II, Abuja', 'Outright sale. Price fixed at the approved valuation; offers at or above the price are considered.', 145_000_000, 21);
  const ikoyi = list('FGN-FMHUD-ADM-025-2015-0011', 'Office building to let — Ikoyi, Lagos (3-year lease)', 'Commercial lease, rent payable annually in advance. Offers at or above the annual rent are considered.', 168_000_000, 28, 3);
  const hilux = list('FGN-FMW-EQP-001-2017-0032', 'Auction: 6 unserviceable Toyota Hilux pickups (one lot)', 'Sealed-bid auction. Sold as seen; buyer removes the vehicles within 14 days of payment.', 21_000_000, 10);
  list('FGN-FMHUD-ADM-001-2012-0019', 'Event hall to let — Area 11, Garki (1-year lease)', 'One-year lease for a qualified events manager.', 24_000_000, 14, 1);
  const kano = list('FGN-FMHUD-RES-020-2014-0009', 'Sealed-bid auction: 3-bedroom flat, Nassarawa GRA, Kano', 'Sealed-bid disposal. Highest responsive bid recommended to the committee.', 32_000_000, 5);

  // Customers (password for all: demo1234)
  const reg = (type: 'individual' | 'corporate', name: string, idNumber: string, email: string, phone: string, address: string) =>
    d.registerCustomer(db, { type, name, idNumber, email, phone, address, password: 'demo1234' });
  const amaka = reg('individual', 'Amaka Nwosu', '22345678901', 'amaka@example.com', '08031234567', '14 Aminu Kano Crescent, Wuse II, Abuja');
  const sahel = reg('corporate', 'Sahel Logistics Ltd', 'RC 1458821', 'sahel@example.com', '08099887766', '22 Creek Road, Apapa, Lagos');
  const ibrahim = reg('individual', 'Ibrahim Musa', '33456789012', 'ibrahim@example.com', '08055554444', '5 Bompai Road, Kano');
  d.verifyKyc(db, ro, amaka.id); d.verifyKyc(db, ro, sahel.id);

  const doc = (name: string) => [{ name, size: 184_000 }];
  const apply = (customerId: string, listingId: string, amount: number, statement: string, file: string, pay = true) => {
    const { invoice } = d.submitApplication(db, customerId, { listingId, amountKobo: kobo(amount), statement, documents: doc(file) });
    if (pay) d.simulateRemitaPayment(db, customerId, invoice.id, 'Card');
  };
  apply(amaka.id, kano.id, 34_500_000, 'Owner-occupier; funds available from savings.', 'NIN slip - Amaka Nwosu.pdf');
  apply(sahel.id, kano.id, 36_200_000, 'Staff housing for our Kano depot.', 'CAC certificate - Sahel Logistics.pdf');
  apply(ibrahim.id, kano.id, 33_000_000, 'First-time buyer.', 'NIN slip - Ibrahim Musa.pdf');
  apply(sahel.id, ikoyi.id, 175_000_000, 'Regional head office; 3-year term with option to renew.', 'CAC certificate - Sahel Logistics.pdf');
  apply(ibrahim.id, hilux.id, 22_500_000, 'Spare-parts dealer.', 'NIN slip - Ibrahim Musa.pdf', false);

  // The Kano auction's closing date has passed, so its bids can be opened.
  db.listings.find(l => l.id === kano.id)!.closeDate = days(-1);
  return db;
}
