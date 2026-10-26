import { useState } from 'react';
import QRCode from 'qrcode';
import Modal from './Modal';
import { useToast } from './Toast';
import * as usersApi from '../api/users';
import * as security from '../api/security';
import { errorMessage, tokenStore } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BASENAME, LOGIN_URL } from '../config';

type Tab = 'password' | 'mfa' | 'sessions';

/** The signed-in user's own security: password, two-step sign-in, sessions. */
export default function AccountSecurityModal({ onClose, initialTab = 'password' }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <Modal title="Account security" onClose={onClose} footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}>
      <div className="seg" style={{ marginBottom: 14 }}>
        {([['password', 'Password', 'fa-key'], ['mfa', 'Two-step sign-in', 'fa-shield-halved'], ['sessions', 'Sessions', 'fa-laptop']] as const).map(([k, l, i]) => (
          <button key={k} type="button" className={`seg-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${i}`} /> {l}</button>
        ))}
      </div>
      {tab === 'password' && <PasswordTab onDone={onClose} />}
      {tab === 'mfa' && <MfaTab />}
      {tab === 'sessions' && <SessionsTab />}
    </Modal>
  );
}

function PasswordTab({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { finishLogin } = useAuth();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));

  async function save() {
    if (!f.current) { setError('Enter your current password'); return; }
    if (f.next.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (f.next !== f.confirm) { setError("The new passwords don't match"); return; }
    setBusy(true); setError('');
    try {
      const r = await usersApi.changePassword(f.current, f.next);
      if (r.token) finishLogin(r.token);       // this device stays signed in; others are signed out
      toast('Password changed — you have been signed out on your other devices');
      onDone();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="full"><label className="form-label" htmlFor="cp-cur">Current password</label>
        <input id="cp-cur" className="form-control" type="password" autoComplete="current-password" autoFocus value={f.current} onChange={set('current')} /></div>
      <div className="full"><label className="form-label" htmlFor="cp-new">New password</label>
        <input id="cp-new" className="form-control" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={f.next} onChange={set('next')} /></div>
      <div className="full"><label className="form-label" htmlFor="cp-conf">Confirm new password</label>
        <input id="cp-conf" className="form-control" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></div>
      {error && <div className="full form-error" style={{ marginTop: 0 }}><i className="fa-solid fa-circle-xmark" /> {error}</div>}
      <div className="full"><button className="btn btn-primary" disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-key'}`} /> Change password</button></div>
    </form>
  );
}

/** Two-step sign-in setup/status. Also used by the "required" screen (MfaRequiredScreen). */
export function MfaTab({ onEnabled, onDone }: { onEnabled?: () => void; onDone?: () => void } = {}) {
  const { user, finishLogin } = useAuth();
  const toast = useToast();
  const enabled = !!user?.mfa?.enabled;
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Keep the stored user in step after turning it on/off.
  const refreshUser = async () => { try { const u = await security.me(); finishLogin(tokenStore.get() || '', u); } catch { /* ignore */ } };

  async function begin() {
    setBusy(true); setError('');
    try {
      const s = await security.startMfaSetup();
      setSetup({ ...s, qr: await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 200 }) });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true); setError('');
    try { const r = await security.enableMfa(code); setCodes(r.recoveryCodes); setSetup(null); setCode(''); onEnabled?.(); await refreshUser(); toast('Two-step sign-in is on'); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true); setError('');
    try { await security.disableMfa(password); setPassword(''); await refreshUser(); toast('Two-step sign-in is off'); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  if (codes) return (
    <div>
      <div className="form-ok" style={{ marginBottom: 10 }}><i className="fa-solid fa-circle-check" /> Two-step sign-in is on.</div>
      <p style={{ fontSize: 13, marginBottom: 8 }}><strong>Save these recovery codes now.</strong> If you lose your phone, each one lets you sign in once. They won't be shown again.</p>
      <div className="recovery-codes">{codes.map(c => <code key={c}>{c}</code>)}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(codes.join('\n')).then(() => toast('Copied'))}><i className="fa-solid fa-copy" /> Copy</button>
        <button className="btn btn-primary btn-sm" onClick={() => { setCodes(null); onDone?.(); }}>I've saved them</button>
      </div>
    </div>
  );

  if (enabled) return (
    <div>
      <div className="form-ok" style={{ marginBottom: 12 }}><i className="fa-solid fa-shield-halved" /> Two-step sign-in is on{user?.mfa?.enabledAt ? ` since ${new Date(user.mfa.enabledAt).toLocaleDateString('en-NG')}` : ''}. Signing in needs your password and a code from your authenticator app.</div>
      <label className="form-label" htmlFor="mfa-off-pw">To turn it off, enter your password</label>
      <input id="mfa-off-pw" className="form-control" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
      <button className="btn btn-danger btn-sm" style={{ marginTop: 10 }} disabled={busy || !password} onClick={turnOff}>Turn off two-step sign-in</button>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 13, marginBottom: 10 }}>Add a second step to signing in: after your password, enter a 6-digit code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy…). Someone who learns your password still can't get in.</p>
      {!setup ? (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={begin}><i className="fa-solid fa-shield-halved" /> Set up two-step sign-in</button>
      ) : (
        <div className="mfa-setup">
          <img src={setup.qr} alt="QR code to scan with your authenticator app" width={180} height={180} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <ol style={{ fontSize: 13, paddingLeft: 18, margin: '0 0 10px', lineHeight: 1.7 }}>
              <li>Open your authenticator app and scan this code.</li>
              <li>Can't scan? Enter this key: <code className="mfa-key">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code></li>
              <li>Type the 6-digit code the app shows.</li>
            </ol>
            <input className="form-control" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Code from the app" />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={busy || code.length !== 6} onClick={confirm}>Turn on</button>
          </div>
        </div>
      )}
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </div>
  );
}

function SessionsTab() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div>
      <p style={{ fontSize: 13, marginBottom: 10 }}>Signed in on a shared or lost device? <strong>Sign out everywhere</strong> ends every session, on every device — including this one — so you'll need to sign in again here.</p>
      <p className="cell-sub" style={{ marginBottom: 12 }}>Changing your password also signs out your other devices.</p>
      {!confirmed
        ? <button className="btn btn-danger btn-sm" onClick={() => setConfirmed(true)}><i className="fa-solid fa-right-from-bracket" /> Sign out everywhere…</button>
        : <div className="row">
            <span style={{ fontSize: 13 }}>Sure? You'll be signed out here too.</span>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={async () => {
              setBusy(true);
              // Full page load, so no stale signed-in state survives.
              try { await security.logoutAll(); tokenStore.clear(); window.location.href = LOGIN_URL || `${BASENAME}/login`; }
              catch (err) { toast(errorMessage(err), 'error'); setBusy(false); }
            }}>Yes, sign out everywhere</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmed(false)}>Cancel</button>
          </div>}
    </div>
  );
}
