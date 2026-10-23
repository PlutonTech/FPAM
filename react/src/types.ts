export type Role =
  | 'System Admin' | 'Supervisor' | 'Sub-Head' | 'GIS Analyst' | 'Field Agent' | 'MDA Agent';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role | string;
  division?: string | null;
  mda?: string | null;
  permissions?: Record<string, boolean>;
  phone?: string | null;
  mfa?: { enabled?: boolean; enabledAt?: string };
}

export type Condition = 'Good' | 'Fair' | 'Poor' | 'Critical';

export interface FileRef {
  _id: string;
  fileId?: string;
  filename?: string;
  originalname?: string;
  contentType?: string;
  length?: number;
  uploadDate?: string;
  uploadedAt?: string;
  meReportId?: string | null;
}

export interface MaintenanceLog {
  _id?: string;
  date: string;
  desc: string;
  tech?: string;
  cost?: number;
}

export interface Valuation {
  amount?: number;
  currency?: string;
  valuedAt?: string;
  valuedBy?: string;
  method?: string;
  notes?: string;
}

export interface ConditionChange {
  from?: string;
  to?: string;
  changedAt?: string;
}

export interface UserRef { _id: string; name?: string; email?: string; role?: string }

export interface Asset {
  _id: string;
  assetId: string;
  assetCode?: string;
  name: string;
  type?: string;
  geomType?: 'Point' | 'Polygon' | 'Linear';
  location?: { type: 'Point'; coordinates: [number, number] };
  lat?: number | null;
  lng?: number | null;
  condition?: Condition | null;
  material?: string;
  area?: number;
  elevation?: number;
  inspectionInterval?: number;
  notes?: string;
  mda?: string;
  sector?: string;
  state?: string;
  lga?: string;
  address?: string;
  status?: string;
  assessed?: 'Assessed' | 'Unassessed';
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  capturedBy?: UserRef | string | null;
  submittedBy?: UserRef | string | null;
  parentId?: string | null;
  childIds?: string[];
  lifecycleStage?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  agent?: string;
  nextInspection?: string;
  lastInspection?: string;
  captureDate?: string;
  createdAt?: string;
  updatedAt?: string;
  photos?: FileRef[];
  documents?: FileRef[];
  maintenanceLogs?: MaintenanceLog[];
  conditionHistory?: ConditionChange[];
  valuation?: Valuation;
  typeData?: Record<string, unknown>;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
  page: number;
  pages: number;
}
