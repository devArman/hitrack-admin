import { useEffect, useState } from 'react';
import { api, formatTime, getJson } from '../api';
import { Blueprint } from '../ui';

/** Сотрудники платформы и роли (ht_users / ht_roles). Клиенты — в разделе «Клиенты». */
export default function Staff({ reload }) {
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });
  const [error, setError] = useState(null);

  const load = () => {
    Promise.all([getJson('/users'), getJson('/roles')])
      .then(([userList, roleList]) => {
        setUsers(userList.filter((u) => u.role?.name !== 'client'));
        setRoles(roleList);
      })
      .catch(() => {});
  };

  useEffect(load, []);

  if (users === null) return <div className="text-muted" style={{ padding: 20 }}>Загрузка…</div>;

  const invite = async () => {
    setError(null);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, email: form.email, password: form.password,
          ...(form.roleId ? { roleId: Number(form.roleId) } : {}),
        }),
      });
      setInviting(false);
      setForm({ name: '', email: '', password: '', roleId: '' });
      load();
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleDisabled = async (user) => {
    await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ disabled: !user.disabled }) });
    load();
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => setInviting(true)}>+ Пригласить</button>
      </div>
      <table className="table">
        <thead><tr><th>Пользователь</th><th>Email</th><th>Роль</th><th>Создан</th><th>Статус</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b></td>
              <td>{u.email}</td>
              <td><span className={u.role?.permissions?.includes('*') ? 'tag tag-accent-2' : 'tag tag-neutral'}>{u.role?.name ?? '—'}</span></td>
              <td className="text-muted">{formatTime(u.createdAt)}</td>
              <td><span className={u.disabled ? 'tag tag-neutral' : 'tag tag-accent'}>{u.disabled ? 'Отключён' : 'Активен'}</span></td>
              <td>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleDisabled(u)}>
                  {u.disabled ? 'Включить' : 'Отключить'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Blueprint style={{ padding: 16 }}>
        <h6 style={{ margin: '0 0 8px' }}>Роли</h6>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontSize: 13 }}>
          {roles.map((role) => (
            <div key={role.id}>
              <b>{role.name}</b>
              <div className="text-muted">{role.description || '—'}</div>
              <div className="text-muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {role.permissions.length ? role.permissions.join(', ') : 'без прав'}
              </div>
            </div>
          ))}
        </div>
      </Blueprint>

      {inviting && (
        <div className="dialog-backdrop" onClick={() => setInviting(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Новый пользователь платформы</div>
            <div className="field"><label>Имя</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>Пароль</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="field">
              <label>Роль</label>
              <select className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                <option value="">— без роли —</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </div>
            {error && <div style={{ fontSize: 13, color: '#c0392b' }}>{error}</div>}
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setInviting(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={invite} disabled={!form.name || !form.email || form.password.length < 6}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
