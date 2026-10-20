import { lazy, Suspense, type ReactNode } from 'react';
import { Route } from 'react-router-dom';

// Revenue Management System — phase-one prototype (localStorage only).
// Imported as '@rms-routes'. vite.config.ts swaps this file for routes.off.tsx
// when VITE_RMS=off (the embedded/live build), so none of this code ships there.

const RevenueOverview = lazy(() => import('../pages/revenue/RevenueOverview'));
const RevenueAssets = lazy(() => import('../pages/revenue/RevenueAssets'));
const Valuations = lazy(() => import('../pages/revenue/Valuations'));
const Listings = lazy(() => import('../pages/revenue/Listings'));
const ListingDetail = lazy(() => import('../pages/revenue/ListingDetail'));
const RevenueApprovals = lazy(() => import('../pages/revenue/RevenueApprovals'));
const Billing = lazy(() => import('../pages/revenue/Billing'));
const Ledger = lazy(() => import('../pages/revenue/Ledger'));
const PropertiesPage = lazy(() => import('../pages/rms-public/PropertiesPage'));
const PropertyPage = lazy(() => import('../pages/rms-public/PropertyPage'));
const CustomerAuthPage = lazy(() => import('../pages/rms-public/CustomerAuthPage'));
const CustomerAccountPage = lazy(() => import('../pages/rms-public/CustomerAccountPage'));

export const RMS_ENABLED = true;

/** Public customer portal — outside the staff sign-in; customers have their own accounts. */
export function rmsPublicRoutes(loading: ReactNode) {
  const s = (el: ReactNode) => <Suspense fallback={loading}>{el}</Suspense>;
  return <>
    <Route path="/properties" element={s(<PropertiesPage />)} />
    <Route path="/properties/:id" element={s(<PropertyPage />)} />
    <Route path="/customer/login" element={s(<CustomerAuthPage mode="login" />)} />
    <Route path="/customer/register" element={s(<CustomerAuthPage mode="register" />)} />
    <Route path="/customer" element={s(<CustomerAccountPage />)} />
  </>;
}

/** Staff back-office pages, rendered inside the dashboard Layout. */
export function rmsStaffRoutes() {
  return <>
    <Route path="revenue" element={<RevenueOverview />} />
    <Route path="revenue/assets" element={<RevenueAssets />} />
    <Route path="revenue/valuations" element={<Valuations />} />
    <Route path="revenue/listings" element={<Listings />} />
    <Route path="revenue/listings/:id" element={<ListingDetail />} />
    <Route path="revenue/approvals" element={<RevenueApprovals />} />
    <Route path="revenue/billing" element={<Billing />} />
    <Route path="revenue/ledger" element={<Ledger />} />
  </>;
}

export const RMS_NAV = { title: 'Revenue (demo)', items: [
  { to: '/revenue',            label: 'Revenue overview',   icon: 'fa-sack-dollar', end: true },
  { to: '/revenue/assets',     label: 'Revenue assets',     icon: 'fa-building-flag' },
  { to: '/revenue/valuations', label: 'Valuations',         icon: 'fa-ruler-combined' },
  { to: '/revenue/listings',   label: 'Listings & bids',    icon: 'fa-bullhorn' },
  { to: '/revenue/approvals',  label: 'Committee',          icon: 'fa-gavel' },
  { to: '/revenue/billing',    label: 'Billing & payments', icon: 'fa-file-invoice-dollar' },
  { to: '/revenue/ledger',     label: 'Ledger & audit',     icon: 'fa-book' },
] };
