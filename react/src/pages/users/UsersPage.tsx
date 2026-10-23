import { useCallback, useEffect, useMemo, useState } from 'react';
import * as usersApi from '../../api/users';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Tag } from '../../components/Tags';
import { NIGERIA_STATES, formatDate, timeAgo, type Tone } from '../../lib/assets';
import type { ManagedUser, PermKey, RoleConfig } from '../../api/users';

const ROLE_TONE: Record<string, Tone> = {
  'System Admin': 'red', Supervisor: 'blue', 'Sub-Head': 'orange', 'GIS Analyst': 'green', 'Field Agent': 'gray', 'MDA Agent': 'warn',
};
const initials = (n: string) => n.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

type ModalState = { kind: 'create' } | { kind: 'edit'; user: ManagedUser } | { kind: 'perms'; user: ManagedUser }
  | { kind: 'reset'; user: ManagedUser } | { kind: 'password'; user: ManagedUser; result: usersApi.ResetResult } | null;

export default function UsersPage() {
  const { user: me, can } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [tab, setTab] = useState<'users' | 'roles'>('users');

  const load = useCallback(async () => {
    setError('');
    try { setUsers(await usersApi.listUsers()); } catch (err) { setError(errorMessage(err)); setUsers([]); }
    usersApi.getRoleConfigs().then(setRoleConfigs).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (users || []).filter(u =>
      (showInactive || u.isActive !== false) && (!role || u.role === role) &&
      (!t || [u.name, u.email, u.userId, u.mda, u.division].some(v => (v || '').toLowerCase().includes(t))));
  }, [users, q, role, showInactive]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (users || []).filter(u => u.isActive !== false).forEach(u => m.set(u.role, (m.get(u.role) || 0) + 1));
    return m;
  }, [users]);

  if (me?.role !== 'System Admin') {
    return <div className="page"><div className="card empty-state"><div className="empty-icon"><i className="fa-solid fa-lock" /></div>
      <div className="empty-title">System Admins only</div><div className="empty-sub">Ask a System Admin to manage user accounts.</div></div></div>;
  }

  async function toggleActive(u: ManagedUser) {
    const reactivate = u.isActive === false;
    if (!confirm(reactivate ? `Reactivate ${u.name}?` : `Deactivate ${u.name}? They lose access immediately.`)) return;
    try {
      if (reactivate) await usersApi.updateUser(u._id, { isActive: true });
      else await usersApi.deactivateUser(u._id);
      toast(reactivate ? `${u.name} reactivated` : `${u.name} deactivated`);
      load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  const resetPw = (u: ManagedUser) => setModal({ kind: 'reset', user: u });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Users & roles</h1>
          <div className="page-sub">{(users || []).filter(u => u.isActive !== false).length} active accounts</div>
        </div>
        {tab === 'users' && <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: 'create' })}><i className="fa-solid fa-user-plus" /> Add user</button>}
      </header>

      <div className="tab-bar card" role="tablist" style={{ marginBottom: 14 }}>
        <button role="tab" aria-selected={tab === 'users'} className={`tab-btn${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}><i className="fa-solid fa-users" /> Users</button>
        <button role="tab" aria-selected={tab === 'roles'} className={`tab-btn${tab === 'roles' ? ' active' : ''}`} onClick={() => setTab('roles')}><i className="fa-solid fa-shield-halved" /> Role permissions</button>
      </div>

      {tab === 'roles' ? <RoleDefaults configs={roleConfigs} canEdit={can('canManageSettings')} onChange={load} /> : <>
        <div className="filter-bar">
          <div className="search"><i className="fa-solid fa-magnifying-glass" />
            <input className="filter-input" placeholder="Search name, email, MDA…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search users" /></div>
          <select className="filter-input" value={role} onChange={e => setRole(e.target.value)} aria-label="Role">
            <option value="">All roles</option>
            {usersApi.ROLES.map(r => <option key={r} value={r}>{r}{counts.get(r) ? ` (${counts.get(r)})` : ''}</option>)}
          </select>
          <label className="check-label"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show deactivated</label>
        </div>

        <div className="card table-wrap">
          {users === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div>
            : error ? <div className="empty-state"><div className="empty-title">Could not load users</div><div className="empty-sub">{error}</div></div>
            : shown.length === 0 ? <div className="empty-state"><div className="empty-title">No users match</div></div>
            : (
              <table className="data-table">
                <thead><tr><th>User</th><th>Role</th><th>Division / MDA</th><th>Scope</th><th>Overrides</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {shown.map(u => {
                    const overrides = Object.keys(u.permissions || {}).filter(k => typeof (u.permissions as Record<string, unknown>)[k] === 'boolean').length;
                    const isMe = u._id === me?._id;
                    return (
                      <tr key={u._id} className={u.isActive === false ? 'row-muted' : undefined}>
                        <td>
                          <div className="row" style={{ flexWrap: 'nowrap' }}>
                            <span className="avatar" style={{ background: u.color || 'var(--accent)' }}>{initials(u.name)}</span>
                            <div><strong>{u.name}</strong>{isMe && <span className="cell-sub"> (you)</span>}<div className="cell-sub">{u.email}</div></div>
                          </div>
                        </td>
                        <td><Tag tone={ROLE_TONE[u.role] || 'gray'}>{u.role}</Tag></td>
                        <td style={{ fontSize: 12 }}>{u.role === 'MDA Agent' ? (u.mda || '—') : (usersApi.CROSS_DIVISION.includes(u.role) ? 'All divisions' : (u.division || '—'))}</td>
                        <td className="cell-sub">{[u.zone, (u.states || []).join(', ')].filter(Boolean).join(' · ') || 'All'}</td>
                        <td>{overrides ? <Tag tone="warn">{overrides} custom</Tag> : <span className="cell-sub">Role default</span>}</td>
                        <td className="cell-sub" title={formatDate(u.createdAt)}>{timeAgo(u.createdAt)}</td>
                        <td>{u.isActive === false ? <Tag tone="gray">Deactivated</Tag> : <Tag tone="green">Active</Tag>}</td>
                        <td>
                          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                            <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => setModal({ kind: 'edit', user: u })}><i className="fa-solid fa-pen" /></button>
                            {u.role !== 'System Admin' && <button className="btn btn-ghost btn-xs" title="Permissions" onClick={() => setModal({ kind: 'perms', user: u })}><i className="fa-solid fa-shield-halved" /></button>}
                            <button className="btn btn-ghost btn-xs" title="Reset password" onClick={() => resetPw(u)}><i className="fa-solid fa-key" /></button>
                            {!isMe && (u.isActive === false
                              ? <button className="btn btn-secondary btn-xs" onClick={() => toggleActive(u)}>Reactivate</button>
                              : <button className="btn btn-danger btn-xs" title="Deactivate" onClick={() => toggleActive(u)}><i className="fa-solid fa-user-slash" /></button>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      </>}

      {(modal?.kind === 'create' || modal?.kind === 'edit') && (
        <UserFormModal user={modal.kind === 'edit' ? modal.user : undefined} isMe={modal.kind === 'edit' && modal.user._id === me?._id}
                       onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.kind === 'perms' && (
        <PermissionsModal user={modal.user} base={roleConfigs.find(c => c.role === modal.user.role)?.defaults}
                          onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.kind === 'reset' && (
        <ResetPasswordModal user={modal.user} onClose={() => setModal(null)}
                            onDone={result => setModal({ kind: 'password', user: modal.user, result })} />
      )}
      {modal?.kind === 'password' && (() => {
        const { tempPassword, emailed, emailError } = modal.result;
        return (
          <Modal title={`Password reset for ${modal.user.name}`} onClose={() => setModal(null)} footer={
            <button className="btn btn-primary" onClick={() => setModal(null)}>Done</button>}>
            {emailed && <div className="form-ok" style={{ marginBottom: 12 }}><i className="fa-solid fa-envelope-circle-check" /> The new password was emailed to {modal.user.email}.</div>}
            {emailError && <div className="form-error" style={{ marginTop: 0, marginBottom: 12 }}><i className="fa-solid fa-triangle-exclamation" /> The email could not be sent ({emailError === 'not configured' ? 'email is not set up on the server yet' : emailError}). Share the password another way.</div>}
            {tempPassword ? <>
              <p style={{ fontSize: 13, marginBottom: 10 }}>{emailed ? 'For your records, the' : 'Share this'} temporary password securely. It won't be shown again.</p>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <code className="temp-pw">{tempPassword}</code>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(tempPassword).then(() => toast('Copied'))}><i className="fa-solid fa-copy" /> Copy</button>
              </div>
            </> : <p style={{ fontSize: 13 }}>The password you chose is now active. Their old password no longer works.</p>}
          </Modal>
        );
      })()}
    </div>
  );
}

// ── Admin password reset ─────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose, onDone }: { user: ManagedUser; onClose: () => void; onDone: (r: usersApi.ResetResult) => void }) {
  const [mode, setMode] = useState<'generate' | 'set'>('generate');
  const [pw, setPw] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (mode === 'set' && pw.length < 8) { setError('Password must be at least 8 characters'); return; }
    setBusy(true); setError('');
    try { onDone(await usersApi.resetPassword(user._id, { password: mode === 'set' ? pw : undefined, sendEmail })); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }

  return (
    <Modal title={`Reset password — ${user.name}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-key'}`} /> Reset password</button>
    </>}>
      <p style={{ fontSize: 13, marginBottom: 12 }}>{user.name}'s current password stops working straight away.</p>
      <div className="pw-mode">
        <label className="check-label"><input type="radio" name="pw-mode" checked={mode === 'generate'} onChange={() => setMode('generate')} /> Generate a temporary password</label>
        <label className="check-label"><input type="radio" name="pw-mode" checked={mode === 'set'} onChange={() => setMode('set')} /> Set a password</label>
      </div>
      {mode === 'set' && <>
        <label className="form-label" htmlFor="rp-new">New password</label>
        <input id="rp-new" className="form-control" type="text" autoComplete="off" placeholder="At least 8 characters" value={pw} onChange={e => setPw(e.target.value)} />
      </>}
      <label className="check-label" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} /> Email the new password to {user.email}
      </label>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}

// ── Create / edit ────────────────────────────────────────────────────────────
function UserFormModal({ user, isMe, onClose, onDone }: { user?: ManagedUser; isMe: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const editing = !!user;
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', password: '', role: user?.role || 'Field Agent',
    division: user?.division && user.division !== 'All' ? user.division : 'Assets & Condition',
    mda: user?.mda || '', zone: user?.zone || '', states: user?.states || [] as string[],
  });
  const [sendCredentials, setSendCredentials] = useState(true);
  const [mdas, setMdas] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { assetsApi.getMdaNames().then(setMdas); }, []);

  const isMda = form.role === 'MDA Agent';
  const cross = usersApi.CROSS_DIVISION.includes(form.role);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim() || (!editing && (!form.email.trim() || !form.password))) { setError('Name, email and password are required'); return; }
    if (!editing && form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (isMda && !form.mda) { setError('Choose the MDA this agent belongs to'); return; }
    const body: Record<string, unknown> = {
      name: form.name.trim(), role: form.role,
      division: cross ? 'All' : isMda ? null : form.division,
      mda: isMda ? form.mda : null, zone: form.zone, states: form.states,
    };
    if (!editing) Object.assign(body, { email: form.email.trim(), password: form.password, sendCredentials });
    setBusy(true); setError('');
    try {
      if (editing) { await usersApi.updateUser(user!._id, body); toast(`${form.name} updated`); }
      else {
        const r = await usersApi.createUser(body);
        if (sendCredentials && !r.emailed) toast(`${form.name} added — but the welcome email could not be sent${r.emailError === 'not configured' ? ' (email not set up on the server)' : ''}. Share the login details yourself.`, 'error');
        else toast(`${form.name} added as ${form.role}${r.emailed ? ' — login details emailed' : ''}`);
      }
      onDone();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={editing ? `Edit ${user!.name}` : 'Add user'} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : editing ? 'fa-floppy-disk' : 'fa-user-plus'}`} /> {editing ? 'Save' : 'Create user'}</button>
    </>}>
      <div className="form-grid">
        <div className="full"><label className="form-label">Full name</label><input className="form-control" value={form.name} onChange={set('name')} placeholder="e.g. Ngozi Adamu" /></div>
        {!editing && <>
          <div className="full"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={set('email')} placeholder="user@agency.gov.ng" /></div>
          <div className="full"><label className="form-label">Password</label><input className="form-control" type="password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" autoComplete="new-password" /></div>
          <div className="full"><label className="check-label">
            <input type="checkbox" checked={sendCredentials} onChange={e => setSendCredentials(e.target.checked)} /> Email the sign-in details to this user
          </label></div>
        </>}
        <div><label className="form-label">Role</label>
          <select className="form-control" value={form.role} onChange={set('role')} disabled={isMe} title={isMe ? "You can't change your own role" : undefined}>
            {usersApi.ROLES.map(r => <option key={r}>{r}</option>)}
          </select></div>
        {isMda ? (
          <div><label className="form-label">MDA</label>
            <select className="form-control" value={form.mda} onChange={set('mda')}>
              <option value="">— Select MDA —</option>{(form.mda && !mdas.includes(form.mda) ? [form.mda, ...mdas] : mdas).map(m => <option key={m}>{m}</option>)}
            </select></div>
        ) : (
          <div><label className="form-label">Division</label>
            <select className="form-control" value={cross ? 'All' : form.division} onChange={set('division')} disabled={cross}>
              {cross ? <option value="All">All divisions</option> : usersApi.DIVISIONS.map(d => <option key={d}>{d}</option>)}
            </select></div>
        )}
        <div><label className="form-label">Zone</label>
          <select className="form-control" value={form.zone} onChange={set('zone')}>
            <option value="">— No zone —</option>{usersApi.ZONES.map(z => <option key={z}>{z}</option>)}
          </select></div>
        <div><label className="form-label">States in scope</label>
          <select className="form-control" multiple size={4} value={form.states}
                  onChange={e => setForm(f => ({ ...f, states: Array.from(e.target.selectedOptions, o => o.value) }))}>
            {NIGERIA_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="cell-sub">Ctrl/⌘-click for several. None = all states.</div></div>
      </div>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}

// ── Per-user overrides ───────────────────────────────────────────────────────
// Each permission is "role default" (no override), "allow" or "deny". Only
// explicit overrides are saved, so a later change to the role still applies.
function PermissionsModal({ user, base, onClose, onDone }: {
  user: ManagedUser; base?: Record<PermKey, boolean>; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [ov, setOv] = useState<Partial<Record<PermKey, boolean>>>(() =>
    Object.fromEntries(Object.entries(user.permissions || {}).filter(([, v]) => typeof v === 'boolean')) as Partial<Record<PermKey, boolean>>);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try { await usersApi.setUserPermissions(user._id, ov); toast('Permissions saved'); onDone(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Modal wide title={`Permissions — ${user.name}`} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={() => setOv({})}>Clear all overrides</button>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={busy}><i className="fa-solid fa-shield-halved" /> Save</button>
    </>}>
      <p className="cell-sub" style={{ marginBottom: 12 }}>"Role default" follows the {user.role} role{base ? '' : ' (role defaults could not be loaded)'}. Allow or deny to override it for this user only.</p>
      <div className="perm-grid">
        {usersApi.PERM_KEYS.map(k => {
          const v = ov[k];
          const def = base?.[k];
          const effective = typeof v === 'boolean' ? v : def;
          return (
            <div key={k} className="perm-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{usersApi.PERM_LABELS[k]}</div>
                <div className="cell-sub">Effective: {effective === undefined ? '—' : effective ? 'Allowed' : 'Denied'}</div>
              </div>
              <div className="seg" role="radiogroup" aria-label={usersApi.PERM_LABELS[k]}>
                {([['default', `Role default${def === undefined ? '' : def ? ' (on)' : ' (off)'}`], ['allow', 'Allow'], ['deny', 'Deny']] as const).map(([key, label]) => {
                  const active = key === 'default' ? v === undefined : key === 'allow' ? v === true : v === false;
                  return (
                    <button key={key} type="button" role="radio" aria-checked={active} className={`seg-btn${active ? ' active' : ''}`}
                            onClick={() => setOv(o => { const n = { ...o }; if (key === 'default') delete n[k]; else n[k] = key === 'allow'; return n; })}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Role defaults ────────────────────────────────────────────────────────────
function RoleDefaults({ configs, canEdit, onChange }: { configs: RoleConfig[]; canEdit: boolean; onChange: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, Record<PermKey, boolean>>>({});
  const [busy, setBusy] = useState('');
  const value = (c: RoleConfig) => draft[c.role] || c.defaults;
  const dirty = (c: RoleConfig) => !!draft[c.role] && usersApi.PERM_KEYS.some(k => draft[c.role][k] !== c.defaults[k]);

  async function save(c: RoleConfig) {
    setBusy(c.role);
    try { await usersApi.saveRoleConfig(c.role, value(c)); toast(`${c.role} defaults saved`); setDraft(d => { const n = { ...d }; delete n[c.role]; return n; }); onChange(); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(''); }
  }
  async function resetAll() {
    if (!confirm('Reset every role to the factory defaults?')) return;
    try { await usersApi.resetRoleConfigs(); setDraft({}); toast('Role defaults reset'); onChange(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  }

  if (!configs.length) return <div className="card loading">Loading role permissions…</div>;
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="cell-sub">What each role can do by default. System Admins always have everything; per-user overrides sit on top of these.</p>
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={resetAll}><i className="fa-solid fa-rotate-left" /> Reset to factory defaults</button>}
      </div>
      <div className="card table-wrap">
        <table className="data-table perm-matrix">
          <thead><tr><th>Permission</th>{configs.map(c => <th key={c.role} style={{ textAlign: 'center' }}>{c.role}</th>)}</tr></thead>
          <tbody>
            {usersApi.PERM_KEYS.map(k => (
              <tr key={k}>
                <td>{usersApi.PERM_LABELS[k]}</td>
                {configs.map(c => (
                  <td key={c.role} style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={!!value(c)[k]} disabled={!canEdit} aria-label={`${c.role}: ${usersApi.PERM_LABELS[k]}`}
                           onChange={e => setDraft(d => ({ ...d, [c.role]: { ...value(c), [k]: e.target.checked } }))} />
                  </td>
                ))}
              </tr>
            ))}
            {canEdit && (
              <tr>
                <td />
                {configs.map(c => (
                  <td key={c.role} style={{ textAlign: 'center' }}>
                    <button className="btn btn-primary btn-xs" disabled={!dirty(c) || busy === c.role} onClick={() => save(c)}>Save</button>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
