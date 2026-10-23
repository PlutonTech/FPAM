import { api } from './client';

export interface ServerNotification {
  _id: string; type: string; title: string; body: string; link: string | null; icon: string; color: string;
  readAt: string | null; createdAt: string;
}
export const list = () => api<{ notifications: ServerNotification[]; unread: number }>('/notifications');
export const markRead = (id: string) => api(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
export const markAllRead = () => api('/notifications/read-all', { method: 'POST' });
export const clearAll = () => api('/notifications', { method: 'DELETE' });
