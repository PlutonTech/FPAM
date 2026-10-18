import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import * as assetsApi from '../../api/assets';
import { errorMessage } from '../../api/client';
import { useToast } from '../../components/Toast';
import { ASSET_TYPES, CONDITIONS, GEOM_TYPES, NIGERIA_STATES, SECTORS } from '../../lib/assets';
import { TYPE_FIELDS } from './typeFields';

const ABUJA: [number, number] = [9.0765, 7.3986];
const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  name: '', type: '', geomType: 'Point', condition: 'Good', assessed: 'Assessed',
  mda: '', sector: '', state: '', lga: '', address: '',
  lat: '', lng: '', captureDate: today(), nextInspection: '', material: '', elevation: '', area: '', notes: '',
};
type Form = typeof EMPTY;

/** Click the map to set coordinates; keeps the view on the chosen point. */
function PickPoint({ point, onPick }: { point: [number, number] | null; onPick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) });
  useEffect(() => { if (point) map.setView(point, Math.max(map.getZoom(), 15)); }, [point, map]);
  return point ? <CircleMarker center={point} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: '#4A90D9', fillOpacity: .95 }} /> : null;
}

function FileList({ files, onRemove, icon }: { files: File[]; onRemove: (i: number) => void; icon: string }) {
  if (!files.length) return null;
  return (
    <div className="file-chips">
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="file-chip">
          <i className={`fa-solid ${icon}`} /> <span>{f.name}</span>
          <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`}><i className="fa-solid fa-xmark" /></button>
        </span>
      ))}
    </div>
  );
}

export default function CapturePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [typeData, setTypeData] = useState<Record<string, string>>({});
  const [mdas, setMdas] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Form | 'location', string>>>({});
  const [gps, setGps] = useState<{ busy: boolean; accuracy?: number; error?: string }>({ busy: false });
  const [photos, setPhotos] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [sheets, setSheets] = useState<File[]>([]);
  const [saving, setSaving] = useState('');
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => { assetsApi.getMdaNames().then(setMdas); }, []);

  const previews = useMemo(() => photos.map(f => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(er => ({ ...er, [k]: undefined }));
  };

  const lat = parseFloat(form.lat), lng = parseFloat(form.lng);
  const hasPoint = !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const point: [number, number] | null = hasPoint ? [lat, lng] : null;

  const setPoint = (la: number, ln: number, accuracy?: number) => {
    setForm(f => ({ ...f, lat: la.toFixed(6), lng: ln.toFixed(6) }));
    setGps({ busy: false, accuracy });
    setErrors(er => ({ ...er, location: undefined }));
  };

  function captureGps() {
    if (!navigator.geolocation) { setGps({ busy: false, error: 'This browser has no geolocation' }); return; }
    setGps({ busy: true });
    navigator.geolocation.getCurrentPosition(
      p => setPoint(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
      err => setGps({ busy: false, error: err.message || 'Could not get location' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Asset name is required';
    if (!form.type) e.type = 'Choose an asset type';
    if (!form.mda) e.mda = 'Choose the MDA / agency';
    if (!hasPoint) e.location = 'Set the location — use GPS, click the map, or type coordinates';
    if (form.elevation && isNaN(Number(form.elevation))) e.elevation = 'Must be a number';
    if (form.area && (isNaN(Number(form.area)) || Number(form.area) < 0)) e.area = 'Must be a positive number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) { top.current?.scrollIntoView({ behavior: 'smooth' }); toast('Fix the highlighted fields', 'error'); return; }

    const fields = TYPE_FIELDS[form.type] || [];
    const td = Object.fromEntries(fields.map(f => [f.label, typeData[f.label]]).filter(([, v]) => v));
    const payload: Record<string, unknown> = {
      name: form.name.trim(), type: form.type, geomType: form.geomType, condition: form.condition,
      assessed: form.assessed, coordinates: [lng, lat],
      mda: form.mda, sector: form.sector, state: form.state, lga: form.lga.trim(), address: form.address.trim(),
      material: form.material.trim(), notes: form.notes.trim(), captureDate: form.captureDate || today(), typeData: td,
      ...(form.nextInspection ? { nextInspection: form.nextInspection } : {}),
      ...(form.elevation ? { elevation: Number(form.elevation) } : {}),
      ...(form.area ? { area: Number(form.area) } : {}),
    };

    setSaving('Saving asset…');
    let asset;
    try {
      asset = await assetsApi.createAsset(payload);
    } catch (err) {
      setSaving('');
      toast(`Save failed: ${errorMessage(err)}`, 'error');   // form stays filled in
      return;
    }

    // Attachments go up after the asset exists. Failures don't lose the asset.
    const failed: string[] = [];
    const uploads: [File[], (id: string, f: File) => Promise<unknown>, string][] = [
      [photos, assetsApi.uploadPhoto, 'photo'], [docs, assetsApi.uploadDocument, 'document'], [sheets, assetsApi.uploadSpreadsheet, 'spreadsheet'],
    ];
    for (const [files, fn, kind] of uploads) {
      for (const [n, f] of files.entries()) {
        setSaving(`Uploading ${kind} ${n + 1} of ${files.length}…`);
        try { await fn(asset.assetId, f); } catch (err) { failed.push(`${f.name}: ${errorMessage(err)}`); }
      }
    }
    setSaving('');

    const pending = asset.approvalStatus === 'Pending';
    toast(pending ? `${asset.assetId} submitted — waiting for approval` : `${asset.assetId} captured`, pending ? 'info' : 'success');
    if (failed.length) toast(`${failed.length} file(s) failed to upload — open the asset to retry. ${failed[0]}`, 'error');
    navigate(`/assets/${encodeURIComponent(asset.assetId)}`);
  }

  const err = (k: keyof typeof errors) => errors[k] ? <div className="field-error">{errors[k]}</div> : null;
  const cls = (k: keyof typeof errors) => `form-control${errors[k] ? ' invalid' : ''}`;
  const typeFields = TYPE_FIELDS[form.type] || [];

  return (
    <div className="page" ref={top}>
      <header className="page-header">
        <div>
          <h1 className="page-title">Field capture</h1>
          <div className="page-sub">Record a new asset. The asset ID and FGN code are assigned when you save.</div>
        </div>
      </header>

      <form className="capture-grid" onSubmit={submit} noValidate>
        <div className="capture-main">
          <section className="card form-section">
            <h2 className="form-section-title">Identity</h2>
            <div className="form-grid">
              <div className="full"><label className="form-label" htmlFor="c-name">Asset name *</label>
                <input id="c-name" className={cls('name')} value={form.name} onChange={set('name')} placeholder="e.g. Federal Secretariat Complex, Abuja" />{err('name')}</div>
              <div><label className="form-label" htmlFor="c-type">Type *</label>
                <select id="c-type" className={cls('type')} value={form.type} onChange={e => { set('type')(e); setTypeData({}); }}>
                  <option value="">— Select type —</option>{ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>{err('type')}</div>
              <div><label className="form-label" htmlFor="c-geom">Geometry</label>
                <select id="c-geom" className="form-control" value={form.geomType} onChange={set('geomType')}>
                  {GEOM_TYPES.map(g => <option key={g}>{g}</option>)}
                </select></div>
              <div><label className="form-label" htmlFor="c-cond">Condition</label>
                <select id="c-cond" className="form-control" value={form.condition} onChange={set('condition')}>
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select></div>
              <div><span className="form-label">Assessment</span>
                <div className="seg" role="radiogroup" aria-label="Assessment">
                  {['Assessed', 'Unassessed'].map(v => (
                    <button key={v} type="button" role="radio" aria-checked={form.assessed === v}
                            className={`seg-btn${form.assessed === v ? ' active' : ''}`} onClick={() => setForm(f => ({ ...f, assessed: v }))}>{v}</button>
                  ))}
                </div></div>
              <div className="full"><label className="form-label" htmlFor="c-mda">MDA / agency *</label>
                <select id="c-mda" className={cls('mda')} value={form.mda} onChange={set('mda')}>
                  <option value="">— Select MDA —</option>{mdas.map(m => <option key={m}>{m}</option>)}
                </select>{err('mda')}</div>
              <div className="full"><label className="form-label" htmlFor="c-sector">Sector</label>
                <select id="c-sector" className="form-control" value={form.sector} onChange={set('sector')}>
                  <option value="">— Select sector —</option>{SECTORS.map(s => <option key={s}>{s}</option>)}
                </select></div>
            </div>
          </section>

          {typeFields.length > 0 && (
            <section className="card form-section">
              <h2 className="form-section-title">{form.type} details</h2>
              <div className="form-grid">
                {typeFields.map(f => (
                  <div key={f.label}><label className="form-label">{f.label}</label>
                    {f.type === 'select' ? (
                      <select className="form-control" value={typeData[f.label] || ''} onChange={e => setTypeData(d => ({ ...d, [f.label]: e.target.value }))}>
                        <option value="">—</option>{f.opts!.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input className="form-control" type={f.type} placeholder={f.ph} value={typeData[f.label] || ''}
                             onChange={e => setTypeData(d => ({ ...d, [f.label]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card form-section">
            <h2 className="form-section-title">Location</h2>
            <div className="form-grid">
              <div><label className="form-label" htmlFor="c-state">State</label>
                <select id="c-state" className="form-control" value={form.state} onChange={set('state')}>
                  <option value="">— Select state —</option>{NIGERIA_STATES.map(s => <option key={s}>{s}</option>)}
                </select></div>
              <div><label className="form-label" htmlFor="c-lga">LGA</label>
                <input id="c-lga" className="form-control" value={form.lga} onChange={set('lga')} placeholder="Local Government Area" /></div>
              <div className="full"><label className="form-label" htmlFor="c-addr">Address</label>
                <input id="c-addr" className="form-control" value={form.address} onChange={set('address')} placeholder="e.g. No. 5 Shehu Shagari Way, Abuja" /></div>
            </div>
            <div className="row" style={{ margin: '16px 0 10px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={captureGps} disabled={gps.busy}>
                <i className={`fa-solid ${gps.busy ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`} /> {gps.busy ? 'Locating…' : 'Use my GPS'}
              </button>
              <span className="cell-sub">or click the map, or type coordinates</span>
              {gps.accuracy != null && <span className="tag tag-green">±{Math.round(gps.accuracy)} m</span>}
              {gps.error && <span className="tag tag-red">{gps.error}</span>}
            </div>
            <div className="form-grid" style={{ marginBottom: 10 }}>
              <div><label className="form-label" htmlFor="c-lat">Latitude</label>
                <input id="c-lat" className={cls('location')} inputMode="decimal" value={form.lat} onChange={e => { set('lat')(e); setErrors(er => ({ ...er, location: undefined })); }} placeholder="e.g. 9.076500" /></div>
              <div><label className="form-label" htmlFor="c-lng">Longitude</label>
                <input id="c-lng" className={cls('location')} inputMode="decimal" value={form.lng} onChange={e => { set('lng')(e); setErrors(er => ({ ...er, location: undefined })); }} placeholder="e.g. 7.398600" /></div>
            </div>
            {err('location')}
            <div className="map-box" style={{ height: 280 }}>
              <MapContainer center={point || ABUJA} zoom={point ? 15 : 6} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <PickPoint point={point} onPick={(la, ln) => setPoint(la, ln)} />
              </MapContainer>
            </div>
          </section>

          <section className="card form-section">
            <h2 className="form-section-title">Details</h2>
            <div className="form-grid">
              <div><label className="form-label" htmlFor="c-date">Capture date</label>
                <input id="c-date" className="form-control" type="date" value={form.captureDate} onChange={set('captureDate')} /></div>
              <div><label className="form-label" htmlFor="c-next">Next inspection</label>
                <input id="c-next" className="form-control" type="date" value={form.nextInspection} onChange={set('nextInspection')} /></div>
              <div><label className="form-label" htmlFor="c-mat">Material</label>
                <input id="c-mat" className="form-control" value={form.material} onChange={set('material')} placeholder="e.g. Concrete, Steel" /></div>
              <div><label className="form-label" htmlFor="c-elev">Elevation (m)</label>
                <input id="c-elev" className={cls('elevation')} inputMode="decimal" value={form.elevation} onChange={set('elevation')} placeholder="e.g. 45" />{err('elevation')}</div>
              <div><label className="form-label" htmlFor="c-area">Area (m²)</label>
                <input id="c-area" className={cls('area')} inputMode="decimal" value={form.area} onChange={set('area')} placeholder="e.g. 250" />{err('area')}</div>
              <div className="full"><label className="form-label" htmlFor="c-notes">Notes</label>
                <textarea id="c-notes" className="form-control" value={form.notes} onChange={set('notes')} /></div>
            </div>
          </section>
        </div>

        <aside className="capture-side">
          <section className="card form-section">
            <h2 className="form-section-title">Attachments</h2>
            <label className="drop-zone">
              <i className="fa-solid fa-camera" /> <strong>Photos</strong><span className="cell-sub">JPG / PNG, several allowed</span>
              <input type="file" accept="image/*" multiple hidden onChange={e => { const picked = Array.from(e.target.files || []); setPhotos(p => [...p, ...picked]); e.target.value = ''; }} />
            </label>
            {photos.length > 0 && (
              <div className="thumb-grid">
                {photos.map((f, i) => (
                  <div className="thumb" key={`${f.name}-${i}`}>
                    <img src={previews[i]} alt={f.name} />
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, k) => k !== i))} aria-label={`Remove ${f.name}`}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
              </div>
            )}
            <label className="drop-zone">
              <i className="fa-solid fa-file-lines" /> <strong>Documents</strong><span className="cell-sub">PDF, Word, text</span>
              <input type="file" accept=".pdf,.doc,.docx,.txt" multiple hidden onChange={e => { const picked = Array.from(e.target.files || []); setDocs(d => [...d, ...picked]); e.target.value = ''; }} />
            </label>
            <FileList files={docs} icon="fa-file-pdf" onRemove={i => setDocs(d => d.filter((_, k) => k !== i))} />
            <label className="drop-zone">
              <i className="fa-solid fa-file-excel" /> <strong>Spreadsheets</strong><span className="cell-sub">XLSX, XLS, CSV</span>
              <input type="file" accept=".xls,.xlsx,.csv" multiple hidden onChange={e => { const picked = Array.from(e.target.files || []); setSheets(s => [...s, ...picked]); e.target.value = ''; }} />
            </label>
            <FileList files={sheets} icon="fa-file-excel" onRemove={i => setSheets(s => s.filter((_, k) => k !== i))} />
          </section>

          <div className="card form-section capture-submit">
            <button type="submit" className="btn btn-primary btn-block" disabled={!!saving}>
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving || 'Save asset'}
            </button>
            <button type="button" className="btn btn-ghost btn-block" disabled={!!saving}
                    onClick={() => { if (confirm('Clear the form?')) { setForm({ ...EMPTY, captureDate: today() }); setTypeData({}); setPhotos([]); setDocs([]); setSheets([]); setErrors({}); setGps({ busy: false }); } }}>
              Clear form
            </button>
            <p className="cell-sub" style={{ marginTop: 8 }}>Captures by anyone other than a System Admin go to the Approvals queue before they appear in the registry.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
