import { api } from './client';
import type { User } from '../types';

// Two-step sign-in and sessions.
export type LoginResult = { token: string; user: User; mfaRequired?: undefined } | { mfaRequired: true; mfaToken: string; token?: undefined; user?: undefined };

export const verifyMfa = (mfaToken: string, code: string) =>
  api<{ token: string; user: User }>('/auth/mfa/verify', { method: 'POST', body: { mfaToken, code } });
export const startMfaSetup = () => api<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', { method: 'POST' });
export const enableMfa = (code: string) => api<{ recoveryCodes: string[] }>('/auth/mfa/enable', { method: 'POST', body: { code } });
export const disableMfa = (password: string) => api('/auth/mfa/disable', { method: 'POST', body: { password } });
export const logoutAll = () => api('/auth/logout-all', { method: 'POST' });
export const me = () => api<{ user: User }>('/auth/me').then(r => r.user);
