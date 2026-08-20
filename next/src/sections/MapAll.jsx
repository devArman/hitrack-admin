import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getJson, KNOTS_TO_KMH, relativeTime } from '../api';

const YEREVAN = [40.1792, 44.4991];

// цвет маркера: движется / стоит / офлайн
function dotColor(device, position) {
  if (device.status !== 'online') return '#98989b';
  const speed = position ? Math.round(position.speed * KNOTS_TO_KMH) : 0;
  return speed > 3 ? '#01a586' : '#0c7fc3';
}

function markerIcon(color) {
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};
      border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  });
}

/** Карта всех трекеров с фильтрами по группе и пользователю. */
export default function MapAll({ devices, users, search }) {
  const [groups, setGroups] = useState([]);
  const [positions, setPositions] = useState({});
  const [groupId, setGroupId] = useState('');
  const [userId, setUserId] = useState('');

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const fittedRef = useRef(false);

  useEffect(() => { getJson('/groups').then(setGroups).catch(() => setGroups([])); }, []);

  // позиции обновляются каждые 15 секунд
  useEffect(() => {
    const load = () => getJson('/positions')
      .then((list) => setPositions(Object.fromEntries(list.map((p) => [p.deviceId, p]))))
      .catch(() => {});
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  // владельцы — из карты прав пользователей (deviceIds)
  const owners = useMemo(() => {
    const map = {};
    users.forEach((u) => (u.deviceIds ?? []).forEach((id) => {
      map[id] = map[id] ? `${map[id]}, ${u.name}` : u.name;
    }));
    return map;
  }, [users]);

  const clients = useMemo(
    () => users.filter((u) => (u.deviceIds ?? []).length > 0 || u.role?.name === 'client'),
    [users],
  );

  const filtered = useMemo(() => {
    let list = devices;
    if (groupId) {
      const allow = new Set(groups.find((g) => g.id === Number(groupId))?.deviceIds ?? []);
      list = list.filter((d) => allow.has(d.id));
    }
    if (userId) {
      const allow = new Set(users.find((u) => u.id === Number(userId))?.deviceIds ?? []);
      list = list.filter((d) => allow.has(d.id));
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((d) => [d.name, d.uniqueId, d.model, owners[d.id]].some((f) => f?.toLowerCase().includes(q)));
    return list;
  }, [devices, groups, users, groupId, userId, search, owners]);

  useEffect(() => {
    const map = L.map(containerRef.current).setView(YEREVAN, 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    mapRef.current = map;
    return () => { observer.disconnect(); map.remove(); };
  }, []);

  // маркеры отфильтрованных трекеров
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set();
    filtered.forEach((device) => {
      const position = positions[device.id];
      if (!position) return;
      seen.add(device.id);
      const speed = Math.round((position.speed ?? 0) * KNOTS_TO_KMH);
      const latlng = [position.latitude, position.longitude];
      const label = `<b>${device.name}</b><br>${owners[device.id] ?? 'не назначен'}<br>`
        + `${device.status === 'online' ? (speed > 3 ? `движется · ${speed} км/ч` : 'стоянка') : 'офлайн'}`
        + ` · ${relativeTime(position.fixTime)}`;
      let marker = markers.get(device.id);
      if (!marker) {
        marker = L.marker(latlng, { icon: markerIcon(dotColor(device, position)) }).addTo(map).bindTooltip(label);
        markers.set(device.id, marker);
      } else {
        marker.setLatLng(latlng);
        marker.setIcon(markerIcon(dotColor(device, position)));
        marker.setTooltipContent(label);
      }
    });
    markers.forEach((marker, id) => {
      if (!seen.has(id)) { marker.remove(); markers.delete(id); }
    });
    if (!fittedRef.current && seen.size > 0) {
      fittedRef.current = true;
      map.fitBounds(L.latLngBounds([...markers.values()].map((m) => m.getLatLng())).pad(0.25), { maxZoom: 13 });
    }
  }, [filtered, positions, owners]);

  // смена фильтра — подлёт к отфильтрованному набору
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !fittedRef.current || markers.size === 0) return;
    map.fitBounds(L.latLngBounds([...markers.values()].map((m) => m.getLatLng())).pad(0.25), { maxZoom: 13 });
    // подлетаем только при смене фильтров, не при каждом обновлении позиций
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userId]);

  const focus = (id) => {
    const p = positions[id];
    if (p) mapRef.current?.flyTo([p.latitude, p.longitude], 15, { duration: 0.8 });
  };

  const noPosition = filtered.filter((d) => !positions[d.id]).length;

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ width: 290, flex: 'none', borderRight: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--color-divider)' }}>
          <div className="field">
            <label>Группа</label>
            <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Все группы</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Пользователь</label>
            <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Все пользователи</option>
              {clients.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Показано {filtered.length} трекеров{noPosition > 0 ? ` · ${noPosition} без позиции` : ''}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((d) => {
            const p = positions[d.id];
            return (
              <div
                key={d.id}
                onClick={() => focus(d.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: p ? 'pointer' : 'default', opacity: p ? 1 : 0.55, border: '1px solid var(--color-divider)' }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: dotColor(d, p) }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                  <div className="text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {owners[d.id] ?? 'не назначен'}{p ? ` · ${relativeTime(p.fixTime)}` : ' · нет позиции'}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-muted" style={{ fontSize: 13, padding: 8 }}>Нет трекеров по фильтру</div>}
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
