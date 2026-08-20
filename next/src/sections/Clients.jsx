import { useEffect, useState } from 'react';
import { api, getJson } from '../api';
import { Blueprint } from '../ui';

const genPassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => abc[b % abc.length]).join('');
};

export default function Clients({ users, devices, search }) {
  const [deviceMap, setDeviceMap] = useState({}); // userId -> devices[]
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // данные для передачи клиенту
  const [localUsers, setLocalUsers] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const list = (localUsers ?? users).filter((u) => !u.administrator);

  useEffect(() => {
    let alive = true;
    // прямые связи + доступ через группы: /devices?userId возвращает только прямые
    getJson('/devices?all=true').then((allDevices) =>
      Promise.all((localUsers ?? users).map(async (u) => {
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
  }, [users, localUsers, refresh]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter((u) => [u.name, u.email, u.phone].some((f) => f?.toLowerCase().includes(q)))
    : list;

  const exportCsv = () => {
    const rows = [['Клиент', 'Email', 'Телефон', 'Объектов', 'Статус']];
    filtered.forEach((u) => rows.push([u.name, u.email, u.phone ?? '', deviceMap[u.id]?.length ?? 0, u.disabled ? 'Отключён' : 'Активен']));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' }));
    a.download = 'clients.csv';
    a.click();
  };

  const patchUser = async (user, patch) => {
    const response = await api(`/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, ...patch }),
    });
    const updated = await response.json();
    setLocalUsers((prev) => (prev ?? users).map((u) => (u.id === updated.id ? updated : u)));
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
              patchUser={patchUser}
            />
          ))}
        </tbody>
      </table>

      {creating && (
        <CreateDialog
          devices={devices}
          deviceMap={deviceMap}
          onClose={() => setCreating(false)}
          onCreated={(user, credentials) => {
            setLocalUsers([...(localUsers ?? users), user]);
            setCreating(false);
            setCreated(credentials);
            setRefresh((n) => n + 1);
          }}
        />
      )}
      {created && <CredentialsDialog credentials={created} onClose={() => setCreated(null)} />}
    </div>
  );
}

function CreateDialog({ devices, deviceMap, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: genPassword() });
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // кому уже принадлежит трекер — чтобы отличать свободные
  const owned = new Set(Object.values(deviceMap).flat().map((d) => d.id));
  const sorted = [...devices].sort((a, b) => (owned.has(a.id) - owned.has(b.id)) || a.name.localeCompare(b.name));

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await api('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email.trim(), phone: form.phone, password: form.password }),
      });
      const user = await response.json();
      for (const deviceId of selected) {
        // привязки по одной: Traccar принимает по одной паре за запрос
        // eslint-disable-next-line no-await-in-loop
        await api('/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, deviceId }),
        });
      }
      onCreated(user, { ...form, devices: sorted.filter((d) => selected.has(d.id)).map((d) => d.name) });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="dialog-title">Новый клиент</div>
        <div className="field"><label>Имя / название компании</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field"><label>Email (логин)</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label>Телефон</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="field">
          <label>Пароль</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button className="btn btn-secondary" onClick={() => setForm({ ...form, password: genPassword() })}>Сгенерировать</button>
          </div>
        </div>
        <div className="field">
          <label>Привязать трекеры ({selected.size})</label>
          <div style={{ border: '1px solid var(--color-divider)', maxHeight: 180, overflow: 'auto' }}>
            {sorted.length === 0 && <div className="text-muted" style={{ padding: 10, fontSize: 13 }}>Трекеров пока нет — добавь их в разделе «Трекеры»</div>}
            {sorted.map((d) => (
              <label key={d.id} className="radio" style={{ display: 'flex', padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                <span className="dot" style={{ borderRadius: 2 }} />
                <b>{d.name}</b>
                <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: 11, marginLeft: 8 }}>{d.uniqueId}</span>
                {owned.has(d.id) && <span className="tag tag-neutral" style={{ marginLeft: 'auto' }}>уже привязан</span>}
              </label>
            ))}
          </div>
        </div>
        {error && <div style={{ fontSize: 13, color: '#c0392b' }}>{error}</div>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={create} disabled={busy || !form.name || !form.email || form.password.length < 6}>
            {busy ? 'Создание…' : 'Создать клиента'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialsDialog({ credentials, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = [
    'Доступ в кабинет HiTrack',
    'Сайт: https://clients.hitrack.am',
    `Логин: ${credentials.email}`,
    `Пароль: ${credentials.password}`,
    credentials.devices.length ? `Объекты: ${credentials.devices.join(', ')}` : null,
    'С телефона: открой сайт и добавь на экран «Домой» — будет как приложение.',
  ].filter(Boolean).join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Клиент создан</div>
        <Blueprint style={{ padding: 12, fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{text}</Blueprint>
        <div className="text-muted" style={{ fontSize: 12 }}>Скопируй и отправь клиенту — пароль больше нигде не показывается.</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
          <button className="btn btn-primary" onClick={copy}>{copied ? 'Скопировано ✓' : 'Скопировать'}</button>
        </div>
      </div>
    </div>
  );
}

function UserRow({ user, devices, open, toggle, patchUser }) {
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState(null);

  const toggleDisabled = async () => {
    setBusy(true);
    try { await patchUser(user, { disabled: !user.disabled }); } finally { setBusy(false); }
  };

  const resetPassword = async () => {
    const password = genPassword();
    setBusy(true);
    try {
      await patchUser(user, { password });
      setNewPassword(password);
    } finally { setBusy(false); }
  };

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
            <Blueprint style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy} onClick={toggleDisabled}>
                  {user.disabled ? 'Включить клиента' : 'Отключить клиента'}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy} onClick={resetPassword}>
                  Сменить пароль
                </button>
                {newPassword && (
                  <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    Новый пароль: <b>{newPassword}</b>
                  </span>
                )}
              </div>
            </Blueprint>
          </td>
        </tr>
      )}
    </>
  );
}
