import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import * as api from '../api/notifications';
import { API_BASE } from '../config';
import type { ServerNotification } from '../api/notifications';

// Notifications stored by the backend (capture decisions, inspection results,
// form reviews, assigned data fixes…). Loaded on start, pushed live over
// socket.io, and re-fetched every minute in case the live connection drops.

let state: { list: ServerNotification[]; unread: number } = { list: [], unread: 0 };
const listeners = new Set<() => void>();
const set = (next: typeof state) => { state = next; listeners.forEach(l => l()); };

export function useServerNotifications() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state);
}

export async function loadServerNotifications() {
  try { const r = await api.list(); set({ list: r.notifications, unread: r.unread }); } catch { /* offline / old backend */ }
}
export async function markServerRead(id: string) {
  const n = state.list.find(x => x._id === id);
  if (!n || n.readAt) return;
  set({ list: state.list.map(x => (x._id === id ? { ...x, readAt: new Date().toISOString() } : x)), unread: Math.max(0, state.unread - 1) });
  await api.markRead(id).catch(() => {});
}
export async function markAllServerRead() {
  set({ list: state.list.map(x => ({ ...x, readAt: x.readAt || new Date().toISOString() })), unread: 0 });
  await api.markAllRead().catch(() => {});
}
export async function clearServerNotifications() {
  set({ list: [], unread: 0 });
  await api.clearAll().catch(() => {});
}

let socket: Socket | null = null;
/** Live push. The socket server lives at the API's origin (API_BASE minus /api). */
export function connectRealtime(token: string) {
  disconnectRealtime();
  const origin = API_BASE.replace(/\/api\/?$/, '');
  socket = io(origin, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 30000 });
  socket.on('notification', (n: ServerNotification) => {
    if (state.list.some(x => x._id === n._id)) return;
    set({ list: [n, ...state.list].slice(0, 50), unread: state.unread + 1 });
  });
}
export function disconnectRealtime() { socket?.disconnect(); socket = null; }
