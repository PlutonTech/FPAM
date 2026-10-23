import { Link } from 'react-router-dom';
import { LOGIN_URL } from '../config';

// Privacy notice for users of the platform (Nigeria Data Protection Act 2023).
// The fuller internal policy — retention periods, roles, breach procedure —
// is in docs/DATA_PROTECTION.md. Keep the two consistent.
export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-card card">
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div><div className="login-title">Privacy notice</div><div className="login-sub">FPAMAS · Federal Public Assets Maintenance Department</div></div>
        </div>

        <p>This notice explains what personal data the Federal Public Asset Management platform (FPAMAS) holds, why, and your rights, in line with the Nigeria Data Protection Act 2023 (NDPA).</p>

        <h2>Who is responsible</h2>
        <p>The Federal Public Assets Maintenance Department (FPAM), Federal Ministry of Housing and Urban Development, is the data controller. Questions or requests: contact FPAM's Data Protection Officer through the department's official channels.</p>

        <h2>What we hold</h2>
        <ul>
          <li><strong>Staff and MDA users:</strong> name, official email, phone number (optional, for SMS alerts), role, division, MDA and the states you cover.</li>
          <li><strong>Sign-in and security records:</strong> sign-in times, IP address, browser, and an audit trail of changes you make to records. Passwords are stored only as one-way hashes; two-step sign-in secrets are never shown again after setup.</li>
          <li><strong>Field data:</strong> asset records, photos and GPS locations you capture. Photo location data is used to place the asset on the map.</li>
          <li><strong>Error reports:</strong> if a page fails, technical details (the page, the error and your browser) are recorded so it can be fixed.</li>
        </ul>

        <h2>Why we use it (lawful basis)</h2>
        <p>To run the federal asset register and its approvals, inspections and compliance processes — a public function of FPAM (NDPA s.25(1)(e)) — and to keep the platform secure. We don't sell data or use it for marketing.</p>

        <h2>Who can see it</h2>
        <p>Access follows your role: managers see records in their scope; System Admins administer accounts. Service providers that host the platform (cloud hosting, database, email/SMS delivery) process data on FPAM's instructions.</p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Asset records and their audit trail: kept as part of the public record.</li>
          <li>Accounts: while you work with FPAM; deactivated accounts are kept for audit, then reviewed.</li>
          <li>In-app notifications: 90 days. Error reports: 30 days.</li>
        </ul>

        <h2>Your rights</h2>
        <p>You can ask to see the personal data held about you, have it corrected, or object to or restrict its use where the law allows. You can change your password, phone number alerts and two-step sign-in yourself under <em>Account security</em>. You may also complain to the Nigeria Data Protection Commission.</p>

        <h2>Security</h2>
        <p>Data is encrypted in transit; accounts can use two-step sign-in, sessions can be ended on every device, uploads are checked before they're stored, and changes are audit-logged.</p>

        <p className="cell-sub" style={{ marginTop: 18 }}>Last updated: October 2026.</p>
        <div style={{ marginTop: 14 }}>{LOGIN_URL ? <a href={LOGIN_URL}>Back to sign in</a> : <Link to="/login">Back to sign in</Link>}</div>
      </div>
    </div>
  );
}
