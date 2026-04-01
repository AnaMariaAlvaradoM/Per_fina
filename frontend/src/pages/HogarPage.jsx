import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtDate } from '../components/ui/helpers.jsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366f1','#f43f5e','#f59e0b','#10b981','#3b82f6','#8b5cf6','#06b6d4','#ec4899'];
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function HogarPage({ onAdd }) {
  const { household } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [sharedAccounts, setSharedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!household?.id) { setLoading(false); return; }
    const now = new Date();
    Promise.all([
      api.getSummary({ household_id: household.id, year: now.getFullYear(), month: now.getMonth() + 1 }),
      api.getSharedTransactions(household.id),
      api.getAccounts(household.id),
    ]).then(([s, txShared, accs]) => {
      setSummary(s);
      setTransactions(txShared); // ya vienen solo las compartidas
      setSharedAccounts(accs.shared || []);
    }).finally(() => setLoading(false));
  }, [household]);

  const del = async (id) => {
    setDeleting(id);
    try {
      await api.deleteTransaction(id);
      setTransactions(t => t.filter(x => x.id !== id));
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  // Sin hogar — mostrar pantalla de unirse
  if (!household?.id) return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text2)' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏠</div>
      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8, color: 'var(--text)' }}>
        Sin hogar compartido
      </div>
      <div style={{ fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.6 }}>
        Para compartir gastos con tu pareja, una de las dos debe compartir su código de invitación
        y la otra unirse desde la pantalla de Cuentas.
      </div>
      <button className="btn btn-primary" onClick={() => navigate('/accounts')}>
        Ir a Cuentas → Unirme a un hogar
      </button>
    </div>
  );

  if (loading) return (
    <div className="stack">
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
    </div>
  );

  const now = new Date();
  const income = Number(summary?.totals?.income || 0);
  const expenses = Number(summary?.totals?.expenses || 0);
  const expCats = (summary?.byCategory || []).filter(c => c.type === 'expense');

  // Agrupar por fecha
  const grouped = transactions.reduce((acc, t) => {
    const d = t.date.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(t);
    return acc;
  }, {});

  return (
    <div className="stack">
      {/* Header */}
      <div className="flex-between page-header">
        <div>
          <div className="page-title">🏠 Hogar</div>
          <div className="page-subtitle">Gastos compartidos</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Agregar</button>
      </div>

      {/* Código de invitación — siempre visible */}
      <div className="card" style={{ border: '1px dashed var(--green)', background: 'var(--green-dim)' }}>
        <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 6 }}>
          CÓDIGO DE INVITACIÓN
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '1.6rem', fontWeight: 800,
          color: '#fff', letterSpacing: '0.25em' }}>
          {household.invite_code}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: 6 }}>
          Tu pareja se registra, va a Cuentas → "Unirme a un hogar" e ingresa este código
        </div>
      </div>

      {/* Resumen del mes */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #0f2a1e, #0a1f18)',
        border: '1px solid #1a4a30'
      }}>
        <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>
          GASTOS COMPARTIDOS — {MONTHS[now.getMonth()].toUpperCase()} {now.getFullYear()}
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Ingresos</div>
            <div className="amount amount-income" style={{ fontSize: '1rem' }}>+{fmt(income)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Gastos</div>
            <div className="amount amount-expense" style={{ fontSize: '1rem' }}>-{fmt(expenses)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Sobrante</div>
            <div className={`amount ${income - expenses >= 0 ? 'amount-income' : 'amount-expense'}`} style={{ fontSize: '1rem' }}>
              {fmt(income - expenses)}
            </div>
          </div>
        </div>
      </div>

      {/* Cuentas compartidas */}
      {sharedAccounts.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Cuentas del hogar</h3>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {sharedAccounts.map(a => (
              <div key={a.id} className="account-card"
                style={{ minWidth: 150, color: a.color || '#10b981',
                  background: `linear-gradient(135deg, ${a.color || '#10b981'}22, var(--bg3))`,
                  borderColor: `${a.color || '#10b981'}44` }}>
                <div style={{ fontSize: '1.3rem' }}>{a.icon}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{a.name}</div>
                <div className={`amount ${parseFloat(a.balance) >= 0 ? 'amount-income' : 'amount-expense'}`}
                  style={{ fontSize: '0.95rem' }}>
                  {fmt(a.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfica por categoría */}
      {expCats.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Gastos por categoría</h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={expCats} cx="50%" cy="50%" innerRadius={32} outerRadius={55}
                  dataKey="total" paddingAngle={2}>
                  {expCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: '0.8rem'
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {expCats.slice(0, 5).map((c, i) => (
                <div key={i} className="flex-between" style={{ fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%',
                      background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span>{c.icon} {c.name}</span>
                  </div>
                  <span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
                    {fmt(c.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Movimientos compartidos */}
      <div>
        <h3 style={{ marginBottom: 10 }}>
          Movimientos compartidos
          <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>
            ({transactions.length})
          </span>
        </h3>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text2)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
              Aún no hay gastos compartidos
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: 16 }}>
              Al registrar un movimiento, marca la casilla<br/>"Gasto compartido del hogar"
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAdd}>
              + Primer gasto compartido
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 700,
                padding: '4px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'flex', justifyContent: 'space-between' }}>
                <span>{fmtDate(date)}</span>
                <span style={{ fontWeight: 400 }}>{items.length} mov.</span>
              </div>
              <div className="card" style={{ padding: 6 }}>
                {items.map((t, i) => (
                  <div key={t.id}>
                    {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '0 6px' }} />}
                    <div className="tx-item">
                      <div className="tx-icon"
                        style={{ background: `${t.category_color || '#10b981'}22`, flexShrink: 0 }}>
                        {t.category_icon || (t.type === 'income' ? '↑' : '↓')}
                      </div>
                      <div className="tx-info">
                        <div className="tx-desc">{t.description || t.category_name || t.type}</div>
                        <div className="tx-meta">
                          {t.account_name}
                          {t.category_name && ` · ${t.category_name}`}
                          {t.created_by_name && (
                            <span style={{ color: 'var(--accent)' }}> · {t.created_by_name}</span>
                          )}
                        </div>
                      </div>
                      <div className={`tx-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                        {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                      </div>
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
                            borderRadius: 6, flexShrink: 0 }}>
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
