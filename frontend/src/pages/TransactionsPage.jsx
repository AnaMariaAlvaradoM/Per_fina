import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtDate } from '../components/ui/helpers';

export default function TransactionsPage({ onAdd }) {
  const { household } = useAuth();
  const [txs, setTxs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', category_id: '' });
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    const params = { household_id: household?.id, limit: 100 };
    if (filter.type) params.type = filter.type;
    if (filter.category_id) params.category_id = filter.category_id;
    api.getTransactions(params).then(setTxs).finally(() => setLoading(false));
  };

  useEffect(() => { api.getCategories().then(setCategories); }, []);
  useEffect(() => { load(); }, [filter, household]);

  const del = async (id) => {
    if (!confirm('¿Eliminar esta transacción? El saldo se revertirá.')) return;
    setDeleting(id);
    await api.deleteTransaction(id);
    setTxs(t => t.filter(x => x.id !== id));
    setDeleting(null);
  };

  // Agrupar por fecha
  const grouped = txs.reduce((acc, t) => {
    const d = t.date.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(t);
    return acc;
  }, {});

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
        {['', 'income', 'expense', 'transfer', 'debt_payment'].map(t => (
          <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
            className="btn btn-sm"
            style={{
              whiteSpace: 'nowrap', flexShrink: 0,
              background: filter.type === t ? 'var(--accent)' : 'var(--bg3)',
              color: filter.type === t ? '#fff' : 'var(--text2)',
              border: 'none'
            }}>
            {t === '' ? 'Todos' : t === 'income' ? '↑ Ingresos' : t === 'expense' ? '↓ Gastos' : t === 'transfer' ? '⇄ Transferencias' : '💳 Deudas'}
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
          No hay movimientos con ese filtro
        </div>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600,
            padding: '4px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {fmtDate(date)}
          </div>
          <div className="card" style={{ padding: 6 }}>
            {items.map((t, i) => (
              <div key={t.id}>
                {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '0 6px' }} />}
                <div className="tx-item" style={{ position: 'relative' }}>
                  <div className="tx-icon" style={{ background: `${t.category_color || '#6366f1'}22` }}>
                    {t.category_icon || (t.type === 'income' ? '↑' : t.type === 'transfer' ? '⇄' : '↓')}
                  </div>
                  <div className="tx-info">
                    <div className="tx-desc">{t.description || t.category_name || t.type}</div>
                    <div className="tx-meta">
                      {t.account_name}
                      {t.category_name && ` · ${t.category_name}`}
                      {t.created_by_name && household && ` · ${t.created_by_name}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className={`tx-amount ${t.type === 'income' ? 'amount-income' : t.type === 'transfer' ? 'amount-neutral' : 'amount-expense'}`}>
                      {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}{fmt(t.amount)}
                    </div>
                    <button onClick={() => del(t.id)} disabled={deleting === t.id}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)',
                        cursor: 'pointer', fontSize: '0.8rem', padding: 4, opacity: 0.6 }}>
                      {deleting === t.id ? '...' : '✕'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
