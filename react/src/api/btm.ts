import { api } from './client';

// Building Training & Maintenance division.
const enc = encodeURIComponent;

export interface BtmSummary {
  workOrders: { open: number; inProgress: number; overdue: number };
  plans: { overdue: number; dueThisWeek: number };
  training: { sessionsThisYear: number; attendeesThisYear: number };
  canManage: boolean;
  options: { frequencies: string[]; categories: string[]; statuses: string[] };
}
export interface MaintenancePlan {
  _id: string; assetId: string; assetName: string; task: string; category: string; frequency: string;
  nextDue: string; lastDone: string | null; assignedTo: string; notes: string; active: boolean;
}
export type WorkOrderStatus = 'Open' | 'In progress' | 'Completed' | 'Cancelled';
export interface WorkOrder {
  _id: string; ref: string; assetId: string; assetName: string; title: string; description: string;
  category: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; status: WorkOrderStatus;
  assignedTo: string; dueDate: string | null; cost: number | null; completedAt: string | null; completionNote: string;
  source: { type: 'manual' | 'plan' | 'report'; id: string | null }; createdByName: string; createdAt: string;
}
export interface TrainingSession {
  _id: string; title: string; topic: string; date: string; durationHours: number | null; venue: string;
  assetId: string; assetName: string; facilitator: string; attendees: { name: string; organisation: string }[]; notes: string;
}

export const summary = () => api<BtmSummary>('/btm/summary');

export const listPlans = () => api<{ plans: MaintenancePlan[] }>('/btm/plans').then(r => r.plans);
export const createPlan = (body: Record<string, unknown>) => api<{ plan: MaintenancePlan }>('/btm/plans', { method: 'POST', body });
export const updatePlan = (id: string, body: Record<string, unknown>) => api<{ plan: MaintenancePlan }>(`/btm/plans/${enc(id)}`, { method: 'PATCH', body });
export const deletePlan = (id: string) => api(`/btm/plans/${enc(id)}`, { method: 'DELETE' });
export const raiseFromPlan = (id: string) => api<{ workOrder: WorkOrder }>(`/btm/plans/${enc(id)}/work-order`, { method: 'POST' });

export const listWorkOrders = (status = '') =>
  api<{ workOrders: WorkOrder[] }>(`/btm/work-orders${status ? `?status=${enc(status)}` : ''}`).then(r => r.workOrders);
export const createWorkOrder = (body: Record<string, unknown>) => api<{ workOrder: WorkOrder }>('/btm/work-orders', { method: 'POST', body });
export const updateWorkOrder = (id: string, body: Record<string, unknown>) =>
  api<{ workOrder: WorkOrder }>(`/btm/work-orders/${enc(id)}`, { method: 'PATCH', body });

export const listTraining = () => api<{ sessions: TrainingSession[] }>('/btm/training').then(r => r.sessions);
export const createTraining = (body: Record<string, unknown>) => api<{ session: TrainingSession }>('/btm/training', { method: 'POST', body });
export const updateTraining = (id: string, body: Record<string, unknown>) =>
  api<{ session: TrainingSession }>(`/btm/training/${enc(id)}`, { method: 'PATCH', body });
export const deleteTraining = (id: string) => api(`/btm/training/${enc(id)}`, { method: 'DELETE' });
