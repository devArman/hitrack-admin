import { useEffect, useState } from 'react';
import { api, deviceState, getJson, relativeTime } from '../api';

const COMMAND_LABELS = {
  positionSingle: 'Запросить позицию',
  rebootDevice: 'Перезагрузить трекер',
  engineStop: 'Заблокировать двигатель',
  engineResume: 'Разблокировать двигатель',
};

export default function Devices({ devices, users, search }) {
  const [owners, setOwners] = useState({}); // deviceId -> имена клиентов
  const [positions, setPositions] = useState({});
  const [commandsFor, setCommandsFor] = useState(null); // { device, types }
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', uniqueId: '', model: '', userId: '' });
  const [error, setError] = useState(null);
  const [added, setAdded] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all(users.filter((u) => !u.administrator).map(async (u) => {
      const [direct, groups] = await Promise.all([
        getJson(`/devices?userId=${u.id}`).catch(() => []),
        getJson(`/groups?userId=${u.id}`).catch(() => []),
      ]);
      return [u, direct, new Set(groups.map((g) => g.id))];
    })).then((entries) => {
      if (!alive) return;
      const map = {};
      entries.forEach(([u, direct, groupIds]) => {
        const ids = new Set(direct.map((d) => d.id));
        devices.forEach((d) => { if (groupIds.has(d.groupId)) ids.add(d.id); });
        ids.forEach((id) => { map[id] = map[id] ? `${map[id]}, ${u.name}` : u.name; });
      });
      setOwners(map);
    });
    getJson('/positions').then((list) => {
      if (alive) setPositions(Object.fromEntries(list.map((p) => [p.deviceId, p])));
    }).catch(() => {});
    return () => { alive = false; };
  }, [users, devices]);

  const all = [...devices, ...added.filter((a) => !devices.some((d) => d.id === a.id))];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter((d) => [d.name, d.uniqueId, owners[d.id]].some((f) => f?.toLowerCase().includes(q)))
    : all;

  const online = all.filter((d) => d.status === 'online').length;
  const never = all.filter((d) => !d.lastUpdate).length;

  const openCommands = async (device) => {
    try {
      const types = await getJson(`/commands/types?deviceId=${device.id}&textChannel=false`);
      setCommandsFor({ device, types: types.map((t) => t.type).filter((t) => COMMAND_LABELS[t]) });
    } catch {
      setCommandsFor({ device, types: [] });
    }
  };

  const send = async (type) => {
    const { device } = commandsFor;
    setCommandsFor(null);
    try {
      await api('/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, type, attributes: {} }),
      });
      alert(`${COMMAND_LABELS[type]}: команда отправлена (${device.name})`);
    } catch (e) {
      alert(`Не удалось отправить: ${e.message}`);
    }
  };

  const create = async () => {
    setError(null);
    try {
      const response = await api('/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, uniqueId: form.uniqueId, model: form.model || null }),
      });
      const device = await response.json();
      if (form.userId) {
        await api('/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: Number(form.userId), deviceId: device.id }),
        });
      }
      setAdded([...added, device]);
      setAdding(false);
      setForm({ name: '', uniqueId: '', model: '', userId: '' });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Добавить трекер</button>
        <span className="tag tag-accent">На связи: {online}</span>
        <span className="tag tag-neutral">Офлайн: {all.length - online - never}</span>
        <span className="tag tag-outline">Не подключались: {never}</span>
      </div>
      <table className="table">
        <thead>
          <tr><th>IMEI</th><th>Модель</th><th>Клиент / объект</th><th>Прошивка</th><th>Посл. пакет</th><th>Статус</th><th /></tr>
        </thead>
        <tbody>
          {filtered.map((d) => {
            const state = deviceState(d);
            const fw = positions[d.id]?.attributes?.versionFw;
            return (
              <tr key={d.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.uniqueId}</td>
                <td>{d.model || '—'}</td>
                <td><b>{owners[d.id] ?? '—'}</b><div className="text-muted" style={{ fontSize: 12 }}>{d.name}</div></td>
                <td>{fw ?? '—'}</td>
                <td className="text-muted">{relativeTime(d.lastUpdate)}</td>
                <td><span className={state.tagClass}>{state.label}</span></td>
                <td><button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => openCommands(d)}>Команды</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {commandsFor && (
        <div className="dialog-backdrop" onClick={() => setCommandsFor(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">{commandsFor.device.name}</div>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {commandsFor.types.length === 0 && <span className="text-muted">Трекер не поддерживает команды (или офлайн)</span>}
              {commandsFor.types.map((type) => (
                <button key={type} className="btn btn-secondary" onClick={() => send(type)}>{COMMAND_LABELS[type]}</button>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setCommandsFor(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="dialog-backdrop" onClick={() => setAdding(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Новый трекер</div>
            <div className="field"><label>Название объекта</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>IMEI</label><input className="input" value={form.uniqueId} onChange={(e) => setForm({ ...form, uniqueId: e.target.value })} /></div>
            <div className="field"><label>Модель</label><input className="input" placeholder="Teltonika FMB120" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            <div className="field">
              <label>Клиент</label>
              <select className="input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                <option value="">— не привязывать —</option>
                {users.filter((u) => !u.administrator).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {error && <div style={{ fontSize: 13, color: '#c0392b' }}>{error}</div>}
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setAdding(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={create} disabled={!form.name || !form.uniqueId}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
