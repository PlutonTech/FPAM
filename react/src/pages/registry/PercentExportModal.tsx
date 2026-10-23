import { useState } from 'react';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { ConditionTag } from '../../components/Tags';
import type { Asset } from '../../types';
import { assetKey } from '../../lib/assets';

interface Props { onClose: () => void; onExport: (fmt: assetsApi.ExportFormat, ids: string[]) => void }

/**
 * Export N% of Assessed / Unassessed / all assets. Picks the first N by name
 * (alphabetical, so the result is reproducible) and exports exactly that set.
 */
export default function PercentExportModal({ onClose, onExport }: Props) {
  const [dataset, setDataset] = useState('Assessed');
  const [pct, setPct] = useState(20);
  const [picked, setPicked] = useState<{ list: Asset[]; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function preview() {
    setBusy(true); setError('');
    try {
      const list = await assetsApi.fetchAllAssets(dataset ? { assessed: dataset } : {});
      const p = Math.min(100, Math.max(1, Math.round(pct) || 1));
      setPct(p);
      const count = list.length ? Math.max(1, Math.round(p / 100 * list.length)) : 0;
      const sorted = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setPicked({ list: sorted.slice(0, count), total: list.length });
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  const label = dataset ? dataset.toLowerCase() : 'all';
  const ids = picked?.list.map(assetKey) || [];
  const exportAs = (fmt: assetsApi.ExportFormat) => { onExport(fmt, ids); onClose(); };

  return (
    <Modal title="Percentage export" onClose={onClose} footer={picked && picked.list.length > 0 ? <>
      <button className="btn btn-ghost" onClick={() => exportAs('json')}>JSON</button>
      <button className="btn btn-ghost" onClick={() => exportAs('geojson')}>GeoJSON</button>
      <button className="btn btn-ghost" onClick={() => exportAs('xlsx')}>XLSX</button>
      <button className="btn btn-ghost" onClick={() => exportAs('pdf')}>PDF</button>
      <button className="btn btn-primary" onClick={() => exportAs('csv')}><i className="fa-solid fa-file-csv" /> CSV</button>
    </> : undefined}>
      <div className="form-grid">
        <div><label className="form-label">Data set</label>
          <select className="form-control" value={dataset} onChange={e => { setDataset(e.target.value); setPicked(null); }}>
            <option value="Assessed">Assessed assets</option>
            <option value="Unassessed">Unassessed assets</option>
            <option value="">All assets</option>
          </select></div>
        <div><label className="form-label">Percentage</label>
          <input className="form-control" type="number" min={1} max={100} value={pct}
                 onChange={e => { setPct(Number(e.target.value)); setPicked(null); }} /></div>
      </div>
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={preview} disabled={busy}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} /> Preview
      </button>
      {error && <div className="form-error">{error}</div>}
      {picked && (
        <div style={{ marginTop: 16 }}>
          {picked.total === 0 ? <div className="muted">No {label} assets found.</div> : <>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>
              {picked.list.length.toLocaleString()} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>of {picked.total.toLocaleString()} {label} assets ({pct}%)</span>
            </div>
            <div className="list" style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
              {picked.list.slice(0, 10).map(a => (
                <div className="list-row" key={assetKey(a)}>
                  <div className="list-main"><div>{a.name}</div><div className="id-cell">{assetKey(a)}</div></div>
                  <ConditionTag value={a.condition} />
                </div>
              ))}
              {picked.list.length > 10 && <div className="muted" style={{ fontSize: 12, paddingTop: 8 }}>+ {(picked.list.length - 10).toLocaleString()} more</div>}
            </div>
          </>}
        </div>
      )}
    </Modal>
  );
}
