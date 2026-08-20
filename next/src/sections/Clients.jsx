import { useEffect, useState } from 'react';
import { api, getJson } from '../api';
import { Blueprint } from '../ui';

export default function Clients({ users, search }) {
  const [deviceMap, setDeviceMap] = useState({}); // userId -> devices[]
  const [open, setOpen] = useState(null); // раскрытая строка
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [localUsers, setLocalUsers] = useState(null);

  const list = (localUsers ?? users).filter((u) => !u.administrator);

  useEffect(() => {
    let alive = true;
    // прямые связи + доступ через группы: /devices?userId возвращает только прямые
    getJson('/devices?all=true').then((allDevices) =>
      Promise.all(users.map(async (u) => {
        const [direct, groups] = await Promise.all([
          getJson(`/devices?userId=${u.id}`).catch(() => []),
          getJson(`/groups?userId=${u.id}`).catch(() => []),
        ]);
        const groupIds = new Set(groups.map((g) => g.id));
        const byId = new Map(direct.map((d) => [d.id, d]));
        allDevices.forEach((d) => { if (groupIds.has(d.groupId)) byId.set(d.id, d); });
        return [u.id, [...byId.values()]];
      })),
    ).then((entries) => { if (alive) setDeviceMap(Object.fromEntries(entries)); }).catch(() => {});
    return () => { alive = false; };
  }, [users]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter((u) => [u.name, u.email, u.phone].some((f) => f?.toLowerCase().includes(q)))
    : list;

  const create = async () => {
    setError(null);
    try {
      const response = await api('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password }),
      });
      const created = await response.json();
      setLocalUsers([...(localUsers ?? users), created]);
      setCreating(false);
      setForm({ name: '', email: '', phone: '', password: '' });
    } catch (e) {
      setError(e.message);
    }
  };

  const exportCsv = () => {
    const rows = [['Клиент', 'Email', 'Телефон', 'Объектов', 'Статус']];
    filtered.forEach((u) => rows.push([u.name, u.email, u.phone ?? '', deviceMap[u.id]?.length ?? 0, u.disabled ? 'Отключён' : 'Активен']));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' }));
    a.download = 'clients.csv';
    a.click();
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Новый клиент</button>
        <button className="btn btn-secondary" onClick={exportCsv}>Экспорт</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Клиент</th><th>Контакт</th><th>Объектов</th><th>Тариф</th><th>Баланс</th><th>Статус</th><th /></tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              devices={deviceMap[u.id]}
              open={open === u.id}
              toggle={() => setOpen(open === u.id ? null : u.id)}
            />
          ))}
        </tbody>
      </table>
      {creating && (
        <div className="dialog-backdrop" onClick={() => setCreating(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Новый клиент</div>
            <div className="field"><label>Имя / название</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>Телефон</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>Пароль</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            {error && <div style={{ fontSize: 13, color: '#c0392b' }}>{error}</div>}
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setCreating(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={create} disabled={!form.name || !form.email || !form.password}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ user, devices, open, toggle }) {
  return (
    <>
      <tr>
        <td><b>{user.name}</b><div className="text-muted" style={{ fontSize: 12 }}>{user.email}</div></td>
        <td>{user.phone || '—'}</td>
        <td>{devices ? devices.length : '…'}</td>
        <td>3 000 ֏</td>
        <td className="text-muted">—</td>
        <td>
          <span className={user.disabled ? 'tag tag-neutral' : 'tag tag-accent'}>
            {user.disabled ? 'Отключён' : 'Активен'}
          </span>
        </td>
        <td><button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={toggle}>{open ? 'Скрыть' : 'Открыть'}</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ padding: 12 }}>
            <Blueprint style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {(devices ?? []).length === 0 && <span className="text-muted">Устройств нет</span>}
              {(devices ?? []).map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: 10 }}>
                  <b>{d.name}</b>
                  <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.uniqueId}</span>
                  <span className={d.status === 'online' ? 'tag tag-accent' : 'tag tag-neutral'} style={{ marginLeft: 'auto' }}>
                    {d.status === 'online' ? 'На связи' : 'Офлайн'}
                  </span>
                </div>
              ))}
            </Blueprint>
          </td>
        </tr>
      )}
    </>
  );
}
