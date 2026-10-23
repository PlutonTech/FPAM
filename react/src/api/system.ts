import { api } from './client';

export interface SystemHealth {
  status: string;
  uptimeSeconds: number;
  node: string;
  environment: string;
  database: { name: string; host: string; latencyMs: number };
  memoryMb: { rss: number; heapUsed: number };
  integrations: { email: boolean; sms: boolean; antivirus: boolean; appUrl: string | null };
  counts: { assets: number; activeUsers: number; serverErrors24h: number; clientErrors24h: number };
}
export interface ErrorEntry {
  _id: string; source: 'server' | 'client'; message: string; stack?: string; url?: string; method?: string;
  status?: number; user?: { name?: string; email?: string } | null; userAgent?: string; release?: string; at: string;
}
export type Enums = Record<'states' | 'assetTypes' | 'conditions' | 'statuses' | 'geomTypes' | 'assessed' | 'sectors' | 'lifecycleStages' | 'roles' | 'divisions', string[]>;

export const systemHealth = () => api<SystemHealth>('/system/health');
export const systemErrors = (source?: 'server' | 'client') => api<{ errors: ErrorEntry[] }>(`/system/errors${source ? `?source=${source}` : ''}`).then(r => r.errors);
export const enums = () => api<Enums>('/system/enums');
