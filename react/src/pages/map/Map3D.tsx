import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// 3D view for the Live Map: terrain (AWS open elevation tiles), 3D building
// shapes (OpenFreeMap / OpenStreetMap data) and the assets as coloured points.
// All sources are free and need no API key. Loaded only when 3D is switched on.

export interface Point3D { key: string; lat: number; lng: number; name: string; sub: string; color: string }
export type MapAsk = { kind: 'fit' } | { kind: 'fly'; lat: number; lng: number; zoom: number };
export type MapRequest = MapAsk & { n: number };

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    road: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '&copy; OpenStreetMap contributors' },
    sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Imagery &copy; Esri' },
    terrain: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Elevation: Mapzen / AWS Open Data' },
    shade: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14 },
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '<a href="https://openfreemap.org">OpenFreeMap</a>' },
    assets: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'road', type: 'raster', source: 'road' },
    { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } },
    { id: 'hillshade', type: 'hillshade', source: 'shade', paint: { 'hillshade-exaggeration': 0.25 } },
    {
      id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-extrusion-color': '#d9d3c7',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    },
    {
      id: 'assets', type: 'circle', source: 'assets',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 6, 17, 9],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
      },
    },
    {
      id: 'selected', type: 'circle', source: 'assets', filter: ['==', ['get', 'key'], ''],
      paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#0B1829', 'circle-stroke-width': 3 },
    },
  ],
  terrain: { source: 'terrain', exaggeration: 1.4 },
};

function bounds(points: Point3D[]) {
  const b = new maplibregl.LngLatBounds();
  points.forEach(p => b.extend([p.lng, p.lat]));
  return b;
}

export default function Map3D({ points, selectedKey, satellite, request, onSelect, onCursor }: {
  points: Point3D[]; selectedKey: string | null; satellite: boolean; request: MapRequest | null;
  onSelect: (key: string) => void; onCursor: (s: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ points, onSelect, onCursor });
  useEffect(() => { latest.current = { points, onSelect, onCursor }; });

  // Create the map once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current!, style: STYLE, center: [7.3986, 9.0765], zoom: 5.5, pitch: 55, bearing: -15,
      maxPitch: 80, attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'map3d-tip' });
    map.on('load', () => {
      ready.current = true;
      setData(map, latest.current.points);
      if (latest.current.points.length) map.fitBounds(bounds(latest.current.points), { padding: 60, pitch: 55, duration: 0, maxZoom: 15 });
    });
    map.on('click', 'assets', e => { const k = e.features?.[0]?.properties?.key; if (k) latest.current.onSelect(String(k)); });
    map.on('mouseenter', 'assets', e => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0];
      if (f) {
        const div = document.createElement('div');
        const b = document.createElement('strong'); b.textContent = String(f.properties?.name || '');
        const s = document.createElement('div'); s.textContent = String(f.properties?.sub || ''); s.style.fontSize = '11px';
        div.append(b, s);
        tip.setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      }
    });
    map.on('mouseleave', 'assets', () => { map.getCanvas().style.cursor = ''; tip.remove(); });
    map.on('mousemove', e => latest.current.onCursor(`${e.lngLat.lat.toFixed(5)}°N, ${e.lngLat.lng.toFixed(5)}°E`));
    return () => { ready.current = false; map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { const m = mapRef.current; if (m && ready.current) setData(m, points); }, [points]);
  useEffect(() => {
    const m = mapRef.current;
    if (m && ready.current) m.setFilter('selected', ['==', ['get', 'key'], selectedKey || '']);
  }, [selectedKey, points]);
  useEffect(() => {
    const m = mapRef.current;
    const apply = () => { m!.setLayoutProperty('road', 'visibility', satellite ? 'none' : 'visible'); m!.setLayoutProperty('sat', 'visibility', satellite ? 'visible' : 'none'); };
    if (!m) return;
    if (ready.current) apply(); else m.once('load', apply);
  }, [satellite]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !request) return;
    const run = () => {
      if (request.kind === 'fit') { if (latest.current.points.length) m.fitBounds(bounds(latest.current.points), { padding: 60, pitch: 55, maxZoom: 15 }); }
      else m.flyTo({ center: [request.lng, request.lat], zoom: request.zoom, pitch: 60, duration: 1200, essential: true });
    };
    if (ready.current) run(); else m.once('load', run);
  }, [request]);

  return <div ref={el} className="map-full map3d" />;
}

function setData(map: MlMap, points: Point3D[]) {
  (map.getSource('assets') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: points.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { key: p.key, name: p.name, sub: p.sub, color: p.color } })),
  });
}
