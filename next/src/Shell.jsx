import { useEffect, useState } from 'react';
import { Icon } from './ui';
import Dashboard from './sections/Dashboard';
import Clients from './sections/Clients';
import Groups from './sections/Groups';
import Announcements from './sections/Announcements';
import Geofences from './sections/Geofences';
import Devices from './sections/Devices';
import Billing from './sections/Billing';
import Sim from './sections/Sim';
import Orders from './sections/Orders';
import Staff from './sections/Staff';
import Logs from './sections/Logs';
import MapAll from './sections/MapAll';

const NAV = [
  ['dash', 'Дашборд', 'layout-dashboard'],
  ['map', 'Карта', 'map-pin'],
  ['clients', 'Клиенты', 'users'],
  ['groups', 'Группы', 'boxes'],
  ['announcements', 'Объявления', 'megaphone'],
  ['geofences', 'Геозоны', 'hexagon'],
  ['devices', 'Трекеры', 'cpu'],
  ['billing', 'Биллинг', 'receipt'],
  ['sim', 'SIM-карты', 'smartphone'],
  ['orders', 'Заявки', 'wrench'],
  ['users', 'Пользователи', 'shield'],
  ['logs', 'Логи', 'terminal'],
];

const TITLES = {
  dash: 'Дашборд', map: 'Карта', clients: 'Клиенты', groups: 'Группы', announcements: 'Объявления', geofences: 'Геозоны', devices: 'Устройства / трекеры', billing: 'Биллинг и тарифы',
  sim: 'SIM-карты', orders: 'Заявки на установку', users: 'Пользователи и роли', logs: 'Логи и мониторинг',
};


// раздел живёт в URL (#/dash, #/clients…): F5 возвращает туда же, работает «назад»
function useHashSection(valid, fallback) {
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, '');
    return valid.includes(h) ? h : fallback;
  };
  const [section, setSection] = useState(read);
  useEffect(() => {
    const onHash = () => setSection(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (window.location.hash.replace(/^#\/?/, '') !== section) {
      window.history.replaceState(null, '', `#/${section}`);
    }
  }, [section]);
  return [section, setSection];
}

export default function Shell({ user, devices, users, reload }) {
  const [section, setSection] = useHashSection(NAV.map(([id]) => id), 'dash');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'light');
  const [search, setSearch] = useState('');

  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);

  const initials = (user.name || user.email).split(/[\s@]+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
  const sectionProps = { devices, users, search, setSection, reload };

  return (
    <div data-theme={theme} style={{ display: 'flex', height: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
      <div style={{ width: 216, flex: 'none', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-divider)', background: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--color-divider)' }}>
          <img src="/logo.svg" alt="HiTrack" style={{ width: 34, height: 34 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, letterSpacing: '.04em' }}>HITRACK</div>
            <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-accent-2)' }}>Администрирование</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 8px', flex: 1, overflow: 'auto' }}>
          {NAV.map(([id, label, icon]) => {
            const active = section === id;
            return (
              <div
                key={id}
                onClick={() => setSection(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', cursor: 'pointer', fontSize: 14,
                  borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                  background: active ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'inherit',
                }}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--color-divider)' }}>
          <button className="btn btn-secondary btn-block" style={{ marginTop: 0 }} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
            {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid var(--color-divider)', flex: 'none' }}>
          <h4 style={{ margin: 0, fontSize: 21 }}>{TITLES[section]}</h4>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <input className="input" placeholder="Поиск: клиент, IMEI, номер…" style={{ width: 260, minHeight: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="tag tag-accent-2">admin</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'var(--grad-brand)', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: 13 }}>
                {initials}
              </span>
              {user.name || user.email}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: ['geofences', 'map'].includes(section) ? 'hidden' : 'auto', display: ['geofences', 'map'].includes(section) ? 'flex' : 'block' }}>
          {section === 'dash' && <Dashboard {...sectionProps} />}
          {section === 'map' && <MapAll {...sectionProps} />}
          {section === 'clients' && <Clients {...sectionProps} />}
          {section === 'groups' && <Groups {...sectionProps} />}
          {section === 'announcements' && <Announcements {...sectionProps} />}
          {section === 'geofences' && <Geofences {...sectionProps} />}
          {section === 'devices' && <Devices {...sectionProps} />}
          {section === 'billing' && <Billing {...sectionProps} />}
          {section === 'sim' && <Sim {...sectionProps} />}
          {section === 'orders' && <Orders {...sectionProps} />}
          {section === 'users' && <Staff {...sectionProps} />}
          {section === 'logs' && <Logs {...sectionProps} />}
        </div>
      </div>
    </div>
  );
}
