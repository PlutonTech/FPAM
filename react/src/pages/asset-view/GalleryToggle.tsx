import { useState } from 'react';
import * as siteApi from '../../api/publicSite';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { assetKey } from '../../lib/assets';
import type { Asset } from '../../types';

// How one asset appears on the public website: the asset list (shown by
// default: name, type, MDA, location and one photo) and the gallery (opt-in:
// name, type, location, a caption and all general photos).
export default function GalleryToggle({ asset, onChange }: { asset: Asset; onChange: (a: Asset) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(!!asset.publicGallery?.enabled);
  const [caption, setCaption] = useState(asset.publicGallery?.caption || '');
  const [hidden, setHidden] = useState(!!asset.publicListing?.hidden);
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
      const { publicGallery, publicListing } = await siteApi.setGallery(assetKey(asset), enabled && !hidden, caption, hidden);
      onChange({ ...asset, publicGallery, publicListing });
      toast(publicListing.hidden ? 'Hidden from the public website' : publicGallery.enabled ? 'Shown on the asset list and in the gallery' : 'Shown on the public asset list');
      setOpen(false);
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button className={`btn btn-sm ${on ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOpen(true)} title="How this asset appears on the public website">
        <i className={`fa-solid ${asset.publicListing?.hidden ? 'fa-eye-slash' : 'fa-globe'}`} /> {asset.publicListing?.hidden ? 'Hidden from website' : on ? 'In public gallery' : 'Public website'}
      </button>
      {open && (
        <Modal title="Public website" onClose={() => setOpen(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || (enabled && !hidden && (blocked || !photoCount))} onClick={save}>Save</button></>}>
          {blocked ? <div className="alert alert-warn"><i className="fa-solid fa-lock" /> Security facilities are never shown on the public website.</div> : <>
            <h3 className="section-h" style={{ marginTop: 0 }}>Asset list</h3>
            <p style={{ fontSize: 13, marginTop: 0 }}>Approved assets appear on the website's Assets page with their <b>name, type, MDA, state and LGA</b> and one photo. Condition, value, coordinates, documents and M&amp;E photos stay private.</p>
            <label className="check-label" style={{ marginBottom: 14 }}><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> Hide this asset from the public website</label>
            <h3 className="section-h">Gallery</h3>
            <p style={{ fontSize: 13, marginTop: 0 }}>Optionally feature it in the gallery with a caption and all its general photos ({photoCount}).</p>
            {!photoCount && <div className="alert alert-warn"><i className="fa-solid fa-image" /> Add a photo to this asset first.</div>}
          </>}
          {!blocked && <label className="check-label" style={{ marginBottom: 12 }}><input type="checkbox" checked={enabled && !hidden} onChange={e => setEnabled(e.target.checked)} disabled={hidden} /> Show this asset in the public gallery</label>}
          {!blocked && !hidden && enabled && <>
            <label className="form-label">Gallery caption (optional)</label>
            <input className="form-control" value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} placeholder="e.g. Renovated in 2026 under the FPAM maintenance programme" />
          </>}
        </Modal>
      )}
    </>
  );
}
