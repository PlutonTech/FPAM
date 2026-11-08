import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ME_DIVISION = 'Monitoring & Evaluation';

// Where a printed asset QR label lands (/a/<id>). M&E division staff go to the
// asset's M&E reports (their inspection work); other signed-in staff go to the
// asset page; anyone else gets a public page with a way to report a problem.
// The public page shows only the asset ID: there's no unauthenticated asset
// lookup on the backend yet, so name/MDA come from the printed label itself.
export default function ScanPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  if (user) {
    const to = user.division === ME_DIVISION ? `/me?asset=${encodeURIComponent(id)}` : `/assets/${encodeURIComponent(id)}`;
    return <Navigate to={to} replace />;
  }

  const report = `/complaint.html?asset=${encodeURIComponent(id)}`;
  return (
    <div className="privacy-page">
      <div className="privacy-card card scan-card">
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div><div className="login-title">Federal Government property</div><div className="login-sub">Managed by FPAM · Federal Ministry of Housing and Urban Development</div></div>
        </div>
        <p>This asset is on the federal public asset register.</p>
        <p className="scan-id">Asset ID <code>{id}</code></p>
        <p>Seen damage, a safety hazard, illegal occupation or misuse? Let FPAM know. Quote the asset ID above.</p>
        <div className="scan-actions">
          <a className="btn btn-primary" href={report}><i className="fa-solid fa-triangle-exclamation" /> Report a problem</a>
          <a className="btn btn-ghost" href="/login.html"><i className="fa-solid fa-right-to-bracket" /> Staff sign-in</a>
        </div>
      </div>
    </div>
  );
}
