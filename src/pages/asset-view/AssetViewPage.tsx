import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import AuthedImage from '../../components/AuthedImage';
import { useToast } from '../../components/Toast';
import { AssessedTag, ConditionTag, RiskBadge, Tag, TypeTag } from '../../components/Tags';
import type { Asset } from '../../types';
import { assetKey, coords, formatDate, formatNaira } from '../../lib/assets';
import EditAssetModal from '../registry/EditAssetModal';
import { DocumentsTab, HistoryTab, LocationTab, MaintenanceTab, OverviewTab, PhotosTab, ValuationTab } from './tabs';

const TABS = [
  ['overview', 'Overview', 'fa-circle-info'], ['photos', 'Photos', 'fa-camera'],
  ['location', 'Location', 'fa-map-pin'], ['maintenance', 'Maintenance', 'fa-wrench'],
  ['documents', 'Documents', 'fa-file-lines'], ['valuation', 'Valuation', 'fa-naira-sign'],
  ['history', 'History', 'fa-chart-line'],
] as const;
type TabKey = typeof TABS[number][0];

export default function AssetViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [photoIdx, setPhotoIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [mdas, setMdas] = useState<string[]>([]);

  const reload = useCallback(async () => {
    try { setAsset(await assetsApi.getAsset(id)); setError(''); }
    catch (err) { setError(errorMessage(err)); }
  }, [id]);

  useEffect(() => { setAsset(null); reload(); }, [reload]);
  useEffect(() => { if (editing && !mdas.length) assetsApi.getMdaNames().then(setMdas); }, [editing, mdas.length]);

  if (error) return (
    <div className="page">
      <Link to="/assets" className="back-link"><i className="fa-solid fa-arrow-left" /> Back to registry</Link>
      <div className="card empty-state">
        <div className="empty-icon"><i className="fa-solid fa-circle-exclamation" /></div>
        <div className="empty-title">Could not load asset {id}</div>
        <div className="empty-sub">{error}</div>
      </div>
    </div>
  );
  if (!asset) return <div className="page loading"><i className="fa-solid fa-spinner fa-spin" /> Loading asset…</div>;

  const key = assetKey(asset);
  const photos = asset.photos || [];
  const c = coords(asset);
  const counts: Partial<Record<TabKey, number>> = {
    photos: photos.length, documents: asset.documents?.length || 0, maintenance: asset.maintenanceLogs?.length || 0,
  };

  async function remove() {
    if (!confirm(`Delete asset ${key}? This cannot be undone.`)) return;
    try { await assetsApi.deleteAsset(key); toast('Asset deleted'); navigate('/assets'); }
    catch (err) { toast(`Delete failed: ${errorMessage(err)}`, 'error'); }
  }

  return (
    <div className="page">
      {/* Browser back keeps the registry's filters (they live in the URL). */}
      <button className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/assets'))}>
        <i className="fa-solid fa-arrow-left" /> Back to registry
      </button>

      <div className="av-hero">
        <div className="card av-gallery">
          <div className="av-main-img">
            {photos.length
              ? <AuthedImage path={assetsApi.photoPath(key, photos[Math.min(photoIdx, photos.length - 1)]._id)} alt={asset.name} />
              : <div style={{ textAlign: 'center' }}><i className="fa-solid fa-camera" style={{ fontSize: 28 }} /><div className="cell-sub">No photos yet</div></div>}
          </div>
          {photos.length > 1 && (
            <div className="av-thumbs">
              {photos.map((p, i) => (
                <button key={p._id} className={`av-thumb${i === photoIdx ? ' active' : ''}`} onClick={() => setPhotoIdx(i)} aria-label={`Photo ${i + 1}`}>
                  <AuthedImage path={assetsApi.photoPath(key, p._id)} alt={`Photo ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card av-info">
          <div className="row">
            <span className="id-cell">{key}</span>
            {asset.assetCode && asset.assetCode !== key && <span className="id-cell">· {asset.assetCode}</span>}
            <Tag tone={(asset.status || 'Active') === 'Active' ? 'green' : 'gray'}>{asset.status || 'Active'}</Tag>
            {asset.approvalStatus && asset.approvalStatus !== 'Approved' && <Tag tone="warn">{asset.approvalStatus}</Tag>}
          </div>
          <div className="av-name">{asset.name}</div>
          <div className="row"><TypeTag value={asset.type} /><ConditionTag value={asset.condition} /><AssessedTag value={asset.assessed} /><RiskBadge asset={asset} /></div>
          {asset.valuation?.amount != null && (
            <div className="av-value">
              <div className="av-value-label">Estimated value</div>
              <div className="av-value-amount">{formatNaira(asset.valuation.amount)}</div>
            </div>
          )}
          <div className="meta-grid">
            <Meta k="MDA" v={asset.mda} full />
            <Meta k="State" v={asset.state} />
            <Meta k="LGA" v={asset.lga} />
            {c && <Meta k="Coordinates" v={`${c.lat.toFixed(6)}°N, ${c.lng.toFixed(6)}°E`} full />}
            {asset.nextInspection && <Meta k="Next inspection" v={formatDate(asset.nextInspection)} />}
          </div>
          <div className="row" style={{ marginTop: 'auto' }}>
            {can('canEdit') && <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}><i className="fa-solid fa-pen-to-square" /> Edit</button>}
            {c && <a className="btn btn-ghost btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`} target="_blank" rel="noreferrer"><i className="fa-solid fa-map-location-dot" /> Google Maps</a>}
            {can('canDelete') && <button className="btn btn-danger btn-sm" onClick={remove}><i className="fa-solid fa-trash" /> Delete</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tab-bar" role="tablist">
          {TABS.map(([k, label, icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
              <i className={`fa-solid ${icon}`} /> {label}
              {counts[k] ? <span className="tab-count">{counts[k]}</span> : null}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {tab === 'overview'    && <OverviewTab asset={asset} />}
          {tab === 'photos'      && <PhotosTab asset={asset} onChange={reload} />}
          {tab === 'location'    && <LocationTab asset={asset} />}
          {tab === 'maintenance' && <MaintenanceTab asset={asset} onChange={setAsset} />}
          {tab === 'documents'   && <DocumentsTab asset={asset} onChange={reload} />}
          {tab === 'valuation'   && <ValuationTab asset={asset} onChange={setAsset} />}
          {tab === 'history'     && <HistoryTab asset={asset} />}
        </div>
      </div>

      {editing && (
        <EditAssetModal asset={asset} mdas={mdas} onClose={() => setEditing(false)}
                        onSaved={() => { setEditing(false); reload(); }} />
      )}
    </div>
  );
}

function Meta({ k, v, full }: { k: string; v?: string | null; full?: boolean }) {
  return (
    <div className={full ? 'full' : undefined}>
      <div className="meta-key">{k}</div>
      <div className="meta-val">{v || '—'}</div>
    </div>
  );
}
