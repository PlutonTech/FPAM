import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L, { type Map as LeafletMap } from 'leaflet';
import * as assetsApi from '../api/assets';
import { errorMessage } from '../api/client';
import { useToast } from '../components/Toast';
import { ConditionTag, GeomIcon, TypeTag } from '../components/Tags';
import type { Asset } from '../types';
import { ASSET_TYPES, CONDITIONS, CONDITION_COLORS, assetKey, coords } from '../lib/assets';

const TILES = {
  road: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery &copy; Esri' },
};
const ABUJA: [number, number] = [9.0765, 7.3986];
const UNSET_COLOR = '#7b8794';

type Located = { a: Asset; lat: number; lng: number };

/** Hands the Leaflet map instance up and reports the cursor position. */
function MapBridge({ onReady, onCursor }: { onReady: (m: LeafletMap) => void; onCursor: (s: string) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  useMapEvents({ mousemove: e => onCursor(`${e.latlng.lat.toFixed(5)}°N, ${e.latlng.lng.toFixed(5)}°E`) });
  return null;
}

export default function MapPage() {
  const toast = useToast();
  const [all, setAll] = useState<Asset[] | null>(null);
  const [error, setError] = useState('');
  const [type, setType] = useState('');
  const [cond, setCond] = useState('');
  const [tile, setTile] = useState<'road' | 'satellite'>('road');
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [cursor, setCursor] = useState('');
  const [selected, setSelected] = useState<Located | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { assetsApi.fetchAllAssets().then(setAll).catch(err => setError(errorMessage(err))); }, []);

  // Only assets with real coordinates (0,0 is a common "missing" placeholder).
  const located = useMemo<Located[]>(() => (all || []).flatMap(a => {
    const c = coords(a);
    return c && !(c.lat === 0 && c.lng === 0) ? [{ a, ...c }] : [];
  }), [all]);

  const shown = useMemo(() => located.filter(({ a }) =>
    (!type || a.type === type) && (!cond || (cond === 'none' ? !a.condition : a.condition === cond))), [located, type, cond]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return shown.slice(0, 50);
    return shown.filter(({ a }) => [a.name, a.assetId, a.assetCode, a.state, a.lga, a.type, a.mda]
      .some(v => (v || '').toLowerCase().includes(t))).slice(0, 50);
  }, [shown, q]);

  const fitTo = (m: LeafletMap | null, list: Located[]) => {
    if (!m || !list.length) return;
    m.fitBounds(L.latLngBounds(list.map(s => [s.lat, s.lng] as [number, number])).pad(0.1));
  };
  const fitAll = () => fitTo(map, shown);

  // Fit once, when the map and the data are both ready.
  const [fitted, setFitted] = useState(false);
  useEffect(() => {
    if (map && located.length && !fitted) { fitTo(map, located); setFitted(true); }
  }, [map, located, fitted]);

  const focus = (s: Located) => {
    setSelected(s);
    map?.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  };

  const locateMe = () => {
    if (!navigator.geolocation) { toast('Geolocation is not supported by this browser', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      p => map?.flyTo([p.coords.latitude, p.coords.longitude], 14),
      () => toast('Could not get your location', 'error'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const missing = (all?.length || 0) - located.length;

  return (
    <div className="map-page">
      <MapContainer center={ABUJA} zoom={6} preferCanvas zoomControl={false} className="map-full">
        <TileLayer key={tile} url={TILES[tile].url} attribution={TILES[tile].attribution} />
        <MapBridge onReady={setMap} onCursor={setCursor} />
        {shown.map(s => {
          const color = CONDITION_COLORS[s.a.condition || ''] || UNSET_COLOR;
          const isSel = selected && assetKey(selected.a) === assetKey(s.a);
          return (
            <CircleMarker key={assetKey(s.a)} center={[s.lat, s.lng]} radius={isSel ? 9 : 6}
                          pathOptions={{ color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 0.95 }}
                          eventHandlers={{ click: () => focus(s) }}>
              <Tooltip direction="top" offset={[0, -6]}>
                <strong>{s.a.name}</strong><br /><span style={{ fontSize: 11 }}>{s.a.type || '—'} · {s.a.condition || 'Not set'}</span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Filters + legend, top-left */}
      <div className="map-float map-filters">
        <select className="filter-input" value={type} onChange={e => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>{ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="filter-input" value={cond} onChange={e => setCond(e.target.value)} aria-label="Condition">
          <option value="">All conditions</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}
          <option value="none">Not set</option>
        </select>
        <div className="map-legend" aria-label="Legend">
          {[...CONDITIONS, 'Not set'].map(c => (
            <span key={c}><i style={{ background: CONDITION_COLORS[c] || UNSET_COLOR }} />{c}</span>
          ))}
        </div>
      </div>

      {/* Controls, top-right */}
      <div className="map-float map-controls">
        <button className="btn btn-ghost btn-sm" onClick={() => setTile(t => (t === 'road' ? 'satellite' : 'road'))}>
          <i className={`fa-solid ${tile === 'road' ? 'fa-satellite' : 'fa-map'}`} /> {tile === 'road' ? 'Satellite' : 'Road map'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={locateMe}><i className="fa-solid fa-location-crosshairs" /> My location</button>
        <button className="btn btn-ghost btn-sm" onClick={fitAll}><i className="fa-solid fa-maximize" /> Fit all</button>
      </div>
      <div className="map-float map-zoom">
        <button className="btn btn-ghost btn-sm" onClick={() => map?.zoomIn()} aria-label="Zoom in"><i className="fa-solid fa-plus" /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => map?.zoomOut()} aria-label="Zoom out"><i className="fa-solid fa-minus" /></button>
      </div>

      {/* Search, bottom-left */}
      <div className={`map-float map-search${searchOpen ? ' open' : ''}`}>
        {!searchOpen ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setSearchOpen(true)}>
            <i className="fa-solid fa-magnifying-glass" /> Search assets <span className="tag tag-blue">{shown.length.toLocaleString()}</span>
          </button>
        ) : (
          <>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="form-control" autoFocus placeholder="Name, ID, state, type, MDA…" value={q} onChange={e => setQ(e.target.value)} />
              <button className="btn btn-ghost btn-sm" onClick={() => setSearchOpen(false)} aria-label="Close search"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="cell-sub" style={{ margin: '6px 2px' }}>
              {shown.length.toLocaleString()} on map{missing > 0 ? ` · ${missing.toLocaleString()} without coordinates` : ''}
            </div>
            <div className="map-results">
              {results.map(s => (
                <button key={assetKey(s.a)} className="map-result" onClick={() => focus(s)}>
                  <span className="map-dot" style={{ background: CONDITION_COLORS[s.a.condition || ''] || UNSET_COLOR }} />
                  <span style={{ minWidth: 0 }}>
                    <span className="map-result-name">{s.a.name}</span>
                    <span className="cell-sub">{[s.a.type, s.a.state].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              ))}
              {results.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 8 }}>No matches</div>}
            </div>
          </>
        )}
      </div>

      {/* Selected asset panel, right */}
      {selected && (
        <aside className="map-float map-panel">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <span className="id-cell" style={{ maxWidth: 'none' }}>{assetKey(selected.a)}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 8px' }}>{selected.a.name}</div>
          <div className="row" style={{ marginBottom: 12 }}><TypeTag value={selected.a.type} /><ConditionTag value={selected.a.condition} /></div>
          <div className="meta-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div><div className="meta-key">Coordinates</div><div className="meta-val mono" style={{ fontSize: 11 }}>{selected.lat.toFixed(6)}°N, {selected.lng.toFixed(6)}°E</div></div>
            <div><div className="meta-key">Geometry</div><div className="meta-val"><GeomIcon geom={selected.a.geomType} /> {selected.a.geomType || '—'}</div></div>
            {selected.a.mda && <div><div className="meta-key">MDA</div><div className="meta-val">{selected.a.mda}</div></div>}
            {selected.a.state && <div><div className="meta-key">Location</div><div className="meta-val">{[selected.a.lga, selected.a.state].filter(Boolean).join(', ')}</div></div>}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn btn-primary btn-sm" to={`/assets/${encodeURIComponent(assetKey(selected.a))}`}><i className="fa-solid fa-eye" /> View detail</Link>
            <button className="btn btn-ghost btn-sm" onClick={() => map?.flyTo([selected.lat, selected.lng], 17)}><i className="fa-solid fa-magnifying-glass-plus" /> Zoom in</button>
          </div>
        </aside>
      )}

      {cursor && <div className="map-cursor mono">{cursor}</div>}
      {all === null && !error && <div className="map-float map-status"><i className="fa-solid fa-spinner fa-spin" /> Loading assets…</div>}
      {error && <div className="map-float map-status form-error">Could not load assets: {error}</div>}
    </div>
  );
}
