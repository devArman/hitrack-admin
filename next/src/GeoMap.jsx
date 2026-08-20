import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const YEREVAN = [40.1792, 44.4991];

/** Карта для геозон в админке: отрисовка зон (красным), клики для рисования новой. */
export default function GeoMap({ geofences, onMapClick, drawPoints }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const drawRef = useRef(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    const map = L.map(containerRef.current).setView(YEREVAN, 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    map.on('click', (e) => clickRef.current?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    mapRef.current = map;
    return () => { observer.disconnect(); map.remove(); };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];
    (geofences ?? []).forEach((geofence) => {
      const layer = parseArea(geofence.area);
      if (layer) {
        layer.bindTooltip(geofence.name);
        layer.addTo(map);
        layersRef.current.push(layer);
      }
    });
    if (geofences?.length) {
      const group = L.featureGroup(layersRef.current);
      if (group.getLayers().length) map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [geofences]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    drawRef.current?.remove();
    drawRef.current = null;
    if (!drawPoints?.length) return;
    const latlngs = drawPoints.map((p) => [p.latitude, p.longitude]);
    drawRef.current = drawPoints.length >= 3
      ? L.polygon(latlngs, { color: '#c0392b', weight: 2.5, dashArray: '6 6', fillOpacity: 0.06 })
      : L.polyline(latlngs, { color: '#c0392b', weight: 2.5, dashArray: '6 6' });
    drawRef.current.addTo(map);
  }, [drawPoints]);

  return <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />;
}

// геозоны — красным
function parseArea(area) {
  const style = { color: '#c0392b', weight: 2.5, fillOpacity: 0.08 };
  let m = area.match(/CIRCLE\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*,\s*([\d.]+)\s*\)/i);
  if (m) return L.circle([+m[1], +m[2]], { radius: +m[3], ...style });
  m = area.match(/POLYGON\s*\(\(\s*(.+)\s*\)\)/i);
  if (m) {
    const points = m[1].split(',').map((pair) => pair.trim().split(/\s+/).map(Number));
    return L.polygon(points, style);
  }
  m = area.match(/LINESTRING\s*\(\s*(.+)\s*\)/i);
  if (m) {
    const points = m[1].split(',').map((pair) => pair.trim().split(/\s+/).map(Number));
    return L.polyline(points, style);
  }
  return null;
}
