import { useEffect, useState } from 'react';
import { api, deviceState, getJson, relativeTime } from '../api';

const COMMAND_LABELS = {
  positionSingle: 'Запросить позицию',
  rebootDevice: 'Перезагрузить трекер',
  engineStop: 'Заблокировать двигатель',
  engineResume: 'Разблокировать двигатель',
};

export default function Devices({ devices, users, search, reload }) {
  const [positions, setPositions] = useState({});
  const [commandsFor, setCommandsFor] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', uniqueId: '', model: '', userId: '' });
  const [error, setError] = useState(null);

  // владельцы — из нашей карты прав (deviceIds пользователей)
  const owners = {};
  users.forEach((u) => (u.deviceIds ?? []).forEach((id) => {
    owners[id] = owners[id] ? `${owners[id]}, ${u.name}` : u.name;
  }));

  useEffect(() => {
    getJson('/positions')
      .then((list) => setPositions(Object.fromEntries(list.map((p) => [p.deviceId, p]))))
      .catch(() => {});
  }, [devices]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? devices.filter((d) => [d.name, d.uniqueId, owners[d.id]].some((f) => f?.toLowerCase().includes(q)))
    : devices;

  const online = devices.filter((d) => d.status === 'online').length;
  const never = devices.filter((d) => !d.lastUpdate).length;

  const openCommands = async (device) => {
    try {
      const types = await getJson(`/commands/types?deviceId=${device.id}`);
      setCommandsFor({ device, types: types.map((t) => t.type).filter((t) => COMMAND_LABELS[t]) });
    } catch {
      setCommandsFor({ device, types: [] });
    }
  };

  const send = async (type) => {
    const { device } = commandsFor;
    setCommandsFor(null);
    try {
      await api('/commands/send', { method: 'POST', body: JSON.stringify({ deviceId: device.id, type }) });
      alert(`${COMMAND_LABELS[type]}: команда отправлена (${device.name})`);
    } catch (e) {
      alert(`Не удалось отправить: ${e.message}`);
    }
  };

  const create = async () => {
    setError(null);
    try {
      await api('/admin/devices', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          uniqueId: form.uniqueId,
          model: form.model || undefined,
          userId: form.userId ? Number(form.userId) : undefined,
        }),
      });
      setAdding(false);
      setForm({ name: '', uniqueId: '', model: '', userId: '' });
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Добавить трекер</button>
        <span className="tag tag-accent">На связи: {online}</span>
        <span className="tag tag-neutral">Офлайн: {devices.length - online - never}</span>
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
                {users.filter((u) => u.role?.name === 'client').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
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
