import { useState } from 'react';
import { api } from '../api';
import { Blueprint } from '../ui';

const genPassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => abc[b % abc.length]).join('');
};

/** Клиенты живут в НАШЕЙ базе (ht_users, роль client); трекеры — привязки ht_user_devices. */
export default function Clients({ users, devices, search, reload }) {
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [open, setOpen] = useState(null);

  const deviceById = Object.fromEntries(devices.map((d) => [d.id, d]));
  const clients = users.filter((u) => u.role?.name === 'client');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter((u) => [u.name, u.email, u.phone].some((f) => f?.toLowerCase().includes(q)))
    : clients;

  const exportCsv = () => {
    const rows = [['Клиент', 'Email', 'Телефон', 'Объектов', 'Статус']];
    filtered.forEach((u) => rows.push([u.name, u.email, u.phone ?? '', u.deviceIds.length, u.disabled ? 'Отключён' : 'Активен']));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' }));
    a.download = 'clients.csv';
    a.click();
  };

  const patchUser = async (user, patch) => {
    await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    reload();
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
              devices={u.deviceIds.map((id) => deviceById[id]).filter(Boolean)}
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
          users={users}
          onClose={() => setCreating(false)}
          onCreated={(credentials) => { setCreating(false); setCreated(credentials); reload(); }}
        />
      )}
      {created && <CredentialsDialog credentials={created} onClose={() => setCreated(null)} />}
    </div>
  );
}

function CreateDialog({ devices, users, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: genPassword() });
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const owned = new Set(users.flatMap((u) => u.deviceIds ?? []));
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
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email.trim(),
          phone: form.phone,
          password: form.password,
          roleName: 'client',
          deviceIds: [...selected],
        }),
      });
      onCreated({ ...form, devices: sorted.filter((d) => selected.has(d.id)).map((d) => d.name) });
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

  const run = async (patch, after) => {
    setBusy(true);
    try { await patchUser(user, patch); after?.(); } finally { setBusy(false); }
  };

  return (
    <>
      <tr>
        <td><b>{user.name}</b><div className="text-muted" style={{ fontSize: 12 }}>{user.email}</div></td>
        <td>{user.phone || '—'}</td>
        <td>{user.deviceIds.length}</td>
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
              {devices.length === 0 && <span className="text-muted">Устройств нет</span>}
              {devices.map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: 10 }}>
                  <b>{d.name}</b>
                  <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.uniqueId}</span>
                  <span className={d.status === 'online' ? 'tag tag-accent' : 'tag tag-neutral'} style={{ marginLeft: 'auto' }}>
                    {d.status === 'online' ? 'На связи' : 'Офлайн'}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy} onClick={() => run({ disabled: !user.disabled })}>
                  {user.disabled ? 'Включить клиента' : 'Отключить клиента'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12 }}
                  disabled={busy}
                  onClick={() => { const p = genPassword(); run({ password: p }, () => setNewPassword(p)); }}
                >
                  Сменить пароль
                </button>
                {newPassword && (
                  <span style={{ fontFamily: 'monospace', fontSize: 13 }}>Новый пароль: <b>{newPassword}</b></span>
                )}
              </div>
            </Blueprint>
          </td>
        </tr>
      )}
    </>
  );
}
