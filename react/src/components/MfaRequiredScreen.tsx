import { MfaTab } from './AccountSecurityModal';

/**
 * Shown instead of the dashboard to roles that must use two-step sign-in
 * (System Admin, Supervisor, Sub-Head by default) until they've set it up.
 * The server enforces the same rule; this is the friendly side of it.
 */
export default function MfaRequiredScreen({ onEnabled, onDone, onLogout }: { onEnabled: () => void; onDone: () => void; onLogout: () => void }) {
  return (
    <div className="page">
      <div className="card form-section mfa-required">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="logo-icon"><i className="fa-solid fa-shield-halved" /></div>
          <div><h1 className="page-title" style={{ fontSize: 20 }}>Set up two-step sign-in to continue</h1>
            <div className="page-sub">Your role can approve records or manage users, so FPAMAS requires a second step when you sign in.</div></div>
        </div>
        <p style={{ fontSize: 13, marginBottom: 14 }}>You'll need a phone with an authenticator app — Google Authenticator, Microsoft Authenticator or Authy (all free). It takes about a minute.</p>
        <MfaTab onEnabled={onEnabled} onDone={onDone} />
        <p className="cell-sub" style={{ marginTop: 16 }}>No smartphone? Ask a System Admin. <button className="btn-linklike login-link-inline" onClick={onLogout}>Log out</button></p>
      </div>
    </div>
  );
}
