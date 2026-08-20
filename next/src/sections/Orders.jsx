const COLUMNS = ['Новые', 'В работе', 'Завершено за неделю'];

export default function Orders() {
  return (
    <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignContent: 'start' }}>
      {COLUMNS.map((title) => (
        <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <h6 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
            {title}
            <span className="tag tag-neutral">0</span>
          </h6>
          <div className="blueprint" style={{ padding: 12, fontSize: 13 }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <span className="text-muted">Заявки на установку появятся с hitrac-api (таблица ht_orders): клиент, адрес, монтажник, статус</span>
          </div>
        </div>
      ))}
    </div>
  );
}
