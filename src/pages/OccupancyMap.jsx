import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, ChevronRight, ChevronLeft, CheckSquare, Square } from 'lucide-react';
import Badge from '../components/ui/Badge';
import './OccupancyMap.css';

const CENTER = [21.74, 79.37];

const TIGERS = [
  { id: 'PTR-T-001', color: '#FF8C30', status: 'active',      lat: 21.730, lng: 79.310, range: 42.6 },
  { id: 'PTR-T-007', color: '#3860FF', status: 'active',      lat: 21.760, lng: 79.380, range: 38.1 },
  { id: 'PTR-T-021', color: '#10B981', status: 'provisional', lat: 21.700, lng: 79.420, range: 22.3 },
  { id: 'PTR-T-041', color: '#F04444', status: 'active',      lat: 21.790, lng: 79.270, range: 55.2 },
  { id: 'PTR-T-095', color: '#8B5CF6', status: 'active',      lat: 21.680, lng: 79.350, range: 28.9 },
  { id: 'PTR-T-003', color: '#41B8AC', status: 'absent',      lat: 21.740, lng: 79.440, range: 47.8 },
];

const STATIONS = [
  { id: 'ST-42', lat: 21.7821, lng: 79.3342, zone: 'Core'   },
  { id: 'ST-18', lat: 21.7540, lng: 79.3710, zone: 'Buffer' },
  { id: 'ST-37', lat: 21.7130, lng: 79.4120, zone: 'Core'   },
  { id: 'ST-09', lat: 21.7280, lng: 79.3580, zone: 'Core'   },
  { id: 'ST-12', lat: 21.7650, lng: 79.3200, zone: 'Core'   },
  { id: 'ST-24', lat: 21.7420, lng: 79.3950, zone: 'Buffer' },
  { id: 'ST-63', lat: 21.7900, lng: 79.3650, zone: 'Buffer' },
];

const ZONE_STATION_COLOR = { Core: '#22C55E', Buffer: '#F59E0B' };

export default function OccupancyMap() {
  const mapRef      = useRef(null);
  const instanceRef = useRef(null);
  const markersRef  = useRef({});
  const circlesRef  = useRef({});

  const [panelOpen,    setPanelOpen]    = useState(true);
  const [layerPanel,   setLayerPanel]   = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [visibleTigers,setVisibleTigers]= useState(new Set(TIGERS.map(t => t.id)));
  const [layers, setLayers] = useState({
    stations: true,
    kde95: true,
    kde50: false,
    centroids: true,
  });

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    instanceRef.current = map;

    // Draw stations
    STATIONS.forEach(s => {
      const color = ZONE_STATION_COLOR[s.zone] || '#6B7280';
      L.circleMarker([s.lat, s.lng], {
        radius: 7,
        fillColor: color,
        color: color,
        weight: 2,
        fillOpacity: 0.85,
        className: `station-marker station-${s.id}`,
      })
        .bindPopup(`<div class="map-popup"><b>${s.id}</b><br/>${s.zone} Zone</div>`)
        .addTo(map);
    });

    // Draw tiger KDE polygons + centroid markers
    TIGERS.forEach(t => {
      const offsetFactor = 0.03;
      // 95% KDE circle
      const kde95 = L.circle([t.lat, t.lng], {
        radius: t.range * 700,
        fillColor: t.color,
        color: t.color,
        weight: 2,
        fillOpacity: 0.10,
        opacity: 0.45,
        className: `kde95-${t.id}`,
      }).addTo(map);

      // Centroid marker
      const icon = L.divIcon({
        html: `<div class="centroid-marker" style="background:${t.color};box-shadow:0 0 10px ${t.color}99;">
                 <span>${t.id.split('-').pop()}</span>
               </div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const marker = L.marker([t.lat, t.lng], { icon })
        .bindPopup(`
          <div class="map-popup">
            <b style="color:${t.color}">${t.id}</b><br/>
            <small>${t.range} km² range · ${t.status}</small>
          </div>
        `)
        .addTo(map);

      markersRef.current[t.id] = marker;
      circlesRef.current[t.id] = kde95;

      marker.on('click', () => setSelected(t));
    });

    return () => { map.remove(); instanceRef.current = null; };
  }, []);

  // Toggle tiger visibility
  function toggleTiger(id) {
    const map = instanceRef.current;
    if (!map) return;
    const next = new Set(visibleTigers);
    if (next.has(id)) {
      next.delete(id);
      markersRef.current[id]?.removeFrom(map);
      circlesRef.current[id]?.removeFrom(map);
    } else {
      next.add(id);
      markersRef.current[id]?.addTo(map);
      circlesRef.current[id]?.addTo(map);
    }
    setVisibleTigers(next);
  }

  // Fly to tiger
  function flyTo(t) {
    instanceRef.current?.flyTo([t.lat, t.lng], 13, { duration: 1.2 });
    setSelected(t);
  }

  return (
    <div className="omap-page">
      {/* ── Map ── */}
      <div ref={mapRef} className="omap-container" id="occupancy-map" />

      {/* ── Left: tiger selector panel ── */}
      <div className={`omap-left-panel ${panelOpen ? '' : 'omap-left-panel--collapsed'}`}>
        <button className="omap-panel-toggle" onClick={() => setPanelOpen(v => !v)}>
          {panelOpen ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
        </button>
        {panelOpen && (
          <>
            <div className="omap-panel-header">
              <span className="omap-panel-title">Tiger Individuals</span>
              <button className="omap-select-all" onClick={() => {
                const map = instanceRef.current;
                if (!map) return;
                if (visibleTigers.size === TIGERS.length) {
                  TIGERS.forEach(t => { markersRef.current[t.id]?.removeFrom(map); circlesRef.current[t.id]?.removeFrom(map); });
                  setVisibleTigers(new Set());
                } else {
                  TIGERS.forEach(t => { markersRef.current[t.id]?.addTo(map); circlesRef.current[t.id]?.addTo(map); });
                  setVisibleTigers(new Set(TIGERS.map(t => t.id)));
                }
              }}>
                {visibleTigers.size === TIGERS.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="omap-tiger-list">
              {TIGERS.map(t => {
                const visible = visibleTigers.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={`omap-tiger-row ${selected?.id === t.id ? 'omap-tiger-row--selected' : ''}`}
                    onClick={() => flyTo(t)}
                  >
                    <div className="omap-tiger-check" onClick={e => { e.stopPropagation(); toggleTiger(t.id); }}>
                      {visible ? <CheckSquare size={15} color={t.color}/> : <Square size={15} color="var(--fg-muted)"/>}
                    </div>
                    <div className="omap-tiger-dot" style={{ background: t.color, boxShadow: `0 0 6px ${t.color}88` }}/>
                    <div className="omap-tiger-info">
                      <span className="omap-tiger-id font-mono font-bold">{t.id}</span>
                      <span className="omap-tiger-meta text-xs text-muted font-mono">{t.range} km²</span>
                    </div>
                    <Badge variant={t.status} style={{ fontSize: '10px' }}>{t.status.slice(0,3)}</Badge>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Right: detail panel (when tiger selected) ── */}
      {selected && (
        <div className="omap-right-panel">
          <div className="omap-right-header">
            <div>
              <span className="font-mono omap-right-id" style={{ color: selected.color, fontSize: '18px', fontWeight: 700 }}>{selected.id}</span>
              <div className="text-xs text-muted font-mono">Pench Tiger Reserve Individual</div>
            </div>
            <button className="cat-modal-close" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="omap-right-stats">
            {[
              { label: 'Status',    value: selected.status },
              { label: 'Home range',value: `${selected.range} km²` },
              { label: 'Last seen', value: 'Today' },
            ].map(({ label, value }) => (
              <div className="omap-stat-item" key={label}>
                <span className="omap-stat-label">{label}</span>
                <span className="omap-stat-value font-mono">{value}</span>
              </div>
            ))}
          </div>
          <button className="cat-btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => instanceRef.current?.flyTo([selected.lat, selected.lng], 14, { duration: 1.2 })}>
            Centre on map
          </button>
        </div>
      )}

      {/* ── Layer toggle ── */}
      <button className="omap-layer-btn" onClick={() => setLayerPanel(v => !v)}>
        <Layers size={16}/> Layers
      </button>
      {layerPanel && (
        <div className="omap-layer-panel">
          {Object.entries({ stations: 'Camera Stations', kde95: 'KDE 95%', kde50: 'KDE 50% (core)', centroids: 'Centroids' }).map(([key, label]) => (
            <label key={key} className="omap-layer-item">
              <input type="checkbox" checked={layers[key]} onChange={() => setLayers(l => ({ ...l, [key]: !l[key] }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
