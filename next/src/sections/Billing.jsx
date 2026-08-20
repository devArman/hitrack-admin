import { fmt } from '../api';
import { Blueprint } from '../ui';

export default function Billing({ devices, users }) {
  const estimated = devices.length * 3000;
  const kpi = [
    { k: 'Расчётный MRR', v: `${fmt(estimated)} ֏` },
    { k: 'Трекеров на тарифе', v: fmt(devices.length) },
    { k: 'Клиентов', v: fmt(users.filter((u) => !u.administrator).length) },
  ];

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, maxWidth: 760 }}>
        {kpi.map((c) => (
          <Blueprint key={c.k} style={{ padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>{c.k}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{c.v}</div>
          </Blueprint>
        ))}
      </div>
      <table className="table">
        <thead><tr><th>Счёт</th><th>Клиент</th><th>Период</th><th>Сумма</th><th>Статус</th><th /></tr></thead>
        <tbody>
          <tr>
            <td colSpan={6} className="text-muted" style={{ padding: 24, textAlign: 'center' }}>
              Выставление счетов появится с модулем биллинга в hitrac-api — сейчас показан только расчёт по тарифу 3 000 ֏ / трекер
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
