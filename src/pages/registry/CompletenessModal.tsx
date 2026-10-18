import Modal from '../../components/Modal';
import type { Asset } from '../../types';
import { computeCompleteness, scoreColor } from '../../lib/assets';

export default function CompletenessModal({ assets, onClose }: { assets: Asset[]; onClose: () => void }) {
  const { overall, byField, byMda } = computeCompleteness(assets);
  return (
    <Modal wide title="Data completeness" onClose={onClose}>
      <div className="row" style={{ gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: scoreColor(overall) }}>{overall}%</div>
        <div className="muted" style={{ fontSize: 12 }}>
          overall, across {assets.length.toLocaleString()} selected asset{assets.length === 1 ? '' : 's'} and {byField.length} fields
        </div>
      </div>
      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text3)', margin: '8px 0' }}>By field</h3>
      {byField.map(f => (
        <div className="bar-row" key={f.key}>
          <span>{f.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${f.pct}%`, background: scoreColor(f.pct) }} /></div>
          <span style={{ textAlign: 'right', fontWeight: 700 }}>{f.pct}%</span>
        </div>
      ))}
      <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text3)', margin: '18px 0 8px' }}>Weakest MDAs</h3>
      {byMda.slice(0, 10).map(m => (
        <div className="bar-row" key={m.name} title={`${m.count} assets`}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${m.score}%`, background: scoreColor(m.score) }} /></div>
          <span style={{ textAlign: 'right', fontWeight: 700 }}>{m.score}%</span>
        </div>
      ))}
    </Modal>
  );
}
