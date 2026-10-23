import type { Tone } from '../lib/assets';
import type { ApplicationStatus, InvoiceStatus, ListingMode, ListingStatus, RevenueStatus } from './types';

/** ₦ from integer kobo. */
export function naira(kobo?: number | null, opts: { decimals?: boolean } = {}): string {
  if (kobo == null) return '—';
  const n = kobo / 100;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: opts.decimals ? 2 : 0, maximumFractionDigits: 2 });
}

/** Parse a naira amount typed by a user ("1,250,000.50") into kobo. NaN if invalid. */
export function toKobo(input: string | number): number {
  const s = String(input).replace(/[₦,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

export const koboToInput = (kobo: number) => (kobo / 100).toString();

export const REVENUE_STATUS: Record<RevenueStatus, { label: string; tone: Tone }> = {
  non_revenue:       { label: 'Non-revenue',       tone: 'gray' },
  allocated_mda:     { label: 'Allocated to MDA',  tone: 'gray' },
  available_sale:    { label: 'Available — sale',  tone: 'blue' },
  available_lease:   { label: 'Available — lease', tone: 'blue' },
  available_auction: { label: 'Available — auction', tone: 'blue' },
  under_offer:       { label: 'Under offer',       tone: 'warn' },
  leased:            { label: 'Leased',            tone: 'green' },
  sold:              { label: 'Sold',              tone: 'green' },
  disposed:          { label: 'Disposed',          tone: 'gray' },
};

/** Statuses a Revenue Officer may set by hand. The rest are set by the workflow. */
export const MANUAL_STATUSES: RevenueStatus[] = ['non_revenue', 'allocated_mda', 'available_sale', 'available_lease', 'available_auction'];

export const MODE_LABEL: Record<ListingMode, string> = { sale: 'Sale', lease: 'Lease', auction: 'Auction' };
export const MODE_TONE: Record<ListingMode, Tone> = { sale: 'blue', lease: 'green', auction: 'orange' };
export const MODE_FOR_STATUS: Partial<Record<RevenueStatus, ListingMode>> = {
  available_sale: 'sale', available_lease: 'lease', available_auction: 'auction',
};
/** What the listing's main amount means for each mode. */
export const AMOUNT_LABEL: Record<ListingMode, string> = { sale: 'Sale price', lease: 'Annual rent', auction: 'Reserve price' };

export const LISTING_TONE: Record<ListingStatus, Tone> = { open: 'blue', closed: 'warn', awarded: 'green', cancelled: 'gray' };

export const APP_STATUS: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  awaiting_fee:   { label: 'Awaiting fee payment', tone: 'warn' },
  submitted:      { label: 'Submitted',            tone: 'blue' },
  recommended:    { label: 'Recommended',          tone: 'orange' },
  awarded:        { label: 'Awarded',              tone: 'green' },
  not_successful: { label: 'Not successful',       tone: 'gray' },
  withdrawn:      { label: 'Withdrawn',            tone: 'gray' },
};

export const INVOICE_TONE: Record<InvoiceStatus, Tone> = { unpaid: 'red', part_paid: 'warn', paid: 'green', cancelled: 'gray' };
export const INVOICE_LABEL: Record<InvoiceStatus, string> = { unpaid: 'Unpaid', part_paid: 'Part-paid', paid: 'Paid', cancelled: 'Cancelled' };

/** RRRs are 12 digits; shown in groups of four like Remita does. */
export const formatRrr = (rrr: string) => rrr.replace(/(\d{4})(?=\d)/g, '$1-');

export const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
