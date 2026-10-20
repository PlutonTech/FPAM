import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { getDb } from '../../rms/store';
import { signInCustomer, useCustomer } from '../../rms/customerSession';
import * as d from '../../rms/domain';
import { useRmsAction } from '../../rms/ui';
import PublicShell from './PublicShell';

export default function CustomerAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const customer = useCustomer();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/customer';
  if (customer) return <Navigate to={next} replace />;
  return (
    <PublicShell>
      <div className="pub-auth card form-section">
        {mode === 'login' ? <Login onDone={() => navigate(next, { replace: true })} /> : <Register onDone={() => navigate(next, { replace: true })} />}
        <p className="cell-sub" style={{ marginTop: 14, textAlign: 'center' }}>
          {mode === 'login'
            ? <>New here? <Link to={`/customer/register${params.toString() ? `?${params}` : ''}`}>Create an account</Link></>
            : <>Already registered? <Link to={`/customer/login${params.toString() ? `?${params}` : ''}`}>Sign in</Link></>}
        </p>
        <p className="cell-sub" style={{ textAlign: 'center' }}>FPAM staff sign in on the staff login page, not here.</p>
      </div>
    </PublicShell>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    try { signInCustomer(d.authenticateCustomer(getDb(), email, password).id); onDone(); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <form onSubmit={submit}>
      <h1 className="section-title" style={{ fontSize: 19 }}>Customer sign in</h1>
      <label className="form-label" htmlFor="cl-e">Email</label>
      <input id="cl-e" className="form-control" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      <label className="form-label" htmlFor="cl-p" style={{ marginTop: 12 }}>Password</label>
      <input id="cl-p" className="form-control" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }}>Sign in</button>
      <div className="pub-demo-hint">Demo accounts (password <code>demo1234</code>): amaka@example.com · sahel@example.com · ibrahim@example.com</div>
    </form>
  );
}

function Register({ onDone }: { onDone: () => void }) {
  const run = useRmsAction();
  const [f, setF] = useState({ type: 'individual' as 'individual' | 'corporate', name: '', idNumber: '', email: '', phone: '', address: '', password: '', confirm: '', consent: false });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));
  const corp = f.type === 'corporate';

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) { setError("The passwords don't match"); return; }
    if (!f.consent) { setError('Please consent to the processing of your data to continue'); return; }
    let msg = '';
    const c = run(db => { try { return d.registerCustomer(db, f); } catch (err) { msg = (err as Error).message; throw err; } }, v => `Welcome, ${v.name} — your customer number is ${v.customerNo}`);
    if (c) { signInCustomer(c.id); onDone(); } else setError(msg);
  }

  return (
    <form onSubmit={submit}>
      <h1 className="section-title" style={{ fontSize: 19 }}>Create a customer account</h1>
      <div className="pw-mode">
        <label className="check-label"><input type="radio" checked={!corp} onChange={() => setF({ ...f, type: 'individual' })} /> Individual</label>
        <label className="check-label"><input type="radio" checked={corp} onChange={() => setF({ ...f, type: 'corporate' })} /> Company / organisation</label>
      </div>
      <div className="form-grid">
        <div className="full"><label className="form-label" htmlFor="r-n">{corp ? 'Registered company name' : 'Full name'}</label><input id="r-n" className="form-control" required value={f.name} onChange={set('name')} /></div>
        <div><label className="form-label" htmlFor="r-id">{corp ? 'RC / BN number' : 'NIN (11 digits)'}</label><input id="r-id" className="form-control" required value={f.idNumber} onChange={set('idNumber')} inputMode={corp ? 'text' : 'numeric'} placeholder={corp ? 'RC 123456' : ''} /></div>
        <div><label className="form-label" htmlFor="r-ph">Phone</label><input id="r-ph" className="form-control" type="tel" required value={f.phone} onChange={set('phone')} /></div>
        <div className="full"><label className="form-label" htmlFor="r-e">Email</label><input id="r-e" className="form-control" type="email" autoComplete="username" required value={f.email} onChange={set('email')} /></div>
        <div className="full"><label className="form-label" htmlFor="r-a">{corp ? 'Registered address' : 'Residential address'}</label><input id="r-a" className="form-control" value={f.address} onChange={set('address')} /></div>
        <div><label className="form-label" htmlFor="r-p">Password</label><input id="r-p" className="form-control" type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} placeholder="At least 8 characters" /></div>
        <div><label className="form-label" htmlFor="r-c">Confirm password</label><input id="r-c" className="form-control" type="password" autoComplete="new-password" required value={f.confirm} onChange={set('confirm')} /></div>
      </div>
      <label className="check-label" style={{ marginTop: 12, whiteSpace: 'normal', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked })} style={{ marginTop: 3 }} />
        <span>I consent to FPAM processing my identity and contact data to handle my applications, in line with the Nigeria Data Protection Act 2023.</span>
      </label>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }}>Create account</button>
      <p className="cell-sub" style={{ marginTop: 8 }}>Your identity is verified by FPAM (KYC) before any award.</p>
    </form>
  );
}
