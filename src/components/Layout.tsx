import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { goToLogin } from '../config';
import { approvalsSummary } from '../api/misc';
import { canViewMe, type Perm } from '../auth/permissions';

interface NavItem { to: string; label: string; icon: string; roles?: string[]; perm?: Perm; badge?: 'approvals'; me?: boolean }
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
    { to: '/capture',       label: 'Field Capture', icon: 'fa-location-crosshairs' },
    { to: '/approvals',     label: 'Approvals',     icon: 'fa-stamp', badge: 'approvals', roles: ['Sub-Head', 'Supervisor', 'System Admin'] },
    { to: '/inspections',   label: 'Inspections',   icon: 'fa-clipboard-check', roles: ['System Admin', 'Supervisor', 'Sub-Head', 'GIS Analyst'] },
    { to: '/analytics',     label: 'Analytics',     icon: 'fa-chart-bar' },
    { to: '/users',         label: 'Users',         icon: 'fa-users', roles: ['System Admin'] },
    { to: '/form-requests', label: 'Form Requests', icon: 'fa-file-circle-check', roles: ['System Admin', 'Supervisor', 'Sub-Head', 'GIS Analyst'] },
  ]},
  { title: 'Divisions', items: [
    { to: '/me', label: 'M&E reports', icon: 'fa-clipboard-list', me: true },
  ]},
  { title: 'Data Tools', items: [
    { to: '/ocr',    label: 'OCR Scanner',   icon: 'fa-file-image' },
    { to: '/excel',  label: 'Excel Import',  icon: 'fa-file-excel' },
    { to: '/filedb', label: 'File Database', icon: 'fa-folder-open' },
  ]},
  { title: 'System', items: [
    { to: '/audit',      label: 'Audit Log',  icon: 'fa-clock-rotate-left', perm: 'canViewAudit' },
    { to: '/settings',   label: 'Settings',   icon: 'fa-sliders' },
    { to: '/guidelines', label: 'Guidelines', icon: 'fa-book-open' },
  ]},
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const location = useLocation();

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
        </div>
        <nav className="nav">
          {NAV.map(section => {
            const items = section.items.filter(i => (!i.roles || i.roles.includes(user?.role || '')) && (!i.perm || can(i.perm)) && (!i.me || canViewMe(user)));
            if (!items.length) return null;
            return (
              <div key={section.title}>
                <div className="nav-section">{section.title}</div>
                {items.map(i => (
                  <NavLink key={i.to} to={i.to} className="nav-item" onClick={() => setOpen(false)}>
                    <i className={`fa-solid ${i.icon}`} />{i.label}
                    {i.badge === 'approvals' && pending > 0 && <span className="nav-badge">{pending}</span>}
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
          <button className="icon-btn" title="Log out" aria-label="Log out"
                  onClick={async () => { await logout(); goToLogin(navigate); }}>
            <i className="fa-solid fa-right-from-bracket" />
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="main">
        <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
          <i className="fa-solid fa-bars" />
        </button>
        {/* Pages are lazy-loaded; only the content area waits, the sidebar stays put. */}
        <Suspense fallback={<div className="page loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
