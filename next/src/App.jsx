import { useEffect, useState } from 'react';
import { getJson, getSession, isAdmin, logout } from './api';
import Login from './Login';
import Shell from './Shell';

export default function App() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    getSession().then(setUser).catch(() => {}).finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!isAdmin(user)) return undefined;
    let alive = true;
    const load = () => {
      Promise.all([getJson('/devices'), getJson('/users')]).then(([deviceList, userList]) => {
        if (!alive) return;
        setDevices(deviceList);
        setUsers(userList);
      }).catch(() => {});
    };
    load();
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [user, refresh]);

  if (!checked) return null;
  if (!user) return <Login onLogin={setUser} />;
  if (!isAdmin(user)) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="text-muted">
          Нужен аккаунт администратора платформы.{' '}
          <a href="/" onClick={() => logout()}>Сменить пользователя</a>
        </div>
      </div>
    );
  }
  return <Shell user={user} devices={devices} users={users} reload={() => setRefresh((n) => n + 1)} />;
}
