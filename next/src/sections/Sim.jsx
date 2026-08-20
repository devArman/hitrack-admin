export default function Sim() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" disabled>+ Партия SIM</button>
      </div>
      <table className="table">
        <thead><tr><th>ICCID</th><th>Номер</th><th>Оператор</th><th>Трафик / мес</th><th>Привязка</th><th>Статус</th></tr></thead>
        <tbody>
          <tr>
            <td colSpan={6} className="text-muted" style={{ padding: 24, textAlign: 'center' }}>
              Учёт SIM-карт появится с hitrac-api (таблица ht_sims): ICCID, оператор, трафик, привязка к трекеру
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
