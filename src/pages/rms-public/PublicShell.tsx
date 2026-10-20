import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { signOutCustomer, useCustomer } from '../../rms/customerSession';
import { DemoBadge } from '../../rms/ui';

export default function PublicShell({ children }: { children: ReactNode }) {
  const customer = useCustomer();
  const navigate = useNavigate();
  return (
    <div className="pub">
      <header className="pub-hd">
        <Link to="/properties" className="pub-brand">
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div><div className="pub-title">FPAM Available Properties</div><div className="pub-sub">Federal public assets for sale, lease and auction</div></div>
        </Link>
        <nav className="pub-nav">
          <NavLink to="/properties" end>Properties</NavLink>
          {customer ? <>
            <NavLink to="/customer">My account</NavLink>
            <button className="btn btn-ghost btn-sm" onClick={() => { signOutCustomer(); navigate('/properties'); }}><i className="fa-solid fa-right-from-bracket" /> Sign out</button>
          </> : <>
            <NavLink to="/customer/login">Sign in</NavLink>
            <Link to="/customer/register" className="btn btn-primary btn-sm">Register</Link>
          </>}
        </nav>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-ft">
        <DemoBadge />
        <span>Payments are collected through Remita into the Consolidated Revenue Fund (TSA). FPAM is the collecting agency.</span>
      </footer>
    </div>
  );
}
