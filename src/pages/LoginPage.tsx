import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';
  if (user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo-icon"><i className="fa-solid fa-landmark" /></div>
          <div>
            <div className="login-title">FPAMAS</div>
            <div className="login-sub">Federal Public Asset Management</div>
          </div>
        </div>
        <label className="form-label" htmlFor="email">Email</label>
        <input id="email" className="form-control" type="email" autoComplete="username" required
               value={email} onChange={e => setEmail(e.target.value)} />
        <label className="form-label" htmlFor="password" style={{ marginTop: 14 }}>Password</label>
        <input id="password" className="form-control" type="password" autoComplete="current-password" required
               value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 20 }}>
          {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Signing in…</> : 'Sign in'}
        </button>
        <p className="login-hint">The backend may take ~30s to wake up on first request.</p>
      </form>
    </div>
  );
}
