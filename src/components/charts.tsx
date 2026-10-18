import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';

// Small, dependency-free SVG/HTML charts. Each lives in a ChartCard, which
// provides the title and a table view so no value is hover-only.

interface Tip { x: number; y: number; value: string; label: string }

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <strong>{tip.value}</strong>
      <span>{tip.label}</span>
    </div>
  );
}

export function ChartCard({ title, sub, table, children }: {
  title: string; sub?: string; table: [string, string | number][]; children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="card chart-card">
      <div className="chart-card-hd">
        <div>
          <div className="chart-title">{title}</div>
          {sub && <div className="chart-sub">{sub}</div>}
        </div>
        <button className="btn btn-ghost btn-xs" onClick={() => setShowTable(s => !s)} aria-pressed={showTable}>
          <i className={`fa-solid ${showTable ? 'fa-chart-simple' : 'fa-table'}`} /> {showTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {showTable ? (
        <div className="chart-table-wrap">
          <table className="data-table">
            <tbody>{table.map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{v}</td></tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </div>
  );
}

// ── Horizontal bars, direct-labelled ─────────────────────────────────────────
export interface BarItem { label: string; value: number; color?: string }

export function BarList({ items, color = 'var(--accent)' }: { items: BarItem[]; color?: string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (e: { clientX: number; clientY: number }, i: BarItem) => {
    const r = wrap.current!.getBoundingClientRect();
    setTip({
      x: e.clientX - r.left, y: e.clientY - r.top,
      value: i.value.toLocaleString(),
      label: `${i.label} · ${total ? Math.round(i.value / total * 100) : 0}% of total`,
    });
  };

  if (!items.length) return <div className="chart-empty">No data</div>;
  return (
    <div className="barlist" ref={wrap} onPointerLeave={() => setTip(null)}>
      {items.map(i => (
        <div key={i.label} className="barlist-row" tabIndex={0}
             onPointerMove={e => show(e, i)}
             onFocus={e => { const b = e.currentTarget.getBoundingClientRect(); show({ clientX: b.left + b.width / 2, clientY: b.top }, i); }}
             onBlur={() => setTip(null)}
             aria-label={`${i.label}: ${i.value}`}>
          <span className="barlist-label" title={i.label}>{i.label}</span>
          <span className="barlist-track">
            <span className="barlist-fill" style={{ width: `${(i.value / max) * 100}%`, background: i.color || color }} />
          </span>
          <span className="barlist-value">{i.value.toLocaleString()}</span>
        </div>
      ))}
      <Tooltip tip={tip} />
    </div>
  );
}

// ── Single-series area line with crosshair ───────────────────────────────────
export interface Point { label: string; value: number }

export function AreaChart({ points, height = 190, color = '#4A90D9', unit = '' }: {
  points: Point[]; height?: number; color?: string; unit?: string;
}) {
  // Draw at the container's real pixel width so text never scales down.
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height, pad = { l: 30, r: 12, t: 12, b: 24 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(1, ...points.map(p => p.value));
  const niceMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const x = (i: number) => pad.l + (points.length > 1 ? (i / (points.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z`;
  const ticks = [...new Set([0, niceMax / 2, niceMax].map(v => Math.round(v)))];
  // One x label roughly every 70px, always including the last day.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))));
  const gid = useId();

  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const onMove = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - pad.l) / iw) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };

  let tip: Tip | null = null;
  if (hover != null && wrap.current && svg.current) {
    const r = svg.current.getBoundingClientRect();
    const scale = r.width / W || 1;
    tip = { x: x(hover) * scale, y: y(points[hover].value) * scale, value: `${points[hover].value}${unit}`, label: points[hover].label };
  }

  return (
    <div className="area-wrap" ref={wrap}>
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="area-svg" role="img"
           aria-label={`Line chart, ${points.length} points, peak ${max}`}
           onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={pad.l - 6} y={y(t) + 3} className="axis-text" textAnchor="end">{t}</text>
          </g>
        ))}
        {points.map((p, i) => ((i % every === 0 && points.length - 1 - i >= every / 2) || i === points.length - 1) && (
          <text key={p.label} x={x(i)} y={H - 6} className="axis-text" textAnchor="middle">{p.label}</text>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && <>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="crosshair" />
          <circle cx={x(hover)} cy={y(points[hover].value)} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
        </>}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
