import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtRelative } from '../components/ui/helpers';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function Dashboard({ onAdd }) {
  const { user, household } = useAuth();
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState({ personal: [], shared: [] });
  const [debts, setDebts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      api.getSummary({ household_id: household?.id, year: now.getFullYear(), month: now.getMonth() + 1 }),
      api.getAccounts(household?.id),
      api.getDebts(household?.id),
      api.getTransactions({ household_id: household?.id, limit: 5 })
    ]).then(([s, a, d, t]) => {
      setSummary(s);
      setAccounts(a);
      setDebts(d.slice(0, 3));
      setRecent(t);
    }).finally(() => setLoading(false));
  }, [household]);

  const totalBalance = [...(accounts.personal || []), ...(accounts.shared || [])]
    .reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  const expenseCategories = summary?.byCategory?.filter(c => c.type === 'expense') || [];
  const COLORS = ['#6366f1','#f43f5e','#f59e0b','#10b981','#3b82f6','#8b5cf6','#06b6d4','#ec4899'];

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

      {/* Balance total */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        border: '1px solid #2d2b5e'
      }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>
          BALANCE TOTAL
        </div>
        <div className={`summary-num ${totalBalance >= 0 ? 'amount-income' : 'amount-expense'}`}>
          {fmt(totalBalance)}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Ingresos</div>
            <div className="amount amount-income" style={{ fontSize: '0.95rem' }}>
              +{fmt(summary?.totals?.income)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Gastos</div>
            <div className="amount amount-expense" style={{ fontSize: '0.95rem' }}>
              -{fmt(summary?.totals?.expenses)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>Balance mes</div>
            <div className={`amount ${(summary?.totals?.income - summary?.totals?.expenses) >= 0 ? 'amount-income' : 'amount-expense'}`}
              style={{ fontSize: '0.95rem' }}>
              {fmt((summary?.totals?.income || 0) - (summary?.totals?.expenses || 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Cuentas */}
      {[...(accounts.personal || []), ...(accounts.shared || [])].length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Mis cuentas</h3>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {[...(accounts.personal || []), ...(accounts.shared || [])].map(a => (
              <div key={a.id} className="account-card"
                style={{ minWidth: 160, color: a.color || 'var(--accent)',
                  background: `linear-gradient(135deg, ${a.color}22, var(--bg3))`,
                  borderColor: `${a.color}44` }}>
                <div style={{ fontSize: '1.4rem' }}>{a.icon}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text2)', fontWeight: 500 }}>{a.name}</div>
                <div className={`amount ${parseFloat(a.balance) >= 0 ? 'amount-income' : 'amount-expense'}`}
                  style={{ fontSize: '1rem' }}>
                  {fmt(a.balance)}
                </div>
                {a.is_shared && <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>Hogar</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfica de gastos por categoría */}
      {expenseCategories.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Gastos por categoría</h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={expenseCategories} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
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
                  <span className="amount" style={{ color: 'var(--text2)' }}>{fmt(c.total)}</span>
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
          <ResponsiveContainer width="100%" height={120}>
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
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <h3>Deudas activas</h3>
          </div>
          <div className="stack">
            {debts.map(d => (
              <div key={d.id} className="debt-card">
                <div className="debt-header">
                  <div>
                    <div className="debt-name">{d.name}</div>
                    <div className="debt-direction" style={{ color: d.direction === 'owe' ? 'var(--red)' : 'var(--green)', marginTop: 2 }}>
                      {d.direction === 'owe' ? `Debes a ${d.counterpart}` : `Te debe ${d.counterpart}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="amount amount-expense" style={{ fontSize: '0.9rem' }}>{fmt(d.remaining)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>de {fmt(d.total_amount)}</div>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill"
                    style={{ width: `${d.progress_pct || 0}%`, background: d.direction === 'owe' ? 'var(--red)' : 'var(--green)' }} />
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

      {/* Movimientos recientes */}
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
      {!loading && recent.length === 0 && accounts.personal?.length === 0 && (
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
