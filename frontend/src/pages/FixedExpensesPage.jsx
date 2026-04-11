import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { fmt } from '../components/ui/helpers.jsx';

function RegisterModal({ fixed, accounts, onClose, onSaved }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ? String(accounts[0].id) : '');
  const [amount, setAmount]       = useState(String(fixed.amount));
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const submit = async () => {
    if (!accountId) { setError('Selecciona una cuenta'); return; }
    setLoading(true);
    try {
      await api.registerFixed(fixed.id, {
        account_id: parseInt(accountId),
        amount: parseFloat(amount),
        date,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Registrar — {fixed.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="stack">
          <div className="field">
            <label>Monto (COP)</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: '1.2rem', fontWeight: 700, color: 'var(--text2)'
              }}>$</span>
              <input className="input" type="text" inputMode="numeric"
                value={amount ? Number(amount).toLocaleString('es-CO') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                  setAmount(raw);
                }}
                style={{ fontSize: '1.2rem', fontWeight: 700, paddingLeft: 28 }}
              />
            </div>
          </div>
          <div className="field">
            <label>Cuenta</label>
            <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Fecha</label>
            <input className="input" type="date" value={date}
              onChange={e => setDate(e.target.value)} />
          </div>
          {error && <div className="field-error">⚠ {error}</div>}
          <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
            {loading ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FixedForm({ initial, categories, onSave, onCancel }) {
  const [name, setName]           = useState(initial?.name || '');
  const [amount, setAmount]       = useState(initial?.amount ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ? String(initial.category_id) : '');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const submit = async () => {
    if (!name || !amount) { setError('Completa nombre y monto'); return; }
    setLoading(true);
    try {
      await onSave({ name, amount: parseFloat(amount), category_id: categoryId || null });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ border: '1px solid var(--accent)' }}>
      <div className="stack">
        <div className="grid-2">
          <div className="field">
            <label>Nombre</label>
            <input className="input" placeholder="Ej: Netflix" value={name}
              onChange={e => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Monto (COP)</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontWeight: 700, color: 'var(--text2)'
              }}>$</span>
              <input className="input" type="text" inputMode="numeric" placeholder="0"
                value={amount ? Number(amount).toLocaleString('es-CO') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                  setAmount(raw);
                }}
                style={{ paddingLeft: 28 }}
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label>Categoría (opcional)</label>
          <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">— Sin categoría —</option>
            {categories.filter(c => c.type !== 'income').map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        {error && <div className="field-error">⚠ {error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button className="btn" onClick={onCancel}
            style={{ background: 'var(--bg3)', color: 'var(--text2)', border: 'none' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FixedExpensesPage() {
  const [items, setItems]         = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [registering, setRegistering] = useState(null);
  const [toast, setToast]         = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getFixed(),
      api.getAccounts(),
      api.getCategories(),
    ]).then(([fixed, accs, cats]) => {
      setItems(fixed);
      setAccounts(accs.personal || []);
      setCategories(cats);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleCreate = async (data) => {
    await api.createFixed(data);
    setShowForm(false);
    load();
  };

  const handleEdit = async (data) => {
    await api.updateFixed(editing.id, data);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteFixed(id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  const totalFijos = items.reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <>
      {registering && (
        <RegisterModal
          fixed={registering}
          accounts={accounts}
          onClose={() => setRegistering(null)}
          onSaved={() => { showToast('✅ Registrado como gasto'); setRegistering(null); }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          padding: '10px 20px', borderRadius: 10, fontSize: '0.88rem',
          color: 'var(--text1)', zIndex: 999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          {toast}
        </div>
      )}

      <div className="stack">
        <div className="flex-between page-header">
          <div>
            <div className="page-title">Gastos Fijos</div>
            <div className="page-subtitle">
              {items.length} fijos · total {fmt(totalFijos)}/mes
            </div>
          </div>
          {!showForm && !editing && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              + Agregar
            </button>
          )}
        </div>

        {showForm && (
          <FixedForm
            categories={categories}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading && (
          <div className="stack">
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 70 }} />)}
          </div>
        )}

        {!loading && items.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text2)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Sin gastos fijos aún</div>
            <div style={{ fontSize: '0.85rem', marginBottom: 20 }}>
              Agrega tus gastos recurrentes para registrarlos fácil cada mes
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              + Agregar primero
            </button>
          </div>
        )}

        {items.map(item => (
          editing?.id === item.id ? (
            <FixedForm
              key={item.id}
              initial={item}
              categories={categories}
              onSave={handleEdit}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div key={item.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: `${item.category_color || 'var(--accent)'}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem'
                }}>
                  {item.category_icon || '📌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
                    {item.category_name || 'Sin categoría'}
                  </div>
                </div>
                <div className="amount amount-expense" style={{ fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                  -{fmt(item.amount)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                  onClick={() => setRegistering(item)}>
                  ▶ Registrar
                </button>
                <button className="btn btn-sm"
                  style={{ background: 'var(--bg3)', color: 'var(--text2)', border: 'none' }}
                  onClick={() => { setEditing(item); setShowForm(false); }}>
                  ✏️
                </button>
                <button className="btn btn-sm"
                  style={{ background: 'var(--red-dim)', color: 'var(--red)', border: 'none' }}
                  onClick={() => handleDelete(item.id)}>
                  🗑
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </>
  );
}