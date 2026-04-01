import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtDate } from '../components/ui/helpers.jsx';

export default function TransactionsPage({ onAdd }) {
  const { household } = useAuth();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '' });
  const [deleting, setDeleting] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const load = () => {
    setLoading(true);
    const params = { limit: 100 };
    if (filter.type) params.type = filter.type;
    api.getTransactions(params).then(setTxs).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter, household]);

  const del = async (id) => {
    setDeleting(id);
    try {
      await api.deleteTransaction(id);
      setTxs(t => t.filter(x => x.id !== id));
    } catch (e) {
      alert('Error eliminando: ' + e.message);
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  const grouped = txs.reduce((acc, t) => {
    const d = t.date.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(t);
    return acc;
  }, {});

  const TYPE_LABELS = {
    '': 'Todos', income: '↑ Ingresos', expense: '↓ Gastos',
    transfer: '⇄ Transferencias', debt_payment: '💳 Deudas',
  };

  return (
    <div className="stack">
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Movimientos</div>
          <div className="page-subtitle">{txs.length} registros</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Nuevo</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {Object.entries(TYPE_LABELS).map(([t, label]) => (
          <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
            className="btn btn-sm"
            style={{
              whiteSpace: 'nowrap', flexShrink: 0,
              background: filter.type === t ? 'var(--accent)' : 'var(--bg3)',
              color: filter.type === t ? '#fff' : 'var(--text2)',
              border: 'none'
            }}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="stack">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}
        </div>
      )}

      {!loading && txs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text2)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
          No hay movimientos
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Agregar primero</button>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div style={{
            fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 700,
            padding: '4px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
            display: 'flex', justifyContent: 'space-between'
          }}>
            <span>{fmtDate(date)}</span>
            <span style={{ fontWeight: 400 }}>{items.length} mov.</span>
          </div>
          <div className="card" style={{ padding: 6 }}>
            {items.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '0 6px' }} />}
                <div className="tx-item">
                  <div className="tx-icon" style={{ background: `${t.category_color || '#6366f1'}22`, flexShrink: 0 }}>
                    {t.category_icon || (t.type === 'income' ? '↑' : t.type === 'transfer' ? '⇄' : '↓')}
                  </div>
                  <div className="tx-info">
                    <div className="tx-desc">{t.description || t.category_name || t.type}</div>
                    <div className="tx-meta">
                      {t.account_name}
                      {t.category_name && ` · ${t.category_name}`}
                      {' · '}{fmtDate(t.date)}
                      {t.created_by_name && household && ` · ${t.created_by_name}`}
                    </div>
                  </div>

                  <div className={`tx-amount ${t.type === 'income' ? 'amount-income' : t.type === 'transfer' ? 'amount-neutral' : 'amount-expense'}`}>
                    {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}{fmt(t.amount)}
                  </div>

                  {/* Botón eliminar con confirmación inline */}
                  {confirmId === t.id ? (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => del(t.id)} disabled={deleting === t.id}
                        style={{ background: 'var(--red-dim)', color: 'var(--red)', border: 'none',
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                          fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font)' }}>
                        {deleting === t.id ? '...' : 'Sí'}
                      </button>
                      <button onClick={() => setConfirmId(null)}
                        style={{ background: 'var(--bg3)', color: 'var(--text2)', border: 'none',
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                          fontSize: '0.75rem', fontFamily: 'var(--font)' }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(t.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)',
                        cursor: 'pointer', fontSize: '1rem', padding: '4px 6px',
                        borderRadius: 6, flexShrink: 0 }}
                      title="Eliminar">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}