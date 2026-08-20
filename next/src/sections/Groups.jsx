import { useEffect, useState } from 'react';
import { api, getJson } from '../api';
import { Blueprint } from '../ui';

/** Группы: пачка трекеров + пачка пользователей; каждый участник видит все устройства группы. */
export default function Groups({ devices, users, search }) {
  const [groups, setGroups] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | группа

  const load = () => getJson('/groups').then(setGroups).catch(() => setGroups([]));
  useEffect(() => { load(); }, []);

  const deviceById = Object.fromEntries(devices.map((d) => [d.id, d]));
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  const q = search.trim().toLowerCase();
  const filtered = (groups ?? []).filter((g) => !q || g.name.toLowerCase().includes(q));

  const remove = async (group) => {
    if (!window.confirm(`Удалить группу «${group.name}»? Пользователи группы потеряют доступ к её устройствам.`)) return;
    await api(`/groups/${group.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Новая группа</button>
      </div>
      {groups === null && <div className="text-muted" style={{ fontSize: 13 }}>Загрузка…</div>}
      {groups?.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13 }}>
          Групп пока нет. Группа — это набор трекеров и пользователей: каждый участник видит все устройства группы,
          не нужно привязывать их поштучно.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14, alignContent: 'start' }}>
        {filtered.map((g) => (
          <Blueprint key={g.id} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ fontSize: 16, fontFamily: 'var(--font-heading)' }}>{g.name}</b>
              <span className="tag tag-accent" style={{ marginLeft: 'auto' }}>{g.deviceIds.length} трекеров</span>
              <span className="tag tag-accent-2">{g.userIds.length} польз.</span>
            </div>
            {g.description && <div className="text-muted" style={{ fontSize: 12 }}>{g.description}</div>}
            <div style={{ fontSize: 12 }} className="text-muted">
              {g.deviceIds.map((id) => deviceById[id]?.name ?? `#${id}`).join(', ') || 'без трекеров'}
            </div>
            <div style={{ fontSize: 12 }} className="text-muted">
              Доступ: {g.userIds.map((id) => userById[id]?.name ?? `#${id}`).join(', ') || 'никому'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setEditing(g)}>Изменить</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => remove(g)}>Удалить</button>
            </div>
          </Blueprint>
        ))}
      </div>
      {editing && (
        <GroupDialog
          group={editing === 'new' ? null : editing}
          devices={devices}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function GroupDialog({ group, devices, users, onClose, onSaved }) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [deviceIds, setDeviceIds] = useState(new Set(group?.deviceIds ?? []));
  const [userIds, setUserIds] = useState(new Set(group?.userIds ?? []));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const members = users.filter((u) => !u.role?.permissions?.includes('*'));

  const toggle = (set, setter, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = JSON.stringify({ name, description, deviceIds: [...deviceIds], userIds: [...userIds] });
      if (group) await api(`/groups/${group.id}`, { method: 'PATCH', body });
      else await api('/groups', { method: 'POST', body });
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto' }}>
        <div className="dialog-title">{group ? `Группа «${group.name}»` : 'Новая группа'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field"><label>Название</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="field"><label>Описание</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Трекеры группы ({deviceIds.size})</label>
          <div style={{ border: '1px solid var(--color-divider)', maxHeight: 160, overflow: 'auto' }}>
            {devices.map((d) => (
              <label key={d.id} className="radio" style={{ display: 'flex', padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
                <input type="checkbox" checked={deviceIds.has(d.id)} onChange={() => toggle(deviceIds, setDeviceIds, d.id)} />
                <span className="dot" style={{ borderRadius: 2 }} />
                <b>{d.name}</b>
                <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: 11, marginLeft: 8 }}>{d.uniqueId}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Кто видит группу ({userIds.size})</label>
          <div style={{ border: '1px solid var(--color-divider)', maxHeight: 160, overflow: 'auto' }}>
            {members.length === 0 && <div className="text-muted" style={{ padding: 10, fontSize: 13 }}>Пользователей пока нет</div>}
            {members.map((u) => (
              <label key={u.id} className="radio" style={{ display: 'flex', padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
                <input type="checkbox" checked={userIds.has(u.id)} onChange={() => toggle(userIds, setUserIds, u.id)} />
                <span className="dot" style={{ borderRadius: 2 }} />
                <b>{u.name}</b>
                <span className="text-muted" style={{ fontSize: 11, marginLeft: 8 }}>{u.email}</span>
                {u.role?.name && <span className="tag tag-neutral" style={{ marginLeft: 'auto' }}>{u.role.name}</span>}
              </label>
            ))}
          </div>
        </div>
        {error && <div style={{ fontSize: 13, color: '#c0392b' }}>{error}</div>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Сохранение…' : group ? 'Сохранить' : 'Создать группу'}
          </button>
        </div>
      </div>
    </div>
  );
}
