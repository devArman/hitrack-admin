import { useEffect, useState } from 'react';
import { api, formatTime, getJson } from '../api';
import { Blueprint } from '../ui';

/** Объявления: всем клиентам, группе или конкретным клиентам; со счётчиком прочтений. */
export default function Announcements({ users, search }) {
  const [list, setList] = useState(null);
  const [groups, setGroups] = useState([]);
  const [creating, setCreating] = useState(false);

  const load = () => {
    Promise.all([getJson('/admin/announcements'), getJson('/groups')])
      .then(([announcements, groupList]) => { setList(announcements); setGroups(groupList); })
      .catch(() => setList([]));
  };
  useEffect(load, []);

  const q = search.trim().toLowerCase();
  const filtered = (list ?? []).filter((a) => !q || a.subject.toLowerCase().includes(q) || a.body.toLowerCase().includes(q));

  const audienceLabel = (a) => {
    if (a.toAll) return 'Все клиенты';
    const parts = [];
    if (a.groupNames.length) parts.push(`группы: ${a.groupNames.join(', ')}`);
    if (a.userIds.length) {
      const names = a.userIds.map((id) => users.find((u) => u.id === id)?.name ?? `#${id}`);
      parts.push(names.join(', '));
    }
    return parts.join(' · ') || '—';
  };

  const remove = async (a) => {
    if (!window.confirm(`Удалить объявление «${a.subject}»? Оно исчезнет и у клиентов.`)) return;
    await api(`/admin/announcements/${a.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Новое объявление</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Дата</th><th>Тема</th><th>Текст</th><th>Кому</th><th>Прочитали</th><th /></tr>
        </thead>
        <tbody>
          {list === null && <tr><td colSpan={6} className="text-muted">Загрузка…</td></tr>}
          {list?.length === 0 && (
            <tr><td colSpan={6} className="text-muted" style={{ padding: 20, textAlign: 'center' }}>
              Объявлений пока нет — например, напоминание об оплате для группы или клиента
            </td></tr>
          )}
          {filtered.map((a) => (
            <tr key={a.id}>
              <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatTime(a.createdAt)}</td>
              <td><b>{a.subject}</b></td>
              <td style={{ maxWidth: 320 }}>{a.body}</td>
              <td>
                <span className={a.toAll ? 'tag tag-accent' : 'tag tag-accent-2'}>{audienceLabel(a)}</span>
              </td>
              <td>{a.readCount} из {a.audienceCount}</td>
              <td><button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => remove(a)}>Удалить</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {creating && (
        <CreateDialog
          groups={groups}
          clients={users.filter((u) => u.role?.name === 'client')}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function CreateDialog({ groups, clients, onClose, onCreated }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toAll, setToAll] = useState(true);
  const [groupIds, setGroupIds] = useState(new Set());
  const [userIds, setUserIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = (set, setter, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      await api('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          body,
          toAll,
          groupIds: toAll ? [] : [...groupIds],
          userIds: toAll ? [] : [...userIds],
        }),
      });
      onCreated();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const targeted = toAll || groupIds.size > 0 || userIds.size > 0;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto' }}>
        <div className="dialog-title">Новое объявление</div>
        <div className="field"><label>Тема</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus placeholder="Например: Напоминание об оплате" /></div>
        <div className="field"><label>Текст</label><textarea className="input" style={{ minHeight: 90, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <label className="radio">
          <input type="checkbox" checked={toAll} onChange={() => setToAll(!toAll)} />
          <span className="dot" />
          Отправить всем клиентам
        </label>
        {!toAll && (
          <>
            <div className="field">
              <label>Группы ({groupIds.size})</label>
              <div style={{ border: '1px solid var(--color-divider)', maxHeight: 130, overflow: 'auto' }}>
                {groups.length === 0 && <div className="text-muted" style={{ padding: 10, fontSize: 13 }}>Групп нет</div>}
                {groups.map((g) => (
                  <label key={g.id} className="radio" style={{ display: 'flex', padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
                    <input type="checkbox" checked={groupIds.has(g.id)} onChange={() => toggle(groupIds, setGroupIds, g.id)} />
                    <span className="dot" style={{ borderRadius: 2 }} />
                    <b>{g.name}</b>
                    <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 11 }}>{g.userIds.length} польз.</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Клиенты ({userIds.size})</label>
              <div style={{ border: '1px solid var(--color-divider)', maxHeight: 130, overflow: 'auto' }}>
                {clients.map((u) => (
                  <label key={u.id} className="radio" style={{ display: 'flex', padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
                    <input type="checkbox" checked={userIds.has(u.id)} onChange={() => toggle(userIds, setUserIds, u.id)} />
                    <span className="dot" style={{ borderRadius: 2 }} />
                    <b>{u.name}</b>
                    <span className="text-muted" style={{ marginLeft: 8, fontSize: 11 }}>{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        {error && <div style={{ fontSize: 13, color: '#c0392b' }}>{error}</div>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={create} disabled={busy || !subject.trim() || !body.trim() || !targeted}>
            {busy ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}
