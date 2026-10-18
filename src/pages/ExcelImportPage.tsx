import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import { errorMessage } from '../api/client';
import { useToast } from '../components/Toast';
import { Tag } from '../components/Tags';
import type { Asset } from '../types';
import { ASSESSED, ASSET_TYPES, CONDITIONS, NIGERIA_STATES, SECTORS, assetKey, normalizeState } from '../lib/assets';

// Target fields a column can map to, with header keywords for auto-matching.
const FIELDS: { key: string; label: string; words: string[] }[] = [
  { key: 'name', label: 'Asset name *', words: ['asset name', 'name', 'title', 'description', 'facility'] },
  { key: 'type', label: 'Asset type', words: ['asset type', 'type', 'category', 'class'] },
  { key: 'condition', label: 'Condition', words: ['condition', 'state of repair', 'quality'] },
  { key: 'assessed', label: 'Assessed', words: ['assessed', 'assessment'] },
  { key: 'mda', label: 'MDA', words: ['mda', 'ministry', 'agency', 'department', 'owner'] },
  { key: 'sector', label: 'Sector', words: ['sector'] },
  { key: 'state', label: 'State', words: ['state', 'region'] },
  { key: 'lga', label: 'LGA', words: ['lga', 'local government', 'district'] },
  { key: 'address', label: 'Address', words: ['address', 'location', 'street'] },
  { key: 'lat', label: 'Latitude', words: ['latitude', 'lat', 'northing'] },
  { key: 'lng', label: 'Longitude', words: ['longitude', 'lng', 'lon', 'easting'] },
  { key: 'coords', label: 'Coordinates "lat, lng"', words: ['coordinates', 'gps', 'coord'] },
  { key: 'material', label: 'Material', words: ['material', 'construction'] },
  { key: 'area', label: 'Area (m²)', words: ['area', 'size', 'dimension'] },
  { key: 'captureDate', label: 'Capture date', words: ['capture date', 'survey date', 'date'] },
  { key: 'notes', label: 'Notes', words: ['notes', 'remarks', 'comment', 'observation'] },
];

type Row = Record<string, string>;
interface Checked { line: number; raw: { name: string; type: string; state: string }; payload?: Record<string, unknown>; errors: string[]; warnings: string[] }

const canon = (list: readonly string[], v: string) => list.find(x => x.toLowerCase() === v.trim().toLowerCase());
const toNum = (v: string) => { const n = Number(String(v).replace(/,/g, '').trim()); return v.trim() && !isNaN(n) ? n : undefined; };

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const taken = new Set<string>();
  // Longest keyword first so "asset type" beats "type", "capture date" beats "date".
  const pairs = FIELDS.flatMap(f => f.words.map(w => ({ f: f.key, w }))).sort((a, b) => b.w.length - a.w.length);
  for (const { f, w } of pairs) {
    if (taken.has(f)) continue;
    const h = headers.find(h => !map[h] && h.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').includes(w));
    if (h) { map[h] = f; taken.add(f); }
  }
  return map;
}

export default function ExcelImportPage() {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState({ type: '', mda: '', state: '', assessed: 'Unassessed' });
  const [mdas, setMdas] = useState<string[]>([]);
  const [parseError, setParseError] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ line: number; ok: boolean; info: string }[] | null>(null);

  async function load(f: File) {
    setParseError(''); setResults(null); setFile(f);
    if (!mdas.length) assetsApi.getMdaNames().then(setMdas);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      if (raw.length < 2) throw new Error('The first sheet has no data rows');
      // A title row with 1–2 cells above the real headers is common — skip it.
      const filled = (r: unknown[]) => r.filter(c => String(c).trim()).length;
      const h = filled(raw[0]) <= 2 && filled(raw[1] || []) > filled(raw[0]) ? 1 : 0;
      const hdrs = (raw[h] as unknown[]).map(c => String(c).trim());
      const data = raw.slice(h + 1).filter(r => filled(r)).map(r => Object.fromEntries(hdrs.map((k, i) => {
        const v = r[i];
        return [k, v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim()];
      })));
      setHeaders(hdrs.filter(Boolean)); setRows(data); setMap(autoMap(hdrs.filter(Boolean)));
    } catch (err) { setParseError(errorMessage(err)); setHeaders([]); setRows([]); }
  }

  const checked = useMemo<Checked[]>(() => rows.map((r, i) => {
    const get = (k: string) => { const h = Object.keys(map).find(x => map[x] === k); return h ? (r[h] || '') : ''; };
    const errors: string[] = [], warnings: string[] = [];
    const name = get('name');
    if (!name) errors.push('no name');
    const typeRaw = get('type');
    const type = canon(ASSET_TYPES, typeRaw) || (!typeRaw ? defaults.type : '');
    if (!type) errors.push(typeRaw ? `unknown type "${typeRaw}"` : 'no type');
    let lat = toNum(get('lat')), lng = toNum(get('lng'));
    if ((lat === undefined || lng === undefined) && get('coords')) {
      const parts = get('coords').split(/[,;\s]+/).map(toNum).filter((n): n is number => n !== undefined);
      if (parts.length >= 2) [lat, lng] = parts;
    }
    if (lat === undefined || lng === undefined) errors.push('no coordinates');
    else if (Math.abs(lat) > 90 || Math.abs(lng) > 180) errors.push('coordinates out of range');
    const condRaw = get('condition');
    const condition = condRaw ? canon(CONDITIONS, condRaw) : undefined;
    if (condRaw && !condition) warnings.push(`condition "${condRaw}" ignored`);
    const assessedRaw = get('assessed');
    const assessed = canon(ASSESSED, assessedRaw) || (/^(y|yes|true|1)$/i.test(assessedRaw) ? 'Assessed' : /^(n|no|false|0)$/i.test(assessedRaw) ? 'Unassessed' : defaults.assessed);
    const stateRaw = get('state');
    const state = normalizeState(stateRaw) || (!stateRaw ? defaults.state : stateRaw);
    if (stateRaw && !normalizeState(stateRaw)) warnings.push(`unrecognised state "${stateRaw}"`);
    const sectorRaw = get('sector');
    const sector = sectorRaw ? canon(SECTORS, sectorRaw) : undefined;
    if (sectorRaw && !sector) warnings.push(`sector "${sectorRaw}" ignored`);
    const area = toNum(get('area'));
    const dateRaw = get('captureDate');
    const captureDate = dateRaw && !isNaN(new Date(dateRaw).getTime()) ? dateRaw : undefined;
    if (dateRaw && !captureDate) warnings.push('capture date ignored');
    const payload = errors.length ? undefined : {
      name, type, assessed, coordinates: [lng, lat], geomType: 'Point',
      mda: get('mda') || defaults.mda, state, lga: get('lga'), address: get('address'),
      material: get('material'), notes: get('notes'),
      ...(condition ? { condition } : {}), ...(sector ? { sector } : {}),
      ...(area !== undefined ? { area } : {}), ...(captureDate ? { captureDate } : {}),
    };
    return { line: i + 2, raw: { name, type: typeRaw || type, state: stateRaw || state }, payload, errors, warnings };
  }), [rows, map, defaults]);

  const valid = checked.filter(c => c.payload);
  const invalid = checked.length - valid.length;

  async function runImport() {
    if (!valid.length) return;
    if (!confirm(`Create ${valid.length} assets from ${file?.name}? Captures by non-admins go to the Approvals queue.`)) return;
    setProgress({ done: 0, total: valid.length });
    const out: { line: number; ok: boolean; info: string }[] = [];
    let next = 0, done = 0;
    // A few requests at a time — faster than one-by-one without flooding the API.
    const worker = async () => {
      while (next < valid.length) {
        const c = valid[next++];
        try { const a = await assetsApi.createAsset(c.payload!); out.push({ line: c.line, ok: true, info: a.assetId }); }
        catch (err) { out.push({ line: c.line, ok: false, info: errorMessage(err) }); }
        setProgress({ done: ++done, total: valid.length });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    out.sort((a, b) => a.line - b.line);
    setResults(out); setProgress(null);
    const failed = out.filter(r => !r.ok).length;
    toast(failed ? `${out.length - failed} created, ${failed} failed` : `${out.length} assets created`, failed ? 'error' : 'success');
  }

  function downloadReport() {
    const lines = [['Row', 'Result', 'Asset ID / error'],
      ...checked.filter(c => !c.payload).map(c => [c.line, 'Skipped', c.errors.join('; ')]),
      ...(results || []).map(r => [r.line, r.ok ? 'Created' : 'Failed', r.info])]
      .sort((a, b) => Number(a[0]) - Number(b[0]) || 0);
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const blob = new Blob([lines.map(l => l.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `import_report_${file?.name || 'sheet'}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const mapped = new Set(Object.values(map).filter(Boolean));
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Excel import</h1>
          <div className="page-sub">Create assets in bulk from a spreadsheet, or attach a spreadsheet to an existing asset</div>
        </div>
      </header>

      <div className="card form-section" style={{ marginBottom: 16 }}>
        <label className="drop-zone" style={{ padding: 24, marginBottom: 0 }}>
          <i className="fa-solid fa-file-excel" style={{ fontSize: 24 }} />
          <strong>{file ? file.name : 'Choose an Excel or CSV file'}</strong>
          <span className="cell-sub">{file && rows.length ? `${rows.length.toLocaleString()} data rows · first sheet` : 'XLSX, XLS or CSV — first sheet, one asset per row'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) load(f); }} />
        </label>
        {parseError && <div className="form-error">Could not read the file: {parseError}</div>}
      </div>

      {rows.length > 0 && <>
        <div className="dash-split" style={{ marginBottom: 16 }}>
          <section className="card form-section">
            <h2 className="form-section-title">1. Match columns</h2>
            <div className="map-cols">
              {headers.map(h => (
                <div key={h} className="map-col-row">
                  <span className="map-col-src" title={h}>{h}</span>
                  <i className="fa-solid fa-arrow-right muted" />
                  <select className="form-control" value={map[h] || ''} onChange={e => setMap(m => ({ ...m, [h]: e.target.value }))}>
                    <option value="">— Skip —</option>
                    {FIELDS.map(f => <option key={f.key} value={f.key} disabled={mapped.has(f.key) && map[h] !== f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>
          <section className="card form-section">
            <h2 className="form-section-title">2. Defaults for blank cells</h2>
            <div className="form-grid">
              <div><label className="form-label">Type</label>
                <select className="form-control" value={defaults.type} onChange={e => setDefaults(d => ({ ...d, type: e.target.value }))}>
                  <option value="">— None —</option>{ASSET_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="form-label">Assessed</label>
                <select className="form-control" value={defaults.assessed} onChange={e => setDefaults(d => ({ ...d, assessed: e.target.value }))}>
                  {ASSESSED.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="full"><label className="form-label">MDA</label>
                <select className="form-control" value={defaults.mda} onChange={e => setDefaults(d => ({ ...d, mda: e.target.value }))}>
                  <option value="">— None —</option>{mdas.map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="form-label">State</label>
                <select className="form-control" value={defaults.state} onChange={e => setDefaults(d => ({ ...d, state: e.target.value }))}>
                  <option value="">— None —</option>{NIGERIA_STATES.map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
            <p className="cell-sub" style={{ marginTop: 10 }}>Every asset needs a name, a type and coordinates. Rows missing any of these are skipped.</p>
          </section>
        </div>

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="chart-card-hd">
            <div>
              <div className="chart-title">3. Check & import</div>
              <div className="chart-sub"><Tag tone="green">{valid.length.toLocaleString()} ready</Tag> {invalid > 0 && <Tag tone="red">{invalid.toLocaleString()} will be skipped</Tag>}</div>
            </div>
            <div className="row">
              {(invalid > 0 || results) && <button className="btn btn-ghost btn-sm" onClick={downloadReport}><i className="fa-solid fa-file-csv" /> Download report</button>}
              <button className="btn btn-primary btn-sm" disabled={!valid.length || !!progress} onClick={runImport}>
                <i className={`fa-solid ${progress ? 'fa-spinner fa-spin' : 'fa-file-import'}`} /> {progress ? `Importing ${progress.done}/${progress.total}…` : `Import ${valid.length.toLocaleString()} assets`}
              </button>
            </div>
          </div>
          {progress && <div className="progress"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Row</th><th>Name</th><th>Type</th><th>State</th><th>Coordinates</th><th>Result</th></tr></thead>
              <tbody>
                {checked.slice(0, 300).map(c => {
                  const res = results?.find(r => r.line === c.line);
                  const p = c.payload as { name?: string; type?: string; state?: string; coordinates?: number[] } | undefined;
                  return (
                    <tr key={c.line}>
                      <td className="cell-sub">{c.line}</td>
                      <td>{p?.name || c.raw.name || <span className="cell-sub">—</span>}</td>
                      <td style={{ fontSize: 12 }}>{p?.type || c.raw.type || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p?.state || c.raw.state || '—'}</td>
                      <td className="mono" style={{ fontSize: 10 }}>{p?.coordinates ? `${p.coordinates[1]}, ${p.coordinates[0]}` : '—'}</td>
                      <td>
                        {res ? (res.ok ? <Link to={`/assets/${encodeURIComponent(res.info)}`}><Tag tone="green">Created {res.info}</Tag></Link> : <Tag tone="red" title={res.info}>Failed: {res.info}</Tag>)
                          : c.errors.length ? <Tag tone="red">Skip: {c.errors.join(', ')}</Tag>
                          : c.warnings.length ? <Tag tone="warn" title={c.warnings.join('; ')}>Ready · {c.warnings.length} note{c.warnings.length > 1 ? 's' : ''}</Tag>
                          : <Tag tone="green">Ready</Tag>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {checked.length > 300 && <div className="cell-sub" style={{ padding: 10 }}>Showing the first 300 of {checked.length.toLocaleString()} rows — all of them will be checked and imported.</div>}
          </div>
        </section>
      </>}

      <AttachToAsset file={file} />
    </div>
  );
}

/** Upload the spreadsheet itself to an asset's Excel datasets. */
function AttachToAsset({ file }: { file: File | null }) {
  const toast = useToast();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? (assets || []).filter(a => [a.name, a.assetId, a.assetCode].some(v => (v || '').toLowerCase().includes(t))).slice(0, 8) : [];
  }, [assets, q]);

  async function attach() {
    if (!file || !picked) return;
    setBusy(true);
    try { await assetsApi.uploadSpreadsheet(picked.assetId, file); toast(`${file.name} attached to ${picked.name}`); }
    catch (err) { toast(errorMessage(err), 'error'); }
    finally { setBusy(false); }
  }

  return (
    <section className="card form-section">
      <h2 className="form-section-title">Attach the spreadsheet to an asset</h2>
      <p className="cell-sub" style={{ marginBottom: 10 }}>Stores the file on an existing asset (its Excel datasets) instead of creating new assets.</p>
      {picked ? (
        <div className="picked-asset" style={{ marginBottom: 10 }}>
          <div><strong>{picked.name}</strong><div className="id-cell" style={{ maxWidth: 'none' }}>{assetKey(picked)}</div></div>
          <button className="btn btn-ghost btn-xs" onClick={() => setPicked(null)}>Change</button>
        </div>
      ) : (
        <>
          <input className="form-control" placeholder="Search assets by name or ID…" value={q}
                 onFocus={() => { if (!assets) assetsApi.fetchAllAssets().then(setAssets).catch(() => setAssets([])); }}
                 onChange={e => setQ(e.target.value)} />
          {matches.length > 0 && <div className="picker-list">{matches.map(a => (
            <button key={assetKey(a)} className="picker-item" onClick={() => { setPicked(a); setQ(''); }}>
              <strong>{a.name}</strong><span className="cell-sub">{assetKey(a)} · {a.state || '—'}</span></button>
          ))}</div>}
        </>
      )}
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} disabled={!file || !picked || busy} onClick={attach}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paperclip'}`} /> {file ? `Attach ${file.name}` : 'Choose a file above first'}
      </button>
    </section>
  );
}
