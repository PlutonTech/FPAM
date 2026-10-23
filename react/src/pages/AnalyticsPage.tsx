import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import { errorMessage } from '../api/client';
import { AreaChart, BarList, ChartCard, type BarItem } from '../components/charts';
import type { Asset } from '../types';
import {
  ASSET_TYPES, CONDITIONS, CONDITION_COLORS, NIGERIA_STATES, assetKey, compactNaira, coords, formatNaira, normalizeState, riskScore,
} from '../lib/assets';

const PERIODS: [string, string][] = [['all', 'All time'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last 12 months']];
const DAY = 86400000;

function topN(counts: Map<string, number>, n: number): BarItem[] {
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n).map(([label, value]) => ({ label, value }));
  const rest = sorted.slice(n).reduce((s, [, v]) => s + v, 0);
  return rest ? [...top, { label: `Other (${sorted.length - n})`, value: rest }] : top;
}
const countBy = (list: Asset[], key: (a: Asset) => string) => {
  const m = new Map<string, number>();
  list.forEach(a => { const k = key(a); m.set(k, (m.get(k) || 0) + 1); });
  return m;
};

export default function AnalyticsPage() {
  const [all, setAll] = useState<Asset[] | null>(null);
  const [error, setError] = useState('');
  const [f, setF] = useState({ period: 'all', state: '', type: '', mda: '' });
  const [mdas, setMdas] = useState<string[]>([]);

  useEffect(() => {
    assetsApi.fetchAllAssets().then(setAll).catch(err => setError(errorMessage(err)));
    assetsApi.getMdaNames().then(setMdas);
  }, []);

  // One filtered slice drives every number and chart on the page.
  const list = useMemo(() => {
    const since = f.period === 'all' ? 0 : Date.now() - Number(f.period) * DAY;
    return (all || []).filter(a =>
      (!since || new Date(a.createdAt || a.captureDate || 0).getTime() >= since) &&
      (!f.state || normalizeState(a.state) === f.state) && (!f.type || a.type === f.type) && (!f.mda || a.mda === f.mda));
  }, [all, f]);

  const s = useMemo(() => {
    const assessed = list.filter(a => a.assessed === 'Assessed').length;
    const valued = list.filter(a => a.valuation?.amount);
    const logs = list.flatMap(a => (a.maintenanceLogs || []).map(l => ({ a, cost: l.cost || 0 })));
    return {
      total: list.length,
      assessedPct: list.length ? Math.round(assessed / list.length * 100) : 0,
      atRisk: list.filter(a => a.condition === 'Critical' || a.condition === 'Poor').length,
      value: valued.reduce((t, a) => t + (a.valuation!.amount || 0), 0),
      valuedCount: valued.length,
      spend: logs.reduce((t, l) => t + l.cost, 0),
      noCoords: list.filter(a => !coords(a)).length,
      overdue: list.filter(a => a.nextInspection && new Date(a.nextInspection).getTime() < Date.now()).length,
      highRisk: list.filter(a => riskScore(a) >= 60).length,
    };
  }, [list]);

  const byCondition = useMemo<BarItem[]>(() => {
    const items = CONDITIONS.map(c => ({ label: c, value: list.filter(a => a.condition === c).length, color: CONDITION_COLORS[c] }));
    const unset = list.filter(a => !a.condition).length;
    return unset ? [...items, { label: 'Not set', value: unset, color: '#9aa5b1' }] : items;
  }, [list]);
  const byType = useMemo(() => topN(countBy(list, a => a.type || 'Unspecified'), 8), [list]);
  const byState = useMemo(() => topN(countBy(list, a => normalizeState(a.state) || 'Unknown / invalid'), 10), [list]);
  const byMda = useMemo(() => topN(countBy(list, a => a.mda || 'No MDA'), 8), [list]);
  const byGeom = useMemo(() => [...countBy(list, a => a.geomType || 'Point')].map(([label, value]) => ({ label, value })), [list]);
  const valueByType = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach(a => { if (a.valuation?.amount) m.set(a.type || 'Unspecified', (m.get(a.type || 'Unspecified') || 0) + a.valuation.amount); });
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [list]);

  // Trend: daily for short periods, monthly otherwise.
  const trend = useMemo(() => {
    const monthly = f.period === 'all' || f.period === '365';
    const buckets: { key: string; label: string; value: number }[] = [];
    if (monthly) {
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }), value: 0 });
      }
    } else {
      for (let i = Number(f.period) - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * DAY);
        buckets.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }), value: 0 });
      }
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    list.forEach(a => {
      const t = a.createdAt || a.captureDate; if (!t) return;
      const d = new Date(t);
      const i = idx.get(monthly ? `${d.getFullYear()}-${d.getMonth()}` : d.toISOString().slice(0, 10));
      if (i != null) buckets[i].value++;
    });
    return { points: buckets, monthly };
  }, [list, f.period]);

  const spendTop = useMemo(() => list
    .map(a => ({ a, cost: (a.maintenanceLogs || []).reduce((t, l) => t + (l.cost || 0), 0), n: a.maintenanceLogs?.length || 0 }))
    .filter(x => x.n > 0).sort((x, y) => y.cost - x.cost).slice(0, 10), [list]);

  // Plain-language findings computed from the same slice.
  const insights = useMemo(() => {
    if (!list.length) return [];
    const out: { tone: 'red' | 'warn' | 'green' | 'blue'; text: string }[] = [];
    const pct = (n: number) => `${Math.round(n / list.length * 100)}%`;
    if (s.atRisk) out.push({ tone: 'red', text: `${s.atRisk.toLocaleString()} assets (${pct(s.atRisk)}) are in Poor or Critical condition.` });
    if (s.overdue) out.push({ tone: 'warn', text: `${s.overdue.toLocaleString()} assets are overdue for inspection.` });
    if (s.assessedPct < 50) out.push({ tone: 'warn', text: `Only ${s.assessedPct}% of assets have been assessed.` });
    else out.push({ tone: 'green', text: `${s.assessedPct}% of assets have been assessed.` });
    const unset = byCondition.find(b => b.label === 'Not set')?.value || 0;
    if (unset) out.push({ tone: 'warn', text: `${unset.toLocaleString()} assets have no condition recorded.` });
    if (s.noCoords) out.push({ tone: 'warn', text: `${s.noCoords.toLocaleString()} assets have no GPS coordinates and won't appear on the map.` });
    const invalidState = list.filter(a => !normalizeState(a.state)).length;
    if (invalidState) out.push({ tone: 'warn', text: `${invalidState.toLocaleString()} assets have a missing or unrecognised state value.` });
    if (s.valuedCount < list.length) out.push({ tone: 'blue', text: `${(list.length - s.valuedCount).toLocaleString()} assets (${pct(list.length - s.valuedCount)}) have no valuation, so the total value is understated.` });
    const worstType = byType.filter(t => !t.label.startsWith('Other')).map(t => {
      const items = list.filter(a => (a.type || 'Unspecified') === t.label);
      return { t: t.label, share: items.filter(a => a.condition === 'Critical' || a.condition === 'Poor').length / (items.length || 1), n: items.length };
    }).filter(x => x.n >= 5).sort((a, b) => b.share - a.share)[0];
    if (worstType && worstType.share > 0) out.push({ tone: 'red', text: `${worstType.t} has the highest share of Poor/Critical assets (${Math.round(worstType.share * 100)}%).` });
    return out;
  }, [list, s, byCondition, byType]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const loading = all === null && !error;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <div className="page-sub">Verified registry · {loading ? 'loading…' : `${s.total.toLocaleString()} assets in view`}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print report</button>
      </header>

      <div className="filter-bar">
        <select className="filter-input" value={f.period} onChange={set('period')} aria-label="Captured in">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="filter-input" value={f.state} onChange={set('state')} aria-label="State">
          <option value="">All states</option>{NIGERIA_STATES.map(x => <option key={x}>{x}</option>)}
        </select>
        <select className="filter-input" value={f.type} onChange={set('type')} aria-label="Type">
          <option value="">All types</option>{ASSET_TYPES.map(x => <option key={x}>{x}</option>)}
        </select>
        <select className="filter-input" value={f.mda} onChange={set('mda')} aria-label="MDA" style={{ maxWidth: 280 }}>
          <option value="">All MDAs</option>{mdas.map(x => <option key={x}>{x}</option>)}
        </select>
        {(f.period !== 'all' || f.state || f.type || f.mda) && <button className="btn btn-ghost btn-sm" onClick={() => setF({ period: 'all', state: '', type: '', mda: '' })}><i className="fa-solid fa-xmark" /> Clear</button>}
      </div>

      {error && <div className="card form-error" style={{ marginBottom: 16 }}>Could not load assets: {error}</div>}

      <div className="kpi-row">
        <Kpi label="Assets" value={s.total.toLocaleString()} sub="In current view" tone="blue" loading={loading} />
        <Kpi label="Assessed" value={`${s.assessedPct}%`} sub="Condition assessed" tone="green" loading={loading} />
        <Kpi label="Poor or critical" value={s.atRisk.toLocaleString()} sub={`${s.highRisk.toLocaleString()} high risk score`} tone="red" loading={loading} />
        <Kpi label="Total value" value={compactNaira(s.value)} sub={`${s.valuedCount.toLocaleString()} assets valued`} tone="navy" loading={loading} />
        <Kpi label="Maintenance spend" value={compactNaira(s.spend)} sub="Logged costs" tone="orange" loading={loading} />
      </div>

      {insights.length > 0 && (
        <div className="card insights">
          <div className="chart-title" style={{ marginBottom: 8 }}><i className="fa-solid fa-lightbulb" style={{ color: 'var(--warn)' }} /> Key findings</div>
          <ul>{insights.map((i, k) => <li key={k} className={`insight insight-${i.tone}`}>{i.text}</li>)}</ul>
        </div>
      )}

      <div className="dash-charts" style={{ marginBottom: 16 }}>
        <ChartCard title={trend.monthly ? 'Captures per month' : 'Captures per day'} sub={trend.monthly ? 'Last 12 months' : `Last ${f.period} days`} table={trend.points.map(p => [p.label, p.value])}>
          <AreaChart points={trend.points} />
        </ChartCard>
        <ChartCard title="By condition" sub="Assets per condition rating" table={byCondition.map(i => [i.label, i.value])}><BarList items={byCondition} /></ChartCard>
        <ChartCard title="By type" sub="Top asset types" table={byType.map(i => [i.label, i.value])}><BarList items={byType} /></ChartCard>
        <ChartCard title="By state" sub="Top 10 states" table={byState.map(i => [i.label, i.value])}><BarList items={byState} /></ChartCard>
        <ChartCard title="By MDA" sub="Top 8 agencies" table={byMda.map(i => [i.label, i.value])}><BarList items={byMda} /></ChartCard>
        <ChartCard title="By geometry" sub="How assets are mapped" table={byGeom.map(i => [i.label, i.value])}><BarList items={byGeom} /></ChartCard>
      </div>

      <div className="dash-split">
        <div className="card">
          <div className="chart-card-hd"><div><div className="chart-title">Highest maintenance spend</div><div className="chart-sub">Assets with logged maintenance</div></div></div>
          <div className="table-wrap">
            {spendTop.length === 0 ? <div className="empty-state"><div className="empty-sub">No maintenance logged for assets in view</div></div> : (
              <table className="data-table">
                <thead><tr><th>Asset</th><th>Entries</th><th style={{ textAlign: 'right' }}>Total cost</th></tr></thead>
                <tbody>{spendTop.map(x => (
                  <tr key={assetKey(x.a)}>
                    <td><Link to={`/assets/${encodeURIComponent(assetKey(x.a))}`} style={{ color: 'inherit' }}><strong>{x.a.name}</strong></Link><div className="cell-sub">{x.a.mda || ''}</div></td>
                    <td className="cell-sub">{x.n}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatNaira(x.cost)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
        <div className="card">
          <div className="chart-card-hd"><div><div className="chart-title">Value by type</div><div className="chart-sub">Sum of recorded valuations</div></div></div>
          <div className="table-wrap">
            {valueByType.length === 0 ? <div className="empty-state"><div className="empty-sub">No valuations recorded</div></div> : (
              <table className="data-table">
                <tbody>{valueByType.map(([t, v]) => (
                  <tr key={t}><td>{t}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{compactNaira(v)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, loading }: { label: string; value: string; sub: string; tone: string; loading: boolean }) {
  return (
    <div className={`card kpi kpi-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{loading ? '—' : value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}
