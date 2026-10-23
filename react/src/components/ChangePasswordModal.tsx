import { useState } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import * as usersApi from '../api/users';
import { errorMessage } from '../api/client';

/** Signed-in user changes their own password. */
export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));

  async function save() {
    if (!f.current) { setError('Enter your current password'); return; }
    if (f.next.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (f.next !== f.confirm) { setError("The new passwords don't match"); return; }
    setBusy(true); setError('');
    try { await usersApi.changePassword(f.current, f.next); toast('Password changed'); onClose(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Change password" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-key'}`} /> Change password</button>
    </>}>
      <form className="form-grid" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="full"><label className="form-label" htmlFor="cp-cur">Current password</label>
          <input id="cp-cur" className="form-control" type="password" autoComplete="current-password" autoFocus value={f.current} onChange={set('current')} /></div>
        <div className="full"><label className="form-label" htmlFor="cp-new">New password</label>
          <input id="cp-new" className="form-control" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={f.next} onChange={set('next')} /></div>
        <div className="full"><label className="form-label" htmlFor="cp-conf">Confirm new password</label>
          <input id="cp-conf" className="form-control" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></div>
        <button type="submit" hidden />
      </form>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}
