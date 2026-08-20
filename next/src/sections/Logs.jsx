import { useEffect, useState } from 'react';
import { fmt, getJson } from '../api';
import { Blueprint } from '../ui';

const EVENT_TEXT = {
  deviceOnline: ['INFO', 'ingest', (n) => `${n}: устройство вышло на связь`],
  deviceOffline: ['WARN', 'ingest', (n) => `${n}: потеря связи`],
  deviceOverspeed: ['ALARM', 'rules', (n) => `${n}: превышение скорости`],
  geofenceEnter: ['INFO', 'rules', (n) => `${n}: въезд в геозону`],
  geofenceExit: ['INFO', 'rules', (n) => `${n}: выезд из геозоны`],
  ignitionOn: ['INFO', 'ingest', (n) => `${n}: зажигание включено`],
  ignitionOff: ['INFO', 'ingest', (n) => `${n}: зажигание выключено`],
  deviceMoving: ['INFO', 'rules', (n) => `${n}: начало движения`],
  deviceStopped: ['INFO', 'rules', (n) => `${n}: остановка`],
  alarm: ['ALARM', 'rules', (n) => `${n}: тревога`],
};

export default function Logs({ devices }) {
  const [apiMs, setApiMs] = useState(null);
  const [messagesToday, setMessagesToday] = useState(null);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    const start = performance.now();
    getJson('/health').then(() => setApiMs(Math.round(performance.now() - start))).catch(() => {});

    const from = new Date(); from.setHours(0, 0, 0, 0);
    getJson(`/admin/statistics?from=${from.toISOString()}&to=${new Date().toISOString()}`)
      .then((rows) => setMessagesToday(rows.reduce((s, r) => s + (r.messagesStored ?? 0), 0)))
      .catch(() => {});

    const ids = devices.map((d) => d.id);
    if (ids.length) {
      const q = new URLSearchParams();
      ids.forEach((id) => q.append('deviceId', id));
      q.append('from', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
      q.append('to', new Date().toISOString());
      getJson(`/reports/events?${q}`)
        .then((list) => setEvents(list.sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime)).slice(0, 50)))
        .catch(() => setEvents([]));
    } else {
      setEvents([]);
    }
    // разово при открытии раздела
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const online = devices.filter((d) => d.status === 'online').length;
  const nameById = Object.fromEntries(devices.map((d) => [d.id, d.name]));

  const kpi = [
    { k: 'Приём телеметрии', v: online > 0 ? 'OK' : 'Нет данных', dot: online > 0 ? '#01a586' : '#c0392b' },
    { k: 'API', v: apiMs != null ? `${apiMs} мс` : '…', dot: apiMs != null && apiMs < 1000 ? '#01a586' : '#c0392b' },
    { k: 'Пакетов сегодня', v: messagesToday != null ? fmt(messagesToday) : '…', dot: '#01a586' },
    { k: 'На связи', v: `${online} / ${devices.length}`, dot: online === devices.length ? '#01a586' : '#0c7fc3' },
  ];

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, maxWidth: 900 }}>
        {kpi.map((c) => (
          <Blueprint key={c.k} style={{ padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>{c.k}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, animation: 'pulse 1.6s infinite' }} />
              {c.v}
            </div>
          </Blueprint>
        ))}
      </div>
      <table className="table" style={{ fontFamily: 'monospace', fontSize: 12.5 }}>
        <thead><tr><th>Время</th><th>Уровень</th><th>Сервис</th><th>Сообщение</th></tr></thead>
        <tbody>
          {events === null && <tr><td colSpan={4} className="text-muted">Загрузка…</td></tr>}
          {events?.length === 0 && <tr><td colSpan={4} className="text-muted" style={{ padding: 20 }}>Событий за последние сутки нет</td></tr>}
          {events?.map((event) => {
            const [level, service, text] = EVENT_TEXT[event.type] ?? ['INFO', 'events', (n) => `${n}: ${event.type}`];
            return (
              <tr key={event.id}>
                <td className="text-muted">{new Date(event.eventTime).toLocaleTimeString('ru-RU')}</td>
                <td><span className={level === 'INFO' ? 'tag tag-neutral' : 'tag tag-outline'}>{level}</span></td>
                <td>{service}</td>
                <td>{text(nameById[event.deviceId] ?? `#${event.deviceId}`)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
