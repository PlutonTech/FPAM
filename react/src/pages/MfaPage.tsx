import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as security from '../api/security';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { LOGIN_URL } from '../config';

const KEY = 'as_mfa_token';

/** Two-step sign-in, second step. Reached from the public login page (embedded build). */
export default function MfaPage() {
  const navigate = useNavigate();
  const { finishLogin } = useAuth();
  const [mfaToken] = useState(() => sessionStorage.getItem(KEY) || '');
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="logo-icon"><i className="fa-solid fa-shield-halved" /></div>
          <div><div className="login-title">Two-step sign-in</div><div className="login-sub">FPAMAS · Federal Public Asset Management</div></div>
        </div>
        {mfaToken
          ? <MfaCodeForm mfaToken={mfaToken} onDone={(token, user) => {
              sessionStorage.removeItem(KEY);
              finishLogin(token, user);
              navigate(user.role === 'MDA Agent' ? '/portal' : '/dashboard', { replace: true });
            }} />
          : <p style={{ fontSize: 13 }}>Your sign-in has expired. {LOGIN_URL ? <a href={LOGIN_URL}>Sign in again</a> : <Link to="/login">Sign in again</Link>}.</p>}
      </div>
    </div>
  );
}

/** Code entry, shared with the dashboard's own login page. */
export function MfaCodeForm({ mfaToken, onDone, onCancel }: { mfaToken: string; onDone: (token: string, user: import('../types').User) => void; onCancel?: () => void }) {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { const r = await security.verifyMfa(mfaToken, code); onDone(r.token, r.user); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        {recovery ? 'Enter one of the recovery codes you saved when you set up two-step sign-in. Each code works once.' : 'Open your authenticator app and enter the 6-digit code for FPAMAS.'}
      </p>
      <label className="form-label" htmlFor="mfa-code">{recovery ? 'Recovery code' : 'Code'}</label>
      <input id="mfa-code" className="form-control mfa-input" autoFocus required autoComplete="one-time-code"
        inputMode={recovery ? 'text' : 'numeric'} maxLength={recovery ? 12 : 6} placeholder={recovery ? 'ABCDE-12345' : '123456'}
        value={code} onChange={e => setCode(recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))} />
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy || (!recovery && code.length !== 6)} style={{ marginTop: 16 }}>
        {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Checking…</> : 'Verify'}
      </button>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <button type="button" className="login-link-inline btn-linklike" onClick={() => { setRecovery(!recovery); setCode(''); setError(''); }}>
          {recovery ? 'Use the app code instead' : 'Lost your phone? Use a recovery code'}
        </button>
        {onCancel && <button type="button" className="login-link-inline btn-linklike" onClick={onCancel}>Back</button>}
      </div>
      <p className="login-hint">No recovery codes left? Ask a System Admin to reset your two-step sign-in.</p>
    </form>
  );
}
