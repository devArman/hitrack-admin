import { useEffect, useState } from 'react';
import { fmt, getJson } from '../api';
import { Blueprint } from '../ui';

export default function Dashboard({ devices, users }) {
  const [weeks, setWeeks] = useState([]);

  useEffect(() => {
    const from = new Date(Date.now() - 84 * 86400000);
    getJson(`/statistics?from=${from.toISOString()}&to=${new Date().toISOString()}`)
      .then((rows) => {
        // группируем дневную статистику по неделям: максимум активных устройств
        const byWeek = new Map();
        rows.forEach((row) => {
          const week = Math.floor(new Date(row.captureTime).getTime() / (7 * 86400000));
          byWeek.set(week, Math.max(byWeek.get(week) ?? 0, row.activeDevices ?? 0));
        });
        const list = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n).slice(-12);
        setWeeks(list);
      })
      .catch(() => setWeeks([]));
  }, []);

  const online = devices.filter((d) => d.status === 'online').length;
  const never = devices.filter((d) => !d.lastUpdate).length;
  const offline = devices.length - online - never;
  const stale = devices.filter((d) => d.lastUpdate && d.status !== 'online'
    && Date.now() - new Date(d.lastUpdate).getTime() > 86400000).length;
  const clients = users.filter((u) => !u.administrator).length;

  const kpi = [
    { k: 'Активных трекеров', v: fmt(online), delta: `из ${devices.length} всего`, deltaColor: 'var(--color-accent)' },
    { k: 'Клиентов', v: fmt(clients), delta: 'аккаунтов в системе', deltaColor: 'var(--color-accent)' },
    { k: 'Расчётный MRR', v: `${fmt(devices.length * 3000)} ֏`, delta: '3 000 ֏ × трекер', deltaColor: 'var(--color-accent)' },
    { k: 'Офлайн > 24 ч', v: fmt(stale), delta: stale ? 'требует внимания' : 'всё в порядке', deltaColor: 'var(--color-accent-2)' },
  ];

  const maxWeek = Math.max(...weeks, 1);
  const health = [
    { label: 'На связи', n: online, color: 'var(--color-accent)' },
    { label: 'Офлайн', n: offline, color: 'var(--color-neutral-500)' },
    { label: 'На складе (не подключались)', n: never, color: 'var(--color-accent-2)' },
  ];
  const total = Math.max(devices.length, 1);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {kpi.map((c) => (
          <Blueprint key={c.k} style={{ padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>{c.k}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30 }}>{c.v}</div>
            <div style={{ fontSize: 12, color: c.deltaColor }}>{c.delta}</div>
          </Blueprint>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <Blueprint style={{ padding: 16 }}>
          <h6 style={{ margin: '0 0 12px' }}>Активные трекеры по неделям (12 недель)</h6>
          {weeks.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
              {weeks.map((n, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }} title={`${n}`}>
                  <div style={{ height: `${Math.round((n / maxWeek) * 100)}%`, minHeight: 2, background: i === weeks.length - 1 ? 'var(--color-accent)' : 'var(--color-accent-300)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted" style={{ height: 140, display: 'grid', placeItems: 'center', fontSize: 13 }}>
              Статистика накапливается
            </div>
          )}
        </Blueprint>
        <Blueprint style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h6 style={{ margin: 0 }}>Состояние парка</h6>
          {health.map((h) => (
            <div key={h.label} style={{ fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{h.label}</span><b>{h.n}</b></div>
              <div style={{ height: 5, background: 'var(--color-neutral-200)', marginTop: 4 }}>
                <div style={{ height: '100%', width: `${Math.round((h.n / total) * 100)}%`, background: h.color }} />
              </div>
            </div>
          ))}
        </Blueprint>
      </div>
    </div>
  );
}
