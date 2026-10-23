import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import * as misc from '../api/misc';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AreaChart, BarList, ChartCard } from '../components/charts';
import { ConditionTag, GeomIcon, Tag, TypeTag } from '../components/Tags';
import type { Asset } from '../types';
import { CONDITIONS, CONDITION_COLORS, assetKey, compactNaira, formatDate, timeAgo } from '../lib/assets';

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<number | null>(null);
  const [activity, setActivity] = useState<misc.AuditEntry[] | null>(null);
  const [insp, setInsp] = useState<misc.InspectionSummary | null>(null);
  const [hideAlerts, setHideAlerts] = useState(false);

  useEffect(() => {
    // KPIs are computed from the same verified list the registry shows, so the
    // numbers always agree (the /analytics/dashboard endpoint counts Pending
    // and Rejected captures and has no "under maintenance" figure).
    assetsApi.fetchAllAssets().then(setAssets).catch(err => setError(errorMessage(err)));
    if (can('canViewAudit')) misc.recentAudit(6).then(setActivity).catch(() => setActivity([]));
    else setActivity([]);
    if (can('canApprove')) misc.approvalsSummary().then(s => setPending(s.pending)).catch(() => {});
    misc.inspectionSummary().then(setInsp).catch(() => {});
  }, [can]);

  const kpi = useMemo(() => {
    const list = assets || [];
    return {
      total: list.length,
      active: list.filter(a => (a.status || 'Active') === 'Active').length,
      maint: list.filter(a => a.status === 'Under Maintenance').length,
      critical: list.filter(a => a.condition === 'Critical').length,
      value: list.reduce((s, a) => s + (a.valuation?.amount || 0), 0),
    };
  }, [assets]);

  const recent = useMemo(() => [...(assets || [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 6), [assets]);

  const due = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const soon = today.getTime() + 30 * 86400000;
    return (assets || [])
      .filter(a => a.nextInspection && new Date(a.nextInspection).getTime() <= soon)
      .map(a => ({ a, days: Math.round((new Date(a.nextInspection!).setHours(0, 0, 0, 0) - today.getTime()) / 86400000) }))
      .sort((x, y) => x.days - y.days);
  }, [assets]);

  const byCondition = useMemo(() => {
    const list = assets || [];
    const items = CONDITIONS.map(c => ({ label: c, value: list.filter(a => a.condition === c).length, color: CONDITION_COLORS[c] }));
    const unset = list.filter(a => !a.condition).length;
    return unset ? [...items, { label: 'Not set', value: unset, color: '#9aa5b1' }] : items;
  }, [assets]);

  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    (assets || []).forEach(a => counts.set(a.type || 'Unspecified', (counts.get(a.type || 'Unspecified') || 0) + 1));
    const sorted = [...counts].sort((a, b) => b[1] - a[1]);
    // Keep the chart readable: top 7, the rest folded into "Other".
    const top = sorted.slice(0, 7).map(([label, value]) => ({ label, value }));
    const rest = sorted.slice(7).reduce((s, [, v]) => s + v, 0);
    return rest ? [...top, { label: 'Other', value: rest }] : top;
  }, [assets]);

  const captures = useMemo(() => {
    const days: { key: string; label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }), value: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    (assets || []).forEach(a => {
      const t = a.createdAt || a.captureDate; if (!t) return;
      const i = idx.get(new Date(t).toISOString().slice(0, 10));
      if (i != null) days[i].value++;
    });
    return days;
  }, [assets]);

  const loading = assets === null && !error;
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Welcome{firstName ? `, ${firstName}` : ''}</h1>
          <div className="page-sub">Asset overview · verified registry</div>
        </div>
        <Link to="/assets" className="btn btn-ghost btn-sm"><i className="fa-solid fa-database" /> Open registry</Link>
      </header>

      {error && <div className="card form-error" style={{ marginBottom: 16 }}><i className="fa-solid fa-circle-xmark" /> Could not load assets: {error}</div>}

      <div className="kpi-row">
        <Kpi label="Total assets" value={kpi.total} sub="Verified registry" icon="fa-layer-group" tone="blue" loading={loading} />
        <Kpi label="Active" value={kpi.active} sub="Operational" icon="fa-circle-check" tone="green" loading={loading} />
        <Kpi label="Under maintenance" value={kpi.maint} sub="Currently in service" icon="fa-wrench" tone="orange" loading={loading} />
        <Kpi label="Critical" value={kpi.critical} sub="Immediate attention" icon="fa-triangle-exclamation" tone="red" loading={loading} />
        <Kpi label="Total value" value={compactNaira(kpi.value)} sub="Estimated NGN" icon="fa-naira-sign" tone="navy" loading={loading} />
      </div>

      {pending != null && pending > 0 && (
        <div className="alert alert-warn">
          <i className="fa-solid fa-stamp" />
          <span><strong>{pending}</strong> capture{pending === 1 ? '' : 's'} waiting for approval</span>
          <Link to="/approvals" className="btn btn-primary btn-xs" style={{ marginLeft: 'auto' }}>Review now</Link>
        </div>
      )}

      {due.length > 0 && !hideAlerts && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="chart-card-hd">
            <div className="chart-title"><i className="fa-solid fa-bell" style={{ color: 'var(--danger)', marginRight: 6 }} />
              Inspection alerts <Tag tone="red">{due.length}</Tag></div>
            <button className="btn btn-ghost btn-xs" onClick={() => setHideAlerts(true)} aria-label="Dismiss"><i className="fa-solid fa-xmark" /></button>
          </div>
          <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Asset</th><th>Type</th><th>Due</th><th>Status</th><th /></tr></thead>
              <tbody>
                {due.slice(0, 50).map(({ a, days }) => (
                  <tr key={assetKey(a)}>
                    <td><strong>{a.name}</strong><div className="cell-sub">{a.state || ''}</div></td>
                    <td><TypeTag value={a.type} /></td>
                    <td className="mono" style={{ fontSize: 11 }}>{formatDate(a.nextInspection)}</td>
                    <td>{days < 0
                      ? <Tag tone="red"><i className="fa-solid fa-circle-xmark" /> Overdue {Math.abs(days)}d</Tag>
                      : <Tag tone="warn"><i className="fa-solid fa-clock" /> In {days}d</Tag>}</td>
                    <td><Link className="btn btn-ghost btn-xs" to={`/assets/${encodeURIComponent(assetKey(a))}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dash-split">
        <div className="card">
          <div className="chart-card-hd">
            <div><div className="chart-title">Recent captures</div><div className="chart-sub">Latest assets added to the registry</div></div>
            <Link to="/assets?sort=createdAt_desc" className="btn btn-ghost btn-xs">View all <i className="fa-solid fa-arrow-right" /></Link>
          </div>
          <div className="table-wrap">
            {loading ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /></div> : recent.length === 0 ? (
              <div className="empty-state"><div className="empty-title">No assets yet</div></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Name</th><th>Type</th><th>Geometry</th><th>Condition</th><th>Captured</th></tr></thead>
                <tbody>
                  {recent.map(a => (
                    <tr key={assetKey(a)}>
                      <td><Link to={`/assets/${encodeURIComponent(assetKey(a))}`} style={{ color: 'inherit' }}><strong>{a.name}</strong></Link></td>
                      <td><TypeTag value={a.type} /></td>
                      <td><GeomIcon geom={a.geomType} /> <span className="cell-sub">{a.geomType || '—'}</span></td>
                      <td><ConditionTag value={a.condition} /></td>
                      <td className="cell-sub">{timeAgo(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="chart-card-hd">
            <div><div className="chart-title">Activity</div><div className="chart-sub">Recent system events</div></div>
            {can('canViewAudit') && <Link to="/audit" className="btn btn-ghost btn-xs">Audit log</Link>}
          </div>
          <div className="feed">
            {activity === null ? <div className="loading"><i className="fa-solid fa-spinner fa-spin" /></div>
              : activity.length === 0 ? <div className="muted" style={{ fontSize: 12, padding: '8px 0' }}>{can('canViewAudit') ? 'No activity recorded yet.' : 'Activity is visible to roles with audit access.'}</div>
              : activity.map(l => {
                  const who = typeof l.performedBy === 'object' && l.performedBy ? l.performedBy.name : '';
                  return (
                    <div className="feed-item" key={l._id}>
                      <div className="feed-dot" />
                      <div>
                        <div style={{ fontSize: 13 }}>{l.action.replace(/_/g, ' ').toLowerCase()} <strong>{l.entityId || ''}</strong>{l.detail ? ` — ${l.detail}` : ''}</div>
                        <div className="cell-sub">{timeAgo(l.ts || l.createdAt)}{who ? ` · ${who}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
          </div>
          {insp && (
            <div className="insp-strip">
              <div><div className="stats-num">{insp.upcoming}</div><div className="stats-label">Inspections due 7d</div></div>
              <div><div className="stats-num" style={{ color: insp.overdue ? 'var(--danger)' : undefined }}>{insp.overdue}</div><div className="stats-label">Overdue</div></div>
              <div><div className="stats-num">{insp.pending}</div><div className="stats-label">Awaiting review</div></div>
            </div>
          )}
        </div>
      </div>

      <h2 className="section-title">Analytics overview</h2>
      <div className="dash-charts">
        <ChartCard title="By condition" sub="Assets per condition rating" table={byCondition.map(i => [i.label, i.value])}>
          <BarList items={byCondition} />
        </ChartCard>
        <ChartCard title="By type" sub="Top asset types" table={byType.map(i => [i.label, i.value])}>
          <BarList items={byType} />
        </ChartCard>
        <ChartCard title="Captures, last 30 days" sub="New assets per day" table={captures.map(p => [p.label, p.value])}>
          <AreaChart points={captures} />
        </ChartCard>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, icon, tone, loading }: {
  label: string; value: number | string; sub: string; icon: string; tone: string; loading: boolean;
}) {
  return (
    <div className={`card kpi kpi-${tone}`}>
      <div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon"><i className={`fa-solid ${icon}`} /></span></div>
      <div className="kpi-value">{loading ? '—' : typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}
