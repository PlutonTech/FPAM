import { useState } from 'react';
import * as siteApi from '../../api/publicSite';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { assetKey } from '../../lib/assets';
import type { Asset } from '../../types';

// "Show on the public website gallery" for one asset. Only the name, type,
// state/LGA, a caption and the asset's general photos are published.
export default function GalleryToggle({ asset, onChange }: { asset: Asset; onChange: (a: Asset) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(!!asset.publicGallery?.enabled);
  const [caption, setCaption] = useState(asset.publicGallery?.caption || '');
  const [busy, setBusy] = useState(false);
  if (!siteApi.GALLERY_ROLES.includes(user?.role || '')) return null;

  const on = !!asset.publicGallery?.enabled;
  // M&E report photos stay private. (Older uploads carry a stray report tag that
  // matches no report; those are general photos.)
  const reportIds = new Set((asset.meReports || []).map(r => String(r._id)));
  const photoCount = (asset.photos || []).filter(p => !(p.meReportId && reportIds.has(String(p.meReportId)))).length;
  const blocked = asset.type === 'Security Facility';

  const save = async () => {
    setBusy(true);
    try {
      const { publicGallery } = await siteApi.setGallery(assetKey(asset), enabled, caption);
      onChange({ ...asset, publicGallery });
      toast(publicGallery.enabled ? 'Shown in the public gallery' : 'Removed from the public gallery');
      setOpen(false);
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button className={`btn btn-sm ${on ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOpen(true)} title="Public website gallery">
        <i className="fa-solid fa-images" /> {on ? 'In public gallery' : 'Public gallery'}
      </button>
      {open && (
        <Modal title="Public website gallery" onClose={() => setOpen(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || (enabled && (blocked || !photoCount))} onClick={save}>Save</button></>}>
          <p style={{ fontSize: 13, marginTop: 0 }}>Visitors to the website gallery will see only this asset's <b>name, type, state and LGA</b>, the caption below, and its general photos ({photoCount}). The MDA, condition, value, coordinates, documents and M&amp;E report photos stay private.</p>
          {blocked && <div className="alert alert-warn"><i className="fa-solid fa-lock" /> Security facilities can't be shown publicly.</div>}
          {!blocked && !photoCount && <div className="alert alert-warn"><i className="fa-solid fa-image" /> Add a photo to this asset first.</div>}
          <label className="check-label" style={{ marginBottom: 12 }}><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} disabled={blocked} /> Show this asset in the public gallery</label>
          <label className="form-label">Caption (optional)</label>
          <input className="form-control" value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} placeholder="e.g. Renovated in 2026 under the FPAM maintenance programme" />
        </Modal>
      )}
    </>
  );
}
