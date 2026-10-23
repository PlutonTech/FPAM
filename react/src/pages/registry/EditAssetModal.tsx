import { useState } from 'react';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { Asset } from '../../types';
import {
  ASSESSED, ASSET_TYPES, CONDITIONS, GEOM_TYPES, NIGERIA_STATES, SECTORS, STATUSES, assetKey, coords, normalizeState,
} from '../../lib/assets';

interface Props { asset: Asset; mdas: string[]; onClose: () => void; onSaved: (a: Asset) => void }

const day = (v?: string) => (v ? String(v).slice(0, 10) : '');
const num = (v?: number | null) => (v == null ? '' : String(v));

function initial(a: Asset) {
  const c = coords(a);
  return {
    name: a.name || '', type: a.type || '', geomType: a.geomType || 'Point',
    condition: a.condition || '', assessed: a.assessed || 'Unassessed', status: a.status || 'Active',
    mda: a.mda || '', sector: a.sector || '',
    // Keep a non-standard stored state visible rather than silently blanking it.
    state: normalizeState(a.state) || a.state || '', lga: a.lga || '', address: a.address || '',
    lat: c ? String(c.lat) : '', lng: c ? String(c.lng) : '',
    material: a.material || '', area: num(a.area), elevation: num(a.elevation),
    captureDate: day(a.captureDate), nextInspection: day(a.nextInspection), inspectionInterval: num(a.inspectionInterval ?? 365),
    notes: a.notes || '',
  };
}
type Form = ReturnType<typeof initial>;

/** Options list that always includes the current value, even if it's legacy/non-standard. */
const withCurrent = (list: readonly string[], v: string) => (v && !list.includes(v) ? [v, ...list] : [...list]);

export default function EditAssetModal({ asset, mdas, onClose, onSaved }: Props) {
  const toast = useToast();
  const [start] = useState(() => initial(asset));
  const [form, setForm] = useState<Form>(start);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));
  const changed = (Object.keys(form) as (keyof Form)[]).filter(k => form[k] !== start[k]);

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.type) { setError('Type is required'); return; }
    const numbers: [keyof Form, string][] = [['area', 'Area'], ['elevation', 'Elevation'], ['inspectionInterval', 'Inspection interval']];
    for (const [k, label] of numbers) {
      if (form[k] && isNaN(Number(form[k]))) { setError(`${label} must be a number`); return; }
    }
    const coordsChanged = form.lat !== start.lat || form.lng !== start.lng;
    const lat = Number(form.lat), lng = Number(form.lng);
    if (coordsChanged && (!form.lat || !form.lng || isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
      setError('Enter a valid latitude (−90 to 90) and longitude (−180 to 180)'); return;
    }

    // Send only what changed: re-sending untouched legacy values (e.g. an old
    // type no longer on the list) would fail validation and block the save.
    const data: Record<string, unknown> = {};
    for (const k of changed) {
      if (k === 'lat' || k === 'lng') continue;
      const v = form[k];
      if (k === 'name') data.name = v.trim();
      else if (k === 'condition') data.condition = v || null;
      else if (k === 'area' || k === 'elevation' || k === 'inspectionInterval') data[k] = v === '' ? null : Number(v);
      else if (k === 'nextInspection' || k === 'captureDate') data[k] = v || null;
      else data[k] = typeof v === 'string' ? v.trim() : v;
    }
    if (coordsChanged) data.coordinates = [lng, lat];
    // Lets the backend record the change in conditionHistory.
    if ('condition' in data && asset.condition) data.previousCondition = asset.condition;
    if (!Object.keys(data).length) { onClose(); return; }

    setBusy(true); setError('');
    try {
      const updated = await assetsApi.updateAsset(assetKey(asset), data);
      toast(`${asset.name} updated`);
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err));   // stay open so it can be corrected
    } finally { setBusy(false); }
  }

  const mdaOptions = withCurrent(mdas, form.mda);
  return (
    <Modal wide title={`Edit ${asset.name}`} onClose={onClose} footer={<>
      <span className="cell-sub" style={{ marginRight: 'auto' }}>{changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}` : 'No changes yet'}</span>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={busy || !changed.length}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> Save changes
      </button>
    </>}>
      <h3 className="form-section-title">Identity</h3>
      <div className="form-grid">
        <div className="full"><label className="form-label" htmlFor="e-name">Name</label>
          <input id="e-name" className="form-control" value={form.name} onChange={set('name')} /></div>
        <div><label className="form-label" htmlFor="e-type">Type</label>
          <select id="e-type" className="form-control" value={form.type} onChange={set('type')}>
            <option value="">— Select —</option>{withCurrent(ASSET_TYPES, form.type).map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="form-label" htmlFor="e-geom">Geometry</label>
          <select id="e-geom" className="form-control" value={form.geomType} onChange={set('geomType')}>
            {GEOM_TYPES.map(g => <option key={g}>{g}</option>)}</select></div>
        <div><label className="form-label" htmlFor="e-cond">Condition</label>
          <select id="e-cond" className="form-control" value={form.condition} onChange={set('condition')}>
            <option value="">— Not set —</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><span className="form-label">Assessment</span>
          <div className="seg" role="radiogroup" aria-label="Assessment">
            {ASSESSED.map(v => (
              <button key={v} type="button" role="radio" aria-checked={form.assessed === v}
                      className={`seg-btn${form.assessed === v ? ' active' : ''}`} onClick={() => setForm(f => ({ ...f, assessed: v }))}>{v}</button>
            ))}
          </div></div>
        <div><label className="form-label" htmlFor="e-status">Status</label>
          <select id="e-status" className="form-control" value={form.status} onChange={set('status')}>
            {withCurrent(STATUSES, form.status).map(s => <option key={s}>{s}</option>)}</select></div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Ownership</h3>
      <div className="form-grid">
        <div><label className="form-label" htmlFor="e-mda">MDA / agency</label>
          <select id="e-mda" className="form-control" value={form.mda} onChange={set('mda')}>
            <option value="">— Select MDA —</option>{mdaOptions.map(m => <option key={m}>{m}</option>)}</select></div>
        <div><label className="form-label" htmlFor="e-sector">Sector</label>
          <select id="e-sector" className="form-control" value={form.sector} onChange={set('sector')}>
            <option value="">— None —</option>{withCurrent(SECTORS, form.sector).map(s => <option key={s}>{s}</option>)}</select></div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Location</h3>
      <div className="form-grid">
        <div><label className="form-label" htmlFor="e-state">State</label>
          <select id="e-state" className="form-control" value={form.state} onChange={set('state')}>
            <option value="">— Select —</option>{withCurrent(NIGERIA_STATES, form.state).map(s => <option key={s}>{s}</option>)}</select>
          {form.state && !normalizeState(form.state) && <div className="field-error">"{form.state}" isn't a recognised state — pick one from the list to fix it.</div>}</div>
        <div><label className="form-label" htmlFor="e-lga">LGA</label>
          <input id="e-lga" className="form-control" value={form.lga} onChange={set('lga')} /></div>
        <div className="full"><label className="form-label" htmlFor="e-addr">Address</label>
          <input id="e-addr" className="form-control" value={form.address} onChange={set('address')} /></div>
        <div><label className="form-label" htmlFor="e-lat">Latitude</label>
          <input id="e-lat" className="form-control" inputMode="decimal" value={form.lat} onChange={set('lat')} /></div>
        <div><label className="form-label" htmlFor="e-lng">Longitude</label>
          <input id="e-lng" className="form-control" inputMode="decimal" value={form.lng} onChange={set('lng')} /></div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: 18 }}>Details</h3>
      <div className="form-grid">
        <div><label className="form-label" htmlFor="e-mat">Material</label>
          <input id="e-mat" className="form-control" value={form.material} onChange={set('material')} /></div>
        <div><label className="form-label" htmlFor="e-area">Area (m²)</label>
          <input id="e-area" className="form-control" inputMode="decimal" value={form.area} onChange={set('area')} /></div>
        <div><label className="form-label" htmlFor="e-elev">Elevation (m)</label>
          <input id="e-elev" className="form-control" inputMode="decimal" value={form.elevation} onChange={set('elevation')} /></div>
        <div><label className="form-label" htmlFor="e-cap">Capture date</label>
          <input id="e-cap" className="form-control" type="date" value={form.captureDate} onChange={set('captureDate')} /></div>
        <div><label className="form-label" htmlFor="e-next">Next inspection</label>
          <input id="e-next" className="form-control" type="date" value={form.nextInspection} onChange={set('nextInspection')} /></div>
        <div><label className="form-label" htmlFor="e-int">Inspection interval (days)</label>
          <input id="e-int" className="form-control" inputMode="numeric" value={form.inspectionInterval} onChange={set('inspectionInterval')} /></div>
        <div className="full"><label className="form-label" htmlFor="e-notes">Notes</label>
          <textarea id="e-notes" className="form-control" value={form.notes} onChange={set('notes')} /></div>
      </div>
      {error && <div className="form-error"><i className="fa-solid fa-circle-xmark" /> {error}</div>}
    </Modal>
  );
}
