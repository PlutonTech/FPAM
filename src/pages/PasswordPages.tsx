import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as usersApi from '../api/users';
import { errorMessage } from '../api/client';
import { goToLogin, LOGIN_URL } from '../config';

// Public pages (no sign-in needed): request a reset link, then choose a new
// password from the emailed link (/reset-password?token=…).

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div>
            <div className="login-title">{title}</div>
            <div className="login-sub">FPAMAS · Federal Public Asset Management</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function BackToLogin() {
  const navigate = useNavigate();
  // Embedded in the public site, its login.html is the sign-in page.
  return LOGIN_URL
    ? <a className="login-link" href={LOGIN_URL}>Back to sign in</a>
    : <Link className="login-link" to="/login" onClick={e => { e.preventDefault(); goToLogin(navigate); }}>Back to sign in</Link>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { setDone((await usersApi.forgotPassword(email.trim())).message); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Shell title="Forgot password">
      {done ? (
        <>
          <div className="form-ok"><i className="fa-solid fa-envelope-circle-check" /> {done}</div>
          <p className="login-hint" style={{ textAlign: 'left' }}>The link expires in 1 hour. No email? Check spam, or ask your System Admin to reset your password.</p>
        </>
      ) : (
        <form onSubmit={submit}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>Enter your account email and we'll send you a link to choose a new password.</p>
          <label className="form-label" htmlFor="fp-email">Email</label>
          <input id="fp-email" className="form-control" type="email" autoComplete="username" required autoFocus
                 value={email} onChange={e => setEmail(e.target.value)} />
          {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 18 }}>
            {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Sending…</> : 'Send reset link'}
          </button>
        </form>
      )}
      <BackToLogin />
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (pw !== pw2) { setError("The passwords don't match"); return; }
    setBusy(true); setError('');
    try { await usersApi.resetPasswordWithToken(token, pw); setDone(true); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Shell title="Choose a new password">
      {!token ? (
        <div className="form-error"><i className="fa-solid fa-circle-xmark" /> This link is incomplete. Open the link from your email again, or <Link to="/forgot-password">request a new one</Link>.</div>
      ) : done ? (
        <div className="form-ok"><i className="fa-solid fa-circle-check" /> Password updated. You can sign in with it now.</div>
      ) : (
        <form onSubmit={submit}>
          <label className="form-label" htmlFor="rp-1">New password</label>
          <input id="rp-1" className="form-control" type="password" autoComplete="new-password" required autoFocus
                 placeholder="At least 8 characters" value={pw} onChange={e => setPw(e.target.value)} />
          <label className="form-label" htmlFor="rp-2" style={{ marginTop: 14 }}>Confirm new password</label>
          <input id="rp-2" className="form-control" type="password" autoComplete="new-password" required
                 value={pw2} onChange={e => setPw2(e.target.value)} />
          {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}{/expired|invalid/i.test(error) && <> <Link to="/forgot-password">Request a new link</Link></>}</div>}
          <button className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 18 }}>
            {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : 'Set password'}
          </button>
        </form>
      )}
      <BackToLogin />
    </Shell>
  );
}
