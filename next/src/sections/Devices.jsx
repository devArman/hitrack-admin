import { useEffect, useState } from 'react';
import { api, deviceState, getJson, relativeTime } from '../api';

export const CATEGORIES = [
  ['bicycle', '🚲 Велосипед'],
  ['moped', '🛵 Мопед'],
  ['car', '🚗 Машина'],
  ['truck', '🚚 Грузовая машина'],
  ['boat', '🛥️ Лодка'],
];
const CATEGORY_EMOJI = Object.fromEntries(CATEGORIES.map(([k, v]) => [k, v.split(' ')[0]]));

const COMMAND_LABELS = {
  positionSingle: 'Запросить позицию',
  rebootDevice: 'Перезагрузить трекер',
  engineStop: 'Заблокировать двигатель',
  engineResume: 'Разблокировать двигатель',
};

export default function Devices({ devices, users, search, reload }) {
  const [positions, setPositions] = useState({});
  const [calibrations, setCalibrations] = useState({}); // deviceId -> {sensorKey, points}
  const [commandsFor, setCommandsFor] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // { device, name, model }
  const [form, setForm] = useState({ name: '', uniqueId: '', model: '', category: 'car', userId: '' });
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
    getJson('/admin/fuel-calibrations')
      .then((list) => setCalibrations(Object.fromEntries(list.map((c) => [c.deviceId, c]))))
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
          category: form.category || undefined,
          userId: form.userId ? Number(form.userId) : undefined,
        }),
      });
      setAdding(false);
      setForm({ name: '', uniqueId: '', model: '', category: 'car', userId: '' });
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
          <tr><th>Название</th><th>IMEI</th><th>Модель</th><th>Клиент</th><th>Прошивка</th><th>Посл. пакет</th><th>Статус</th><th /></tr>
        </thead>
        <tbody>
          {filtered.map((d) => {
            const state = deviceState(d);
            const fw = positions[d.id]?.attributes?.versionFw;
            return (
              <tr key={d.id}>
                <td><b>{CATEGORY_EMOJI[d.category] ? `${CATEGORY_EMOJI[d.category]} ` : ''}{d.name}</b></td>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.uniqueId}</td>
                <td>
                  {d.model || (positions[d.id]?.protocol
                    ? <span className="text-muted">{positions[d.id].protocol} (протокол)</span>
                    : '—')}
                </td>
                <td>{owners[d.id] ?? '—'}</td>
                <td>{fw ?? '—'}</td>
                <td className="text-muted">{relativeTime(d.lastUpdate)}</td>
                <td><span className={state.tagClass}>{state.label}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => openCommands(d)}>Команды</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing({
                    device: d,
                    name: d.name,
                    model: d.model ?? '',
                    category: d.category ?? 'car',
                    sensorKey: calibrations[d.id]?.sensorKey ?? 'io270',
                    points: (calibrations[d.id]?.points ?? []).map((p) => ({ raw: String(p.raw), liters: String(p.liters) })),
                  })}>Изменить</button>
                </td>
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

      {editing && (
        <div className="dialog-backdrop" onClick={() => setEditing(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">{editing.device.name}</div>
            <div className="field"><label>Название объекта</label><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label>Модель трекера</label><input className="input" placeholder="Teltonika FMC920" value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} /></div>
            <div className="field">
              <label>Тип объекта</label>
              <select className="input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>
                Тарировка ДУТ — датчик{' '}
                <span style={{ fontFamily: 'monospace' }}>{editing.sensorKey}</span>
                {positions[editing.device.id]?.attributes?.[editing.sensorKey] !== undefined && (
                  <> · сейчас: <b>{positions[editing.device.id].attributes[editing.sensorKey]}</b></>
                )}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {editing.points.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input" style={{ width: 120 }} placeholder="сырое" value={p.raw}
                      onChange={(e) => setEditing({ ...editing, points: editing.points.map((x, j) => (j === i ? { ...x, raw: e.target.value } : x)) })} />
                    <span className="text-muted">→</span>
                    <input className="input" style={{ width: 100 }} placeholder="литры" value={p.liters}
                      onChange={(e) => setEditing({ ...editing, points: editing.points.map((x, j) => (j === i ? { ...x, liters: e.target.value } : x)) })} />
                    <span className="text-muted" style={{ fontSize: 12 }}>л</span>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => setEditing({ ...editing, points: editing.points.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
                <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }}
                  onClick={() => setEditing({ ...editing, points: [...editing.points, { raw: '', liters: '' }] })}>
                  + Точка тарировки
                </button>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  Минимум 2 точки (например, каждые 20 л). Пустой список — тарировка выключена.
                </div>
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Отмена</button>
              <button
                className="btn btn-primary"
                disabled={!editing.name.trim()}
                onClick={async () => {
                  try {
                    await api(`/admin/devices/${editing.device.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ name: editing.name, model: editing.model, category: editing.category }),
                    });
                    await api(`/admin/fuel-calibrations/${editing.device.id}`, {
                      method: 'POST',
                      body: JSON.stringify({
                        sensorKey: editing.sensorKey,
                        points: editing.points
                          .filter((p) => String(p.raw).trim() !== '' && String(p.liters).trim() !== '')
                          .map((p) => ({ raw: Number(p.raw), liters: Number(p.liters) }))
                          .filter((p) => Number.isFinite(p.raw) && Number.isFinite(p.liters)),
                      }),
                    });
                    setEditing(null);
                    reload();
                  } catch (e) {
                    alert(`Не удалось сохранить: ${e.message}`);
                  }
                }}
              >
                Сохранить
              </button>
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
            <div className="field"><label>Модель</label><input className="input" placeholder="Teltonika FMC920" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            <div className="field">
              <label>Тип объекта</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
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
