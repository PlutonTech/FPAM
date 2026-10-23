// Revenue Management System — phase one data model (browser-only, localStorage).
// Money is always integer kobo. Field names follow the architecture document.

export type RevenueStatus =
  | 'non_revenue' | 'allocated_mda' | 'available_sale' | 'available_lease' | 'available_auction'
  | 'under_offer' | 'leased' | 'sold' | 'disposed';

export type ListingMode = 'sale' | 'lease' | 'auction';

export interface StatusChange { status: RevenueStatus; at: string; by: string; note?: string }

export interface RmsAsset {
  id: string;
  assetCode: string;
  name: string;
  type: string;
  state: string;
  lga: string;
  address: string;
  mda: string;                 // occupant / allocatee — tracked, never billed
  description: string;
  sizeSqm?: number;
  lat: number;
  lng: number;
  revenueStatus: RevenueStatus;
  statusHistory: StatusChange[];
  currentValuationId?: string;
  currentContractId?: string;
}

export interface Customer {
  id: string;
  customerNo: string;
  type: 'individual' | 'corporate';
  name: string;
  idNumber: string;            // NIN (individual) or RC number (corporate)
  email: string;
  phone: string;
  address: string;
  passwordHash: string;
  kycStatus: 'pending' | 'verified';
  createdAt: string;
}

export type ListingStatus = 'open' | 'closed' | 'awarded' | 'cancelled';
export interface Listing {
  id: string;
  listingNo: string;
  assetId: string;
  mode: ListingMode;
  title: string;
  description: string;
  reservePriceKobo: number;    // sale price / auction reserve / annual rent
  leaseYears?: number;
  openDate: string;
  closeDate: string;
  status: ListingStatus;
  valuationId?: string;
  createdBy: string;
  createdAt: string;
}

export type ApplicationStatus =
  | 'awaiting_fee' | 'submitted' | 'recommended' | 'awarded' | 'not_successful' | 'withdrawn';
export interface Application {
  id: string;
  applicationNo: string;
  listingId: string;
  customerId: string;
  amountKobo: number;          // offer / bid / rent offered
  documents: { name: string; size: number }[];
  statement: string;
  status: ApplicationStatus;
  feeInvoiceId: string;
  submittedAt: string;
  evaluation?: { score: number; notes: string; by: string; at: string };
}

export type ValuationMethod = 'Market comparison' | 'Income capitalisation' | 'Depreciated replacement cost' | 'Residual';
export interface Valuation {
  id: string;
  valuationNo: string;
  assetId: string;
  method: ValuationMethod;
  valueKobo: number;           // market value
  annualRentKobo: number;      // assessed market rent
  notes: string;
  valuer: string;
  status: 'draft' | 'approved' | 'rejected';
  approvedBy?: string;
  decidedAt?: string;
  rejectReason?: string;
  validUntil: string;
  createdAt: string;
}

export interface FeeSchedule {
  id: string;
  code: string;
  description: string;
  amountKobo: number;
  legalReference: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface Award {
  id: string;
  offerNo: string;
  listingId: string;
  applicationId: string;
  customerId: string;
  amountKobo: number;
  recommendedBy: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
  status: 'offered' | 'accepted' | 'declined' | 'completed';
  respondedAt?: string;
  invoiceId?: string;
}

export type InvoiceStatus = 'unpaid' | 'part_paid' | 'paid' | 'cancelled';
export interface InvoiceLine { code: string; description: string; amountKobo: number; account: string }
export interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string;
  ref: { type: 'application' | 'award'; id: string };
  lines: InvoiceLine[];
  totalKobo: number;
  paidKobo: number;
  rrr: string;
  issuedAt: string;
  dueDate: string;
  status: InvoiceStatus;
  raisedBy: string;
}

export type PayChannel = 'Card' | 'Bank transfer' | 'USSD' | 'Bank branch';
export interface Payment {
  id: string;
  receiptNo: string;
  rrr: string;
  invoiceId: string;
  customerId: string;
  amountKobo: number;
  channel: PayChannel;
  remitaRef: string;
  paidAt: string;
  verified: boolean;
  rawCallback: string;
}

export interface LedgerEntry {
  seq: number;
  txnId: string;
  account: string;
  debitKobo: number;
  creditKobo: number;
  refType: string;
  refId: string;
  memo: string;
  postedAt: string;
  prevHash: string;
  hash: string;
}

/** Ownership-transfer (sale/auction) or basic lease record created when an award is fully paid. */
export interface Contract {
  id: string;
  contractNo: string;
  type: 'sale' | 'lease';
  assetId: string;
  customerId: string;
  awardId: string;
  amountKobo: number;
  startDate: string;
  endDate?: string;
  createdAt: string;
}

export interface RmsAudit { id: string; at: string; actor: string; action: string; entity: string; entityId: string; detail: string }

export interface CallbackLog { at: string; rrr: string; remitaRef: string; result: 'posted' | 'duplicate' | 'rejected'; detail: string }

export interface RmsDb {
  version: 1;
  assets: RmsAsset[];
  customers: Customer[];
  listings: Listing[];
  applications: Application[];
  valuations: Valuation[];
  feeSchedules: FeeSchedule[];
  awards: Award[];
  invoices: Invoice[];
  payments: Payment[];
  ledger: LedgerEntry[];
  contracts: Contract[];
  audit: RmsAudit[];
  callbacks: CallbackLog[];
  counters: Record<string, number>;
}
