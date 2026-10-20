import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tag } from '../../components/Tags';
import { useRms } from '../../rms/store';
import { ACCOUNTS, trialBalance, verifyLedger } from '../../rms/domain';
import { naira } from '../../rms/format';
import { Empty, RmsHeader } from '../../rms/ui';

const TABS = [['entries', 'Ledger entries', 'fa-book'], ['trial', 'Trial balance', 'fa-scale-balanced'], ['audit', 'Audit trail', 'fa-clock-rotate-left']] as const;

export default function Ledger() {
  const db = useRms();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'entries';
  const check = useMemo(() => verifyLedger(db), [db]);
  const [tamper, setTamper] = useState<string>('');

  // Changes one amount in a throwaway copy and re-verifies — nothing is saved.
  function simulateTamper() {
    if (!db.ledger.length) return;
    const copy = structuredClone(db);
    const victim = copy.ledger[Math.floor(copy.ledger.length / 2)];
    if (victim.debitKobo) victim.debitKobo += 100; else victim.creditKobo += 100;
    const r = verifyLedger(copy);
    setTamper(r.ok ? 'Not detected (unexpected)' : `Changing ₦1 on entry #${victim.seq} was detected: chain breaks at entry #${r.brokenAt} (${r.reason}). Nothing was saved.`);
  }

  return (
    <div className="page">
      <RmsHeader title="Ledger & audit" sub="Double-entry, append-only, hash-chained. Amounts are stored in kobo; corrections are reversal entries." />
      <div className={`card form-section rms-verify ${check.ok ? 'ok' : 'bad'}`} style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><i className={`fa-solid ${check.ok ? 'fa-shield-halved' : 'fa-triangle-exclamation'}`} /> {check.ok
            ? <><strong>Ledger verified.</strong> {check.count} entries; every hash links to the one before and every transaction balances.</>
            : <><strong>Integrity check failed</strong> at entry #{check.brokenAt}: {check.reason}.</>}</div>
          <button className="btn btn-ghost btn-xs" onClick={simulateTamper}>Simulate tampering</button>
        </div>
        {tamper && <div className="cell-sub" style={{ marginTop: 6, fontSize: 12 }}>{tamper}</div>}
      </div>
      <div className="card">
        <div className="tab-bar">{TABS.map(([k, label, icon]) => <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setParams({ tab: k })}><i className={`fa-solid ${icon}`} /> {label}</button>)}</div>
        {tab === 'entries' && <Entries />}
        {tab === 'trial' && <Trial />}
        {tab === 'audit' && <Audit />}
      </div>
    </div>
  );
}

function Entries() {
  const db = useRms();
  const [account, setAccount] = useState('');
  const rows = [...db.ledger].reverse().filter(e => !account || e.account === account);
  return (
    <div className="tab-body">
      <div className="filter-bar">
        <select className="filter-input" value={account} onChange={e => setAccount(e.target.value)} aria-label="Account">
          <option value="">All accounts</option>{Object.entries(ACCOUNTS).map(([k, v]) => <option key={k} value={k}>{k} {v}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <Empty icon="fa-book" title="No entries" /> : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>#</th><th>Posted</th><th>Transaction</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th><th>Reference</th><th>Hash</th></tr></thead>
          <tbody>{rows.map(e => (
            <tr key={e.seq}>
              <td>{e.seq}</td><td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(e.postedAt).toLocaleString('en-NG')}</td>
              <td className="mono" style={{ fontSize: 11 }}>{e.txnId}</td>
              <td>{e.account}<div className="cell-sub">{ACCOUNTS[e.account]}</div></td>
              <td className="num">{e.debitKobo ? naira(e.debitKobo, { decimals: true }) : ''}</td>
              <td className="num">{e.creditKobo ? naira(e.creditKobo, { decimals: true }) : ''}</td>
              <td style={{ fontSize: 12 }}>{e.refId}<div className="cell-sub">{e.memo}</div></td>
              <td className="mono" style={{ fontSize: 10 }} title={`prev ${e.prevHash}\nhash ${e.hash}`}>{e.hash.slice(0, 10)}…<div className="cell-sub">← {e.prevHash.slice(0, 8)}</div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function Trial() {
  const db = useRms();
  const rows = trialBalance(db);
  const dr = rows.reduce((t, r) => t + r.debit, 0), cr = rows.reduce((t, r) => t + r.credit, 0);
  return (
    <div className="tab-body">
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Account</th><th className="num">Debits</th><th className="num">Credits</th><th className="num">Balance</th></tr></thead>
        <tbody>
          {rows.map(r => <tr key={r.account}><td>{r.account} — {r.name}</td><td className="num">{naira(r.debit, { decimals: true })}</td><td className="num">{naira(r.credit, { decimals: true })}</td>
            <td className="num"><strong>{naira(Math.abs(r.debit - r.credit), { decimals: true })}</strong> {r.debit >= r.credit ? 'Dr' : 'Cr'}</td></tr>)}
          <tr><td><strong>Total</strong></td><td className="num"><strong>{naira(dr, { decimals: true })}</strong></td><td className="num"><strong>{naira(cr, { decimals: true })}</strong></td>
            <td className="num">{dr === cr ? <Tag tone="green">Balanced</Tag> : <Tag tone="red">Out by {naira(Math.abs(dr - cr))}</Tag>}</td></tr>
        </tbody>
      </table></div>
      <p className="cell-sub" style={{ marginTop: 10 }}>Revenue is recognised when a bill is raised (Dr receivables / Cr revenue) and collected when Remita confirms payment (Dr collections / Cr receivables). Collections belong to the Consolidated Revenue Fund via the TSA — FPAM is the collecting agency.</p>
    </div>
  );
}

function Audit() {
  const db = useRms();
  const [q, setQ] = useState('');
  const rows = [...db.audit].reverse().filter(e => !q || [e.actor, e.action, e.entityId, e.detail].some(v => v.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="tab-body">
      <div className="filter-bar"><div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="form-control" placeholder="Search actor, action, reference…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
        <tbody>{rows.slice(0, 300).map(e => (
          <tr key={e.id}><td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(e.at).toLocaleString('en-NG')}</td><td>{e.actor}</td>
            <td><Tag tone="gray">{e.action}</Tag></td><td style={{ fontSize: 12 }}>{e.entity} <span className="mono">{e.entityId}</span></td><td className="cell-sub">{e.detail}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
