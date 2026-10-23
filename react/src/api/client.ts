import { API_BASE } from '../config';

const TOKEN_KEY = 'as_token';
const USER_KEY  = 'as_user';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
  getUser: () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  setUser: (u: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** True only when the request never reached the server (offline / DNS / CORS). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

export function errorMessage(err: unknown): string {
  if (isNetworkError(err)) return 'Cannot reach the server — check your connection';
  return err instanceof Error ? err.message : String(err);
}

// Called on 401 so the app can drop back to the login screen.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

function authHeaders(json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const t = tokenStore.get();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function handle(r: Response): Promise<Response> {
  if (r.ok) return r;
  const data = await r.json().catch(() => ({} as { error?: string }));
  if (r.status === 401 && onUnauthorized) onUnauthorized();
  throw new ApiError(data.error || `Request failed (HTTP ${r.status})`, r.status);
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

// ── "Server is waking up" signal ─────────────────────────────────────────────
// The free hosting plan sleeps when idle, so the first request can take ~30 s.
// Requests still running after 4 s count as slow; the banner shows while any are.
let slowCount = 0;
const slowListeners = new Set<() => void>();
export const slowRequests = {
  get: () => slowCount,
  subscribe: (cb: () => void) => { slowListeners.add(cb); return () => { slowListeners.delete(cb); }; },
};
async function timed<T>(work: Promise<T>): Promise<T> {
  let slow = false;
  const t = setTimeout(() => { slow = true; slowCount++; slowListeners.forEach(l => l()); }, 4000);
  try { return await work; } finally {
    clearTimeout(t);
    if (slow) { slowCount--; slowListeners.forEach(l => l()); }
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: Body } = {}): Promise<T> {
  const isForm = opts.body instanceof FormData;
  const r = await timed(fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: authHeaders(!isForm),
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
  }));
  await handle(r);
  return r.json().catch(() => ({})) as Promise<T>;
}

/** Fetch a protected file (photos, documents) and return a blob: URL for <img>/<a>. */
export async function authedBlobUrl(path: string): Promise<string> {
  const r = await handle(await fetch(API_BASE + path, { headers: authHeaders(false) }));
  return URL.createObjectURL(await r.blob());
}

/** Download a protected endpoint as a file. */
export async function downloadFile(path: string, filename: string, opts: { method?: string; body?: Body } = {}) {
  const r = await handle(await fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: authHeaders(),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }));
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
