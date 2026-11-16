import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';
import * as reportsApi from '../api/reports';
import type { PublicAsset } from '../api/reports';
import { LOGIN_URL } from '../config';

const ME_DIVISION = 'Monitoring & Evaluation';

// Where a printed asset QR label lands (/a/<id>). M&E division staff go to the
// asset's M&E reports (their inspection work); other signed-in staff go to the
// asset page; anyone else sees the asset's public details and can report a
// problem, which goes to the asset's MDA and to FPAM (routes/public_routes.js).
export default function ScanPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  if (user) {
    const to = user.division === ME_DIVISION ? `/me?asset=${encodeURIComponent(id)}` : `/assets/${encodeURIComponent(id)}`;
    return <Navigate to={to} replace />;
  }
  return <PublicScan id={id} />;
}

function PublicScan({ id }: { id: string }) {
  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [ref, setRef] = useState('');

  useEffect(() => {
    reportsApi.getPublicAsset(id)
      .then(r => { setAsset(r.asset); setCategories(r.categories); })
      .catch(err => setLoadError(errorMessage(err)));
  }, [id]);

  return (
    <div className="privacy-page">
      <div className="privacy-card card scan-card">
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div><div className="login-title">Federal Government property</div><div className="login-sub">Managed by FPAM · Federal Ministry of Housing and Urban Development</div></div>
        </div>

        {!asset && !loadError && <p><i className="fa-solid fa-spinner fa-spin" /> Loading asset details…</p>}
        {loadError && <>
          <p className="form-error">{loadError}</p>
          <p className="scan-id">Asset ID <code>{id}</code></p>
        </>}
        {asset && (
          <dl className="scan-details">
            <dt>Asset</dt><dd><strong>{asset.name}</strong>{asset.type && <span className="cell-sub"> · {asset.type}</span>}</dd>
            {asset.mda && <><dt>Responsible MDA</dt><dd>{asset.mda}</dd></>}
            {(asset.lga || asset.state) && <><dt>Location</dt><dd>{[asset.lga, asset.state].filter(Boolean).join(', ')}</dd></>}
            <dt>Asset ID</dt><dd><code>{asset.assetCode || asset.assetId}</code></dd>
          </dl>
        )}

        {ref ? (
          <div className="scan-done">
            <i className="fa-solid fa-circle-check" />
            <div><strong>Thank you. Your report has been sent.</strong><br />
              Reference <code>{ref}</code>. The responsible MDA and FPAM have been notified. Keep this reference if you need to follow up.</div>
          </div>
        ) : reporting && asset ? (
          <ReportForm id={id} categories={categories} onDone={setRef} onCancel={() => setReporting(false)} />
        ) : (
          <>
            <p>Seen damage, a safety hazard, illegal occupation or misuse? Let FPAM know.</p>
            <div className="scan-actions">
              {asset
                ? <button className="btn btn-primary" onClick={() => setReporting(true)}><i className="fa-solid fa-triangle-exclamation" /> Report a problem</button>
                : <a className="btn btn-primary" href={`/complaint.html?asset=${encodeURIComponent(id)}`}><i className="fa-solid fa-triangle-exclamation" /> Report a problem</a>}
              <a className="btn btn-ghost" href={LOGIN_URL || '/login.html'}><i className="fa-solid fa-right-to-bracket" /> Staff sign-in</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReportForm({ id, categories, onDone, onCancel }: { id: string; categories: string[]; onDone: (ref: string) => void; onCancel: () => void }) {
  const [f, setF] = useState({ category: '', severity: 'Medium', description: '', name: '', phone: '', email: '', website: '' });
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locMsg, setLocMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));

  const shareLocation = () => {
    if (!navigator.geolocation) { setLocMsg('Location is not available on this device'); return; }
    setLocMsg('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      p => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocMsg('Location added'); },
      () => setLocMsg('Could not get your location'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.category) { setError('Choose what kind of problem it is'); return; }
    if (f.description.trim().length < 10) { setError('Describe the problem in a sentence or two'); return; }
    setBusy(true); setError('');
    try { onDone((await reportsApi.submitReport(id, { ...f, ...(loc || {}) })).ref); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="scan-form">
      <h2>Report a problem</h2>
      <div className="form-grid">
        <div className="full"><label className="form-label">What kind of problem? *</label>
          <select className="form-control" value={f.category} onChange={set('category')} required>
            <option value="">Choose…</option>{categories.map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div className="full"><label className="form-label">How serious?</label>
          <div className="scan-sev">{['Low', 'Medium', 'High'].map(s => (
            <label key={s} className={f.severity === s ? 'active' : ''}><input type="radio" name="sev" value={s} checked={f.severity === s} onChange={set('severity')} />{s}</label>
          ))}</div></div>
        <div className="full"><label className="form-label">What did you see? *</label>
          <textarea className="form-control" value={f.description} onChange={set('description')} maxLength={2000} placeholder="Where exactly, and what is wrong" required /></div>
        <div className="full"><button type="button" className="btn btn-ghost btn-sm" onClick={shareLocation}><i className="fa-solid fa-location-crosshairs" /> Add my location</button>
          {locMsg && <span className="cell-sub" style={{ marginLeft: 8 }}>{locMsg}</span>}</div>
        <div className="full cell-sub">Your contact details are optional and only seen by FPAM and the MDA, in case they need to ask you more.</div>
        <div><label className="form-label">Name</label><input className="form-control" value={f.name} onChange={set('name')} maxLength={120} autoComplete="name" /></div>
        <div><label className="form-label">Phone</label><input className="form-control" value={f.phone} onChange={set('phone')} maxLength={30} inputMode="tel" autoComplete="tel" /></div>
        <div className="full"><label className="form-label">Email</label><input className="form-control" type="email" value={f.email} onChange={set('email')} maxLength={160} autoComplete="email" /></div>
        {/* Honeypot for bots: hidden from people. */}
        <input className="hp-field" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden="true" name="website" />
      </div>
      {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
      <div className="scan-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-paper-plane" />} Send report</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
