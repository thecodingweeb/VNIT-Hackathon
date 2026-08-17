import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MiniMap.css';

// Pench Tiger Reserve approx center
const CENTER = [21.74, 79.37];
const ZOOM   = 11;

// Dark OSM tiles
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export default function MiniMap({ centroids = [] }) {
  const mapRef     = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: CENTER,
      zoom: ZOOM,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, { maxZoom: 18 }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    instanceRef.current = map;

    return () => {
      map.remove();
      instanceRef.current = null;
    };
  }, []);

  /* Add/update markers when centroids change */
  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    centroids.forEach(c => {
      const icon = L.divIcon({
        html: `<div class="map-marker" style="background:${c.color};box-shadow:0 0 8px ${c.color}88;"></div>`,
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([c.lat, c.lng], { icon })
        .bindPopup(`<div class="map-popup"><b>${c.id}</b><br/><small>Pench Centroid</small></div>`)
        .addTo(map);
    });
  }, [centroids]);

  return <div ref={mapRef} className="mini-map" id="dashboard-mini-map" />;
}
