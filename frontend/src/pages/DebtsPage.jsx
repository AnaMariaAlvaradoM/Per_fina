import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtDate } from '../components/ui/helpers';

export default function DebtsPage({ onAdd }) {
  const { household } = useAuth();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', total_amount: '', direction: 'owe',
    counterpart: '', due_date: '', interest_rate: '', is_shared: false
  });

  const load = () => api.getDebts(household?.id).then(setDebts).finally(() => setLoading(false));
  useEffect(() => { load(); }, [household]);

  const save = async () => {
    if (!form.name || !form.total_amount || !form.counterpart) {
      setError('Completa nombre, monto y contraparte');
      return;
    }
    setSaving(true); setError('');
    try {
      await api.createDebt({
        ...form,
        total_amount: parseFloat(form.total_amount),
        interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
        due_date: form.due_date || null,
        household_id: household?.id
      });
      setShowForm(false);
      setForm({ name: '', description: '', total_amount: '', direction: 'owe', counterpart: '', due_date: '', interest_rate: '', is_shared: false });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const myDebts = debts.filter(d => d.direction === 'owe');
  const theyOwe = debts.filter(d => d.direction === 'owed');
  const totalOwe = myDebts.reduce((s, d) => s + parseFloat(d.remaining || 0), 0);
  const totalOwed = theyOwe.reduce((s, d) => s + parseFloat(d.remaining || 0), 0);

  return (
    <div className="stack">
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Deudas</div>
          <div className="page-subtitle">{debts.length} activas</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nueva</button>
      </div>

      {/* Resumen */}
      <div className="grid-2">
        <div className="card" style={{ borderColor: 'var(--red-dim)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 4 }}>YO DEBO</div>
          <div className="amount amount-expense" style={{ fontSize: '1.3rem', fontFamily: 'var(--mono)', fontWeight: 800 }}>{fmt(totalOwe)}</div>
        </div>
        <div className="card" style={{ borderColor: 'var(--green-dim)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 4 }}>ME DEBEN</div>
          <div className="amount amount-income" style={{ fontSize: '1.3rem', fontFamily: 'var(--mono)', fontWeight: 800 }}>{fmt(totalOwed)}</div>
        </div>
      </div>

      {loading && <div className="skeleton" style={{ height: 120 }} />}

      {myDebts.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10, color: 'var(--text2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Lo que debo
          </h3>
          <div className="stack">
            {myDebts.map(d => <DebtCard key={d.id} debt={d} onPay={onAdd} />)}
          </div>
        </div>
      )}

      {theyOwe.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10, color: 'var(--text2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Lo que me deben
          </h3>
          <div className="stack">
            {theyOwe.map(d => <DebtCard key={d.id} debt={d} />)}
          </div>
        </div>
      )}

      {!loading && debts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text2)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✨</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Sin deudas registradas</div>
          <div style={{ fontSize: '0.85rem', marginBottom: 16 }}>Registra lo que debes o lo que te deben</div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nueva deuda</button>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Nueva deuda</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="stack">
              {/* Dirección */}
              <div className="type-tabs">
                <button className={`type-tab expense ${form.direction === 'owe' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, direction: 'owe' }))}>
                  💸 Yo debo
                </button>
                <button className={`type-tab income ${form.direction === 'owed' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, direction: 'owed' }))}>
                  📥 Me deben
                </button>
              </div>

              <div className="field">
                <label>Nombre</label>
                <input className="input" placeholder="Ej: Préstamo banco, Cuota celular..."
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Monto total (COP)</label>
                  <input className="input" type="number" placeholder="0"
                    value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{form.direction === 'owe' ? 'A quién debo' : 'Quién me debe'}</label>
                  <input className="input" placeholder="Nombre"
                    value={form.counterpart} onChange={e => setForm(f => ({ ...f, counterpart: e.target.value }))} />
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Vencimiento (opcional)</label>
                  <input className="input" type="date"
                    value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Interés % (opcional)</label>
                  <input className="input" type="number" placeholder="0"
                    value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
                </div>
              </div>

              <div className="field">
                <label>Descripción (opcional)</label>
                <input className="input" placeholder="Notas adicionales"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {household && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text2)' }}>
                  <input type="checkbox" checked={form.is_shared} onChange={e => setForm(f => ({ ...f, is_shared: e.target.checked }))} />
                  Deuda compartida del hogar
                </label>
              )}

              {error && <div className="field-error">⚠ {error}</div>}
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Registrar deuda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DebtCard({ debt: d, onPay }) {
  const isOwe = d.direction === 'owe';
  const pct = Math.min(100, parseFloat(d.progress_pct || 0));
  const isOverdue = d.due_date && new Date(d.due_date) < new Date() && parseFloat(d.remaining) > 0;

  return (
    <div className="debt-card" style={{ borderColor: isOverdue ? 'var(--red-dim)' : 'var(--border)' }}>
      <div className="debt-header">
        <div style={{ flex: 1 }}>
          <div className="debt-name">{d.name}</div>
          <div style={{ fontSize: '0.78rem', color: isOwe ? 'var(--red)' : 'var(--green)', marginTop: 2 }}>
            {isOwe ? `Debes a ${d.counterpart}` : `Te debe ${d.counterpart}`}
          </div>
          {isOverdue && <div style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: 2 }}>⚠ Vencida</div>}
          {d.due_date && !isOverdue && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 2 }}>
              Vence: {fmtDate(d.due_date)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 100 }}>
          <div className={`amount ${isOwe ? 'amount-expense' : 'amount-income'}`} style={{ fontSize: '1rem' }}>
            {fmt(d.remaining)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>de {fmt(d.total_amount)}</div>
        </div>
      </div>

      <div className="progress-bar" style={{ margin: '8px 0 4px' }}>
        <div className="progress-fill"
          style={{ width: `${pct}%`, background: isOwe ? 'var(--red)' : 'var(--green)' }} />
      </div>

      <div className="flex-between" style={{ marginTop: 6 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
          {pct}% pagado · Pagado: {fmt(d.paid_amount)}
        </div>
        {isOwe && onPay && (
          <button className="btn btn-sm btn-primary" onClick={onPay} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
            Pagar
          </button>
        )}
      </div>
    </div>
  );
}
