import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { fmt } from '../components/ui/helpers.jsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const GROUPS = [
  { key: 'basicos',    label: '🏠 Gastos Básicos' },
  { key: 'deudas',     label: '💳 Deudas' },
  { key: 'trabajo',    label: '💼 Trabajo' },
  { key: 'ahorro',     label: '🎯 Ahorro e inversión' },
  { key: 'personales', label: '🎉 Gastos personales' },
  { key: 'otros',      label: '📦 Otros' },
];

const GROUP_503020_COLORS = { basicos: '#3b82f6', personales: '#ec4899', ahorro: '#10b981' };
const GROUP_503020_LABELS = { basicos: 'Básicos', personales: 'Personales', ahorro: 'Ahorro' };

const currentMonth = () => new Date().toISOString().slice(0, 7);

const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

const pctColor = (pct) => pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';

// ── Tarjeta de una categoría dentro del presupuesto ──
function CategoryRow({ cat, onSave }) {
  const [raw, setRaw] = useState(String(cat.presupuesto || ''));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setRaw(String(cat.presupuesto || '')); }, [cat.presupuesto]);

  const commit = async () => {
    const value = Number(raw) || 0;
    if (value === cat.presupuesto) return;
    setSaving(true);
    try {
      await onSave(cat.category_id, value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="flex-between" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: `${cat.color || 'var(--accent)'}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem'
          }}>
            {cat.icon || '📌'}
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.name}</div>
        </div>
        <div style={{ position: 'relative', width: 130, flexShrink: 0 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: '0.8rem', color: 'var(--text2)' }}>$</span>
          <input className="input" type="text" inputMode="numeric"
            value={raw ? Number(raw).toLocaleString('es-CO') : ''}
            placeholder="0"
            onChange={e => setRaw(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))}
            onBlur={commit}
            style={{ padding: '7px 10px 7px 22px', fontSize: '0.82rem', textAlign: 'right' }}
          />
        </div>
      </div>

      <div className="progress-bar" style={{ marginBottom: 8 }}>
        <div className="progress-fill" style={{ width: `${Math.min(cat.pct, 100)}%`, background: pctColor(cat.pct) }} />
      </div>

      <div className="flex-between" style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>
        <span>Gastado <b style={{ color: 'var(--text)' }}>{fmt(cat.gastado)}</b></span>
        <span>Disponible <b style={{ color: cat.disponible < 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(cat.disponible)}</b></span>
        <span style={{ color: pctColor(cat.pct), fontWeight: 700 }}>{cat.pct}%{saving ? ' · ...' : ''}</span>
      </div>
    </div>
  );
}

// ── Gráfico 50-30-20 (plan o real) ──
function Chart503020({ title, data, total }) {
  const rows = ['basicos', 'personales', 'ahorro'].map(k => ({
    key: k, name: GROUP_503020_LABELS[k], value: data[k] || 0, color: GROUP_503020_COLORS[k]
  }));
  const hasData = rows.some(r => r.value > 0);

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: '0.9rem' }}>{title}</h3>
      {!hasData ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>
          Sin datos aún
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie data={rows} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={2}>
                {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem'
              }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map(r => (
              <div key={r.key} className="flex-between" style={{ fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <span>{r.name}</span>
                </div>
                <span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
                  {total > 0 ? `${Math.round((r.value / total) * 100)}%` : fmt(r.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BudgetPage() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const load = () => {
    setLoading(true);
    Promise.all([api.getBudget(month), api.getBudgetSummary(month)])
      .then(([b, s]) => { setCategories(b.categories); setSummary(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month]);

  const handleSaveAmount = async (categoryId, amount) => {
    const updated = await api.updateBudgetItem(month, categoryId, amount);
    setCategories(prev => prev.map(c => {
      if (c.category_id !== categoryId) return c;
      const presupuesto = Number(updated.amount_assigned);
      const disponible = presupuesto - c.gastado;
      const pct = presupuesto > 0 ? Math.round((c.gastado / presupuesto) * 100) : (c.gastado > 0 ? 100 : 0);
      return { ...c, presupuesto, disponible, pct };
    }));
    showToast('Guardado ✓');
    api.getBudgetSummary(month).then(setSummary);
  };

  const handleReset = async () => {
    if (!confirm('¿Vaciar el presupuesto de este mes? Se borrarán todos los montos asignados.')) return;
    await api.resetBudget(month);
    showToast('Presupuesto vaciado');
    load();
  };

  if (loading && !summary) {
    return (
      <div className="stack">
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
      </div>
    );
  }

  const cards = summary?.cards || {};
  const cashflow = summary?.flujo_de_caja || {};
  const desviaciones = summary?.desviaciones || [];
  const alerts = summary?.alerts || [];
  const rule = summary?.regla_50_30_20 || { plan: {}, real: {}, ingresos: 0 };

  const groupedCategories = GROUPS.map(g => ({
    ...g,
    items: categories.filter(c => (c.group_key || 'otros') === g.key)
  })).filter(g => g.items.length > 0);

  return (
    <div className="stack">
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          padding: '10px 20px', borderRadius: 10, fontSize: '0.88rem',
          color: 'var(--text)', zIndex: 999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          {toast}
        </div>
      )}

      {/* Header con selector de mes */}
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Presupuesto</div>
          <div className="page-subtitle">Planifica antes de gastar</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg3)', color: 'var(--text2)', border: 'none' }}
            onClick={() => setMonth(m => shiftMonth(m, -1))}>‹</button>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 110, textAlign: 'center' }}>
            {monthLabel(month)}
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--bg3)', color: 'var(--text2)', border: 'none' }}
            onClick={() => setMonth(m => shiftMonth(m, 1))}>›</button>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          {alerts.map((a, i) => (
            <div key={i} className="card" style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
              borderColor: a.type === 'danger' ? 'var(--red)' : 'var(--yellow)'
            }}>
              <span style={{ fontSize: '1.1rem' }}>{a.type === 'danger' ? '🚨' : '⚠️'}</span>
              <span style={{ fontSize: '0.82rem' }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tarjetas dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <div className="card">
          <div className="summary-label">Ingresos del mes</div>
          <div className="amount amount-income" style={{ fontSize: '1.1rem' }}>{fmt(cards.ingresos)}</div>
        </div>
        <div className="card">
          <div className="summary-label">Gastos del mes</div>
          <div className="amount amount-expense" style={{ fontSize: '1.1rem' }}>{fmt(cards.gastos)}</div>
        </div>
        <div className="card">
          <div className="summary-label">Ahorro del mes</div>
          <div className="amount amount-income" style={{ fontSize: '1.1rem' }}>{fmt(cards.ahorro_mes)}</div>
        </div>
        <div className="card">
          <div className="summary-label">Dinero disponible</div>
          <div className={`amount ${cards.disponible >= 0 ? 'amount-income' : 'amount-expense'}`} style={{ fontSize: '1.1rem' }}>
            {fmt(cards.disponible)}
          </div>
        </div>
        <div className="card">
          <div className="summary-label">Pagos pendientes</div>
          <div className="amount" style={{ fontSize: '1.1rem', color: 'var(--yellow)' }}>{fmt(cards.pagos_pendientes)}</div>
        </div>
      </div>

      {/* Flujo de caja proyectado */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Flujo de caja proyectado</h3>
        <div className="stack" style={{ gap: 8 }}>
          <div className="flex-between" style={{ fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text2)' }}>Saldo actual</span>
            <span className="amount amount-neutral">{fmt(cashflow.saldo_actual)}</span>
          </div>
          <div className="flex-between" style={{ fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text2)' }}>Pagos pendientes del mes</span>
            <span className="amount amount-expense">-{fmt(cashflow.pagos_pendientes)}</span>
          </div>
          <div className="divider" />
          <div className="flex-between" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            <span>Dinero realmente disponible</span>
            <span className={`amount ${cashflow.disponible_real >= 0 ? 'amount-income' : 'amount-expense'}`}>
              {fmt(cashflow.disponible_real)}
            </span>
          </div>
        </div>
      </div>

      {/* Regla 50-30-20 */}
      <div className="grid-2">
        <Chart503020 title="Regla 50-30-20 · Presupuesto" data={rule.plan}
          total={(rule.plan.basicos || 0) + (rule.plan.personales || 0) + (rule.plan.ahorro || 0)} />
        <Chart503020 title="Regla 50-30-20 · Real" data={rule.real}
          total={(rule.real.basicos || 0) + (rule.real.personales || 0) + (rule.real.ahorro || 0)} />
      </div>

      {/* Presupuesto por categoría, agrupado */}
      <div className="flex-between">
        <h3>Presupuesto por categoría</h3>
        <button className="btn btn-sm" style={{ background: 'var(--red-dim)', color: 'var(--red)', border: 'none' }}
          onClick={handleReset}>
          Vaciar presupuesto
        </button>
      </div>

      {groupedCategories.map(g => (
        <div key={g.key} className="stack" style={{ gap: 8 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text2)' }}>{g.label}</div>
          {g.items.map(cat => (
            <CategoryRow key={cat.category_id} cat={cat} onSave={handleSaveAmount} />
          ))}
        </div>
      ))}

      {/* Desviaciones */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Desviaciones</h3>
        {desviaciones.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
            Aún no hay presupuesto ni gastos para comparar
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ color: 'var(--text2)', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px', fontWeight: 600 }}>Categoría</th>
                <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Presupuesto</th>
                <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Real</th>
                <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {desviaciones.map(d => (
                <tr key={d.category_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 4px' }}>{d.icon} {d.name}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(d.presupuesto)}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(d.gastado)}</td>
                  <td style={{
                    padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700,
                    color: d.diferencia < 0 ? 'var(--red)' : 'var(--green)'
                  }}>
                    {d.diferencia >= 0 ? '+' : ''}{fmt(d.diferencia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
