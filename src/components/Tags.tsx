import type { ReactNode } from 'react';
import type { Asset } from '../types';
import { conditionTone, riskScore, typeTone, type Tone } from '../lib/assets';

export function Tag({ tone = 'gray', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`tag tag-${tone}`} title={title}>{children}</span>;
}

export const ConditionTag = ({ value }: { value?: string | null }) =>
  <Tag tone={conditionTone(value)}>{value || 'Not set'}</Tag>;

export const TypeTag = ({ value }: { value?: string }) =>
  <Tag tone={typeTone(value)}>{value || '—'}</Tag>;

export const AssessedTag = ({ value }: { value?: string }) => {
  const v = value || 'Unassessed';
  return <Tag tone={v === 'Assessed' ? 'green' : 'gray'}>{v}</Tag>;
};

export function RiskBadge({ asset }: { asset: Asset }) {
  const s = riskScore(asset);
  if (s >= 60) return <Tag tone="red" title={`Risk score: ${s}/100`}><i className="fa-solid fa-circle-exclamation" /> HIGH {s}</Tag>;
  if (s >= 30) return <Tag tone="warn" title={`Risk score: ${s}/100`}><i className="fa-solid fa-triangle-exclamation" /> MED {s}</Tag>;
  return <Tag tone="green" title={`Risk score: ${s}/100`}><i className="fa-solid fa-circle-check" /> LOW {s}</Tag>;
}

export function GeomIcon({ geom }: { geom?: string }) {
  const icon = { Point: 'fa-location-dot', Polygon: 'fa-draw-polygon', Linear: 'fa-route' }[geom || ''];
  return icon ? <i className={`fa-solid ${icon}`} /> : null;
}
