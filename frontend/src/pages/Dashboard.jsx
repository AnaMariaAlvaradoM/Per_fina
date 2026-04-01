import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtRelative } from '../components/ui/helpers.jsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const COLORS = ['#6366f1','#f43f5e','#f59e0b','#10b981','#3b82f6','#8b5cf6','#06b6d4','#ec4899'];

// ── Presupuestos ──────────────────────────────────────────────
function BudgetSection({ categories, summary }) {
  const [budgets, setBudgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('budgets') || '{}'); } catch { return {}; }
  });
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');

  const totalBudget = Object.values(budgets).reduce((s, v) => s + Number(v), 0);
  const totalSpent = summary?.totals?.expenses || 0;
  const totalPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const save = (key, val) => {
    const next = { ...budgets, [key]: Number(val.replace(/\./g,'')) || 0 };
    setBudgets(next);
    localStorage.setItem('budgets', JSON.stringify(next));
    setEditing(null);
  };

  const expCats = categories.filter(c => c.type !== 'income');

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h3>Presupuesto del mes</h3>
        {totalBudget > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
            {fmt(totalSpent)} / {fmt(totalBudget)}
          </span>
        )}
      </div>

      {/* Barra total */}
      {totalBudget > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="progress-bar" style={{ height: 10 }}>
            <div className="progress-fill" style={{
              width: `${totalPct}%`,
              background: totalPct >= 100 ? 'var(--red)' : totalPct >= 80 ? 'var(--yellow)' : 'var(--green)'
            }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 4 }}>
            {totalPct.toFixed(0)}% del presupuesto total usado
          </div>
        </div>
      )}

      {/* Por categoría */}
      <div className="stack" style={{ gap: 10 }}>
        {expCats.slice(0, 6).map(c => {
          const spent = summary?.byCategory?.find(x => x.name === c.name && x.type === 'expense')?.total || 0;
          const limit = budgets[c.name] || 0;
          const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
          const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--accent)';

          return (
            <div key={c.id}>
              <div className="flex-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '0.82rem' }}>{c.icon} {c.name}</span>
                {editing === c.name ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>$</span>
                    <input
                      autoFocus
                      value={editVal}
                      onChange={e => setEditVal(e.target.value.replace(/[^0-9]/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.'))}
                      onKeyDown={e => { if (e.key === 'Enter') save(c.name, editVal); if (e.key === 'Escape') setEditing(null); }}
                      style={{ width: 90, background: 'var(--bg3)', border: '1px solid var(--accent)',
                        borderRadius: 4, padding: '2px 6px', color: 'var(--text)', fontSize: '0.78rem',
                        fontFamily: 'var(--mono)', outline: 'none' }}
                    />
                    <button onClick={() => save(c.name, editVal)}
                      style={{ background: 'var(--accent)', border: 'none', color: '#fff',
                        borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.72rem' }}>✓</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditing(c.name); setEditVal(limit > 0 ? limit.toLocaleString('es-CO') : ''); }}
                    style={{ background: 'none', border: 'none', color: limit > 0 ? 'var(--text2)' : 'var(--text3)',
                      cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'var(--font)' }}>
                    {limit > 0 ? `${fmt(spent)} / ${fmt(limit)}` : '+ límite'}
                  </button>
                )}
              </div>
              {limit > 0 && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 10 }}>
        Toca "+ límite" en cualquier categoría para editarlo
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────
export default function Dashboard({ onAdd }) {
  const { user, household } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState({ personal: [], shared: [] });
  const [debts, setDebts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      api.getSummary({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      api.getAccounts(household?.id),
      api.getDebts(household?.id),
      api.getTransactions({ limit: 5 }),
      api.getCategories(),
    ]).then(([s, a, d, t, cats]) => {
      setSummary(s);
      setAccounts(a);
      setDebts(d.filter(x => x.direction === 'owe').slice(0, 3));
      setRecent(t);
      setCategories(cats);
    }).finally(() => setLoading(false));
  }, [household]);

  // Solo cuentas personales para el balance propio
  const personalBalance = (accounts.personal || [])
    .reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  const income = Number(summary?.totals?.income || 0);
  const expenses = Number(summary?.totals?.expenses || 0);
  const balanceMes = income - expenses;

  const expenseCategories = summary?.byCategory?.filter(c => c.type === 'expense') || [];

  if (loading) return (
    <div className="stack">
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
    </div>
  );

  const now = new Date();

  return (
    <div className="stack">
      {/* Header */}
      <div className="flex-between">
        <div>
          <div className="page-title">Hola, {user?.name?.split(' ')[0]} 👋</div>
          <div className="page-subtitle">{MONTHS[now.getMonth()]} {now.getFullYear()}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Agregar</button>
      </div>

      {/* Balance personal */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        border: '1px solid #2d2b5e'
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.05em' }}>
          MIS CUENTAS
        </div>
        <div className={`summary-num ${personalBalance >= 0 ? 'amount-income' : 'amount-expense'}`}>
          {fmt(personalBalance)}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Ingresos mes</div>
            <div className="amount amount-income" style={{ fontSize: '0.9rem' }}>+{fmt(income)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Gastos mes</div>
            <div className="amount amount-expense" style={{ fontSize: '0.9rem' }}>-{fmt(expenses)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Sobrante</div>
            <div className={`amount ${balanceMes >= 0 ? 'amount-income' : 'amount-expense'}`} style={{ fontSize: '0.9rem' }}>
              {balanceMes >= 0 ? '+' : ''}{fmt(balanceMes)}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta hogar */}
      {household && (
        <button onClick={() => navigate('/hogar')}
          style={{
            background: 'linear-gradient(135deg, #0f2a1e 0%, #0a1f18 100%)',
            border: '1px solid #1a4a30', borderRadius: 'var(--radius)',
            padding: 16, cursor: 'pointer', textAlign: 'left', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>
              HOGAR COMPARTIDO
            </div>
            <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{household.name}</div>
            <div style={{ fontSize: '0.78rem', color: '#86efac', marginTop: 2 }}>
              Ver gastos compartidos →
            </div>
          </div>
          <div style={{ fontSize: '2rem' }}>🏠</div>
        </button>
      )}

      {/* Cuentas */}
      {(accounts.personal || []).length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Mis cuentas</h3>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {(accounts.personal || []).map(a => (
              <div key={a.id} className="account-card"
                style={{ minWidth: 155, color: a.color || 'var(--accent)',
                  background: `linear-gradient(135deg, ${a.color}22, var(--bg3))`,
                  borderColor: `${a.color}44` }}>
                <div style={{ fontSize: '1.3rem' }}>{a.icon}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text2)', fontWeight: 500 }}>{a.name}</div>
                <div className={`amount ${parseFloat(a.balance) >= 0 ? 'amount-income' : 'amount-expense'}`}
                  style={{ fontSize: '0.95rem' }}>
                  {fmt(a.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presupuestos */}
      {categories.length > 0 && (
        <BudgetSection categories={categories} summary={summary} />
      )}

      {/* Gráfica gastos por categoría */}
      {expenseCategories.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Gastos por categoría</h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={expenseCategories} cx="50%" cy="50%" innerRadius={36} outerRadius={60}
                  dataKey="total" paddingAngle={2}>
                  {expenseCategories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: '0.8rem'
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {expenseCategories.slice(0, 5).map((c, i) => (
                <div key={i} className="flex-between" style={{ fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span>{c.icon} {c.name}</span>
                  </div>
                  <span className="amount" style={{ color: 'var(--text2)', fontSize: '0.78rem' }}>{fmt(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Últimos 6 meses */}
      {(summary?.monthly?.length || 0) > 1 && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Últimos meses</h3>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={summary.monthly} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: '0.8rem'
              }} />
              <Bar dataKey="income" fill="var(--green)" radius={[4,4,0,0]} name="Ingresos" />
              <Bar dataKey="expenses" fill="var(--red)" radius={[4,4,0,0]} name="Gastos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deudas */}
      {debts.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Deudas activas</h3>
          <div className="stack">
            {debts.map(d => (
              <div key={d.id} className="debt-card">
                <div className="debt-header">
                  <div>
                    <div className="debt-name">{d.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: 2 }}>
                      Debes a {d.counterpart}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="amount amount-expense" style={{ fontSize: '0.9rem' }}>{fmt(d.remaining)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>de {fmt(d.total_amount)}</div>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${d.progress_pct || 0}%`, background: 'var(--red)' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 4 }}>
                  {d.progress_pct || 0}% pagado
                  {d.due_date && ` · vence ${new Date(d.due_date).toLocaleDateString('es-CO')}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recientes */}
      {recent.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Movimientos recientes</h3>
          <div className="card" style={{ padding: 8 }}>
            {recent.map(t => (
              <div key={t.id} className="tx-item">
                <div className="tx-icon" style={{ background: `${t.category_color || 'var(--accent)'}22` }}>
                  {t.category_icon || (t.type === 'income' ? '↑' : '↓')}
                </div>
                <div className="tx-info">
                  <div className="tx-desc">{t.description || t.category_name || t.type}</div>
                  <div className="tx-meta">{t.account_name} · {fmtRelative(t.date)}</div>
                </div>
                <div className={`tx-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recent.length === 0 && (accounts.personal || []).length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>💸</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Aún no hay movimientos</div>
          <div style={{ fontSize: '0.85rem', marginBottom: 20 }}>Empieza creando una cuenta y registrando tus gastos</div>
          <button className="btn btn-primary" onClick={onAdd}>+ Primer movimiento</button>
        </div>
      )}
    </div>
  );
}