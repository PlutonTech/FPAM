import { API_BASE } from '../config';
import { tokenStore } from '../api/client';

// Sends browser errors to the backend (System health → Errors), so problems
// users hit are visible without them having to report them. Each distinct
// message is sent once per page load, at most 20 per load.
declare const __BUILD_ID__: string;
const sent = new Set<string>();

export function reportError(err: unknown, context?: string) {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    const message = `${context ? `${context}: ` : ''}${e.message || String(err)}`.slice(0, 1000);
    if (sent.has(message) || sent.size >= 20) return;
    // Network failures are the user's connection, not a bug.
    if (/Failed to fetch|NetworkError|Load failed|Cannot reach the server/i.test(message)) return;
    sent.add(message);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const t = tokenStore.get();
    if (t) headers.Authorization = `Bearer ${t}`;
    fetch(`${API_BASE}/system/client-errors`, {
      method: 'POST', headers, keepalive: true,
      body: JSON.stringify({ message, stack: e.stack, url: location.href, release: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : undefined }),
    }).catch(() => {});
  } catch { /* reporting must never throw */ }
}

export function installErrorReporting() {
  window.addEventListener('error', e => reportError(e.error || e.message, 'Uncaught'));
  window.addEventListener('unhandledrejection', e => reportError(e.reason, 'Unhandled promise'));
}
