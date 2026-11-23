import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { goToLogin } from '../config';
import { approvalsSummary } from '../api/misc';
import { canViewMe, type Perm } from '../auth/permissions';
import { CROSS_DIVISION } from '../api/users';
import AccountSecurityModal from './AccountSecurityModal';
import ErrorBoundary from './ErrorBoundary';
import NotificationBell, { useAlertScan } from './NotificationBell';
import ServerWakeBanner from './ServerWakeBanner';
import MfaRequiredScreen from './MfaRequiredScreen';
import { useOfflineQueue } from '../lib/offlineQueue';
import { RMS_NAV } from '@rms-routes';

interface NavItem { to: string; label: string; icon: string; roles?: string[]; perm?: Perm; badge?: 'approvals' | 'offline'; me?: boolean; end?: boolean; division?: string; soon?: boolean }

const MANAGERS = ['System Admin', 'Supervisor', 'Sub-Head', 'GIS Analyst'];
// Roles whose accounts can approve or administer: nudged to turn on two-step sign-in.
const PRIVILEGED = ['System Admin', 'Supervisor', 'Sub-Head'];
interface NavSection { title: string; items: NavItem[] }

// Same structure as the legacy sidebar. Pages not yet ported open a
// placeholder that links to the legacy dashboard.
const NAV: NavSection[] = [
  { title: 'Platform', items: [
    { to: '/dashboard', label: 'Dashboard',      icon: 'fa-gauge-high' },
    { to: '/map',       label: 'Live Map',       icon: 'fa-map' },
    { to: '/assets',    label: 'Asset Registry', icon: 'fa-database' },
  ]},
  { title: 'Management', items: [
    { to: '/capture',       label: 'Field Capture', icon: 'fa-location-crosshairs', badge: 'offline' },
    { to: '/approvals',     label: 'Approvals',     icon: 'fa-stamp', badge: 'approvals', roles: ['Sub-Head', 'Supervisor', 'System Admin'] },
    { to: '/inspections',   label: 'Inspections',   icon: 'fa-clipboard-check', roles: ['System Admin', 'Supervisor', 'Sub-Head', 'GIS Analyst'] },
    { to: '/analytics',     label: 'Analytics',     icon: 'fa-chart-bar' },
    { to: '/users',         label: 'Users',         icon: 'fa-users', roles: ['System Admin'] },
    { to: '/form-requests', label: 'Form Requests', icon: 'fa-file-circle-check', roles: ['System Admin', 'Supervisor', 'Sub-Head', 'GIS Analyst'] },
    { to: '/data-quality',  label: 'Data Quality',  icon: 'fa-broom', roles: MANAGERS },
    { to: '/reports',       label: 'Public Reports', icon: 'fa-triangle-exclamation', roles: MANAGERS },
    { to: '/news',          label: 'Website News',  icon: 'fa-newspaper', roles: ['System Admin', 'Supervisor'] },
    { to: '/data-quality?mine=1', label: 'My Data Fixes', icon: 'fa-broom', roles: ['Field Agent'] },
  ]},
  // Same list as the legacy sidebar. Cross-division roles see all of them;
  // everyone else only their own division. "soon" ones aren't built yet.
  { title: 'Divisions', items: [
    { to: '/assets', label: 'Assets & Condition',           icon: 'fa-database',         division: 'Assets & Condition' },
    { to: '/me',     label: 'Monitoring & Evaluation',      icon: 'fa-chart-line',       division: 'Monitoring & Evaluation', me: true },
    { to: '#planning',       label: 'Planning & Design',            icon: 'fa-compass-drafting', division: 'Planning & Design', soon: true },
    { to: '#rehabilitation', label: 'Rehabilitation & Restoration', icon: 'fa-helmet-safety',    division: 'Rehabilitation & Restoration', soon: true },
    { to: '/btm',            label: 'Building Training & Maintenance', icon: 'fa-chalkboard-user',  division: 'Building Training & Maintenance' },
  ]},
  // VITE_RMS_NAV=off hides the links; the revenue pages still work by URL.
  ...(RMS_NAV && import.meta.env.VITE_RMS_NAV !== 'off' ? [RMS_NAV] : []),
  { title: 'Data Tools', items: [
    { to: '/ocr',    label: 'OCR Scanner',   icon: 'fa-file-image' },
    { to: '/excel',  label: 'Excel Import',  icon: 'fa-file-excel' },
    { to: '/filedb', label: 'File Database', icon: 'fa-folder-open' },
    { to: '/pdf-tools', label: 'PDF Tools',  icon: 'fa-file-pdf' },
  ]},
  { title: 'System', items: [
    { to: '/audit',      label: 'Audit Log',  icon: 'fa-clock-rotate-left', perm: 'canViewAudit' },
    { to: '/settings',   label: 'Settings',   icon: 'fa-sliders' },
    { to: '/guidelines', label: 'Guidelines', icon: 'fa-book-open' },
    { to: '/system',     label: 'System Health', icon: 'fa-heart-pulse', roles: ['System Admin'] },
    { to: '/privacy',    label: 'Privacy',    icon: 'fa-user-shield' },
  ]},
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [security, setSecurity] = useState<null | 'password' | 'mfa'>(null);
  const [mfaNudgeHidden, setMfaNudgeHidden] = useState(() => sessionStorage.getItem('as_mfa_nudge') === 'hidden');
  const offline = useOfflineQueue();
  useAlertScan();
  const location = useLocation();
  // Required by the server for this role: block the dashboard until it's set
  // up. keepGate holds the screen open while the recovery codes are shown.
  const [keepGate, setKeepGate] = useState(false);
  const showMfaGate = !!user?.mfaSetupRequired || keepGate;
  const showMfaNudge = !showMfaGate && !mfaNudgeHidden && PRIVILEGED.includes(user?.role || '') && !user?.mfa?.enabled;

  // Pending-approvals badge; refreshed on navigation so it drops after reviewing.
  const canApprove = can('canApprove');
  useEffect(() => {
    if (!canApprove) return;
    approvalsSummary().then(s => setPending(s.pending)).catch(() => {});
  }, [canApprove, location.pathname]);

  const initials = (user?.name || 'U').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="logo">
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div>
            <div className="logo-name">FPAMAS</div>
            <div className="logo-sub">Federal Public Asset Management</div>
          </div>
          <NotificationBell className="notif-bell-side" />
        </div>
        <nav className="nav">
          {NAV.map(section => {
            const items = section.items.filter(i => (!i.roles || i.roles.includes(user?.role || '')) && (!i.perm || can(i.perm)) && (!i.me || canViewMe(user))
              && (!i.division || CROSS_DIVISION.includes(user?.role || '') || !user?.division || user.division === 'All' || user.division === i.division));
            if (!items.length) return null;
            return (
              <div key={section.title}>
                <div className="nav-section">{section.title}</div>
                {items.map(i => i.soon ? (
                  <span key={i.to} className="nav-item nav-soon" title="Coming soon" aria-disabled="true">
                    <i className={`fa-solid ${i.icon}`} />{i.label}<span className="nav-soon-tag">Soon</span>
                  </span>
                ) : (
                  <NavLink key={i.to} to={i.to} end={i.end} className="nav-item" onClick={() => setOpen(false)}>
                    <i className={`fa-solid ${i.icon}`} />{i.label}
                    {i.badge === 'approvals' && pending > 0 && <span className="nav-badge">{pending}</span>}
                    {i.badge === 'offline' && offline.count > 0 && <span className="nav-badge" title="Captures saved on this device, waiting to upload"><i className="fa-solid fa-cloud-arrow-up" /> {offline.count}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div className="sidebar-user-text">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-role">{user?.role || '—'}</div>
          </div>
          <button className="icon-btn" title="Account security — password, two-step sign-in, sessions" aria-label="Account security" onClick={() => setSecurity('password')}>
            <i className="fa-solid fa-shield-halved" />
          </button>
          <button className="icon-btn" title="Log out" aria-label="Log out"
                  onClick={async () => { await logout(); goToLogin(navigate); }}>
            <i className="fa-solid fa-right-from-bracket" />
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      {security && <AccountSecurityModal initialTab={security} onClose={() => setSecurity(null)} />}

      <div className="main">
        <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
          <i className="fa-solid fa-bars" />
        </button>
        {/* Phones: the sidebar is off-screen, so the bell floats top-right. */}
        <NotificationBell className="notif-fab" />
        <ServerWakeBanner />
        {showMfaNudge && (
          <div className="mfa-nudge" role="note">
            <i className="fa-solid fa-shield-halved" />
            <span>Your account can approve or administer records. Turn on <strong>two-step sign-in</strong> so a stolen password alone can't be used.</span>
            <button className="btn btn-primary btn-xs" onClick={() => setSecurity('mfa')}>Set it up</button>
            <button className="btn btn-ghost btn-xs" onClick={() => { sessionStorage.setItem('as_mfa_nudge', 'hidden'); setMfaNudgeHidden(true); }}>Later</button>
          </div>
        )}
        {/* Pages are lazy-loaded; only the content area waits, the sidebar stays put. */}
        <ErrorBoundary resetKey={location.pathname}>
          {showMfaGate
            ? <MfaRequiredScreen onEnabled={() => setKeepGate(true)} onDone={() => setKeepGate(false)} onLogout={async () => { await logout(); goToLogin(navigate); }} />
            : <Suspense fallback={<div className="page loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>}>
                <Outlet />
              </Suspense>}
        </ErrorBoundary>
      </div>
    </div>
  );
}
