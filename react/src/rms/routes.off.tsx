import type { ReactNode } from 'react';
import type { RMS_NAV as Nav } from './routes';

// Stand-in for routes.tsx when VITE_RMS=off: no RMS routes, nav or code.
export const RMS_ENABLED = false;
export const rmsPublicRoutes = (loading: ReactNode) => { void loading; return null; };
export const rmsStaffRoutes = () => null;
export const RMS_NAV: typeof Nav | null = null;
