import { useEffect, useState } from 'react';
import { getSession, getJson } from './api';
import Login from './Login';
import Shell from './Shell';

export default function App() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getSession().then(setUser).catch(() => {}).finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!user?.administrator) return undefined;
    let alive = true;
    const load = () => {
      Promise.all([getJson('/devices?all=true'), getJson('/users')]).then(([deviceList, userList]) => {
        if (!alive) return;
        setDevices(deviceList);
        setUsers(userList);
      }).catch(() => {});
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [user]);

  if (!checked) return null;
  if (!user) return <Login onLogin={setUser} />;
  if (!user.administrator) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="text-muted">Нужен аккаунт администратора. <a href="/next/" onClick={() => localStorage.clear()}>Сменить пользователя</a></div>
      </div>
    );
  }
  return <Shell user={user} devices={devices} users={users} />;
}
