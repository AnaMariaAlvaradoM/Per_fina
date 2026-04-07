import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { fmt, fmtDate, fmtRelative } from './helpers.jsx';

const TYPES = [
  { key: 'expense', label: '↓ Gasto' },
  { key: 'income',  label: '↑ Ingreso' },
  { key: 'transfer', label: '⇄ Transferencia' },
  { key: 'debt_payment', label: '💳 Pagar deuda' },
];

export default function AddTransactionModal({ onClose, onSaved }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [debtId, setDebtId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getDebts()
    ]).then(([accs, cats, dbs]) => {
      const all = [...(accs.personal || []), ...(accs.shared || [])];
      setAccounts(all);
      if (all.length) setAccountId(String(all[0].id));
      setCategories(cats);
      setDebts(dbs.filter(d => d.direction === 'owe' && d.is_active));
    });
  }, []);

  const filteredCats = categories.filter(c =>
    type === 'income' ? c.type !== 'expense' : c.type !== 'income'
  );

  const submit = async () => {
    if (!amount || isNaN(amount) || !accountId) {
      setError('Completa monto y cuenta');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.createTransaction({
        amount: parseFloat(amount),
        type,
        description,
        date,
        account_id: parseInt(accountId),
        category_id: categoryId ? parseInt(categoryId) : null,
        debt_id: type === 'debt_payment' && debtId ? parseInt(debtId) : null,
        transfer_to_account_id: type === 'transfer' && toAccountId ? parseInt(toAccountId) : null,
      });
      onSaved?.();
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
          <h2>Nueva transacción</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="stack">
          {/* Tipo */}
          <div className="type-tabs">
            {TYPES.map(t => (
              <button key={t.key} className={`type-tab ${t.key} ${type === t.key ? 'active' : ''}`}
                onClick={() => setType(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Monto */}
          <div className="field">
            <label>Monto (COP)</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: '1.2rem', fontWeight: 700, color: 'var(--text2)'
              }}>$</span>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount ? Number(amount).toLocaleString('es-CO') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                  setAmount(raw);
                }}
                style={{ fontSize: '1.2rem', fontWeight: 700, paddingLeft: 28 }}
              />
            </div>
          </div>

          <div className="grid-2">
            {/* Cuenta */}
            <div className="field">
              <label>Cuenta</label>
              <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Fecha */}
            <div className="field">
              <label>Fecha</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Cuenta destino (transferencia) */}
          {type === 'transfer' && (
            <div className="field">
              <label>Cuenta destino</label>
              <select className="select" value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
                <option value="">— Selecciona —</option>
                {accounts.filter(a => String(a.id) !== accountId).map(a =>
                  <option key={a.id} value={a.id}>{a.name}</option>
                )}
              </select>
            </div>
          )}

          {/* Deuda (pago de deuda) */}
          {type === 'debt_payment' && (
            <div className="field">
              <label>Deuda a pagar</label>
              <select className="select" value={debtId} onChange={e => setDebtId(e.target.value)}>
                <option value="">— Selecciona —</option>
                {debts.map(d => <option key={d.id} value={d.id}>{d.name} — {d.counterpart}</option>)}
              </select>
            </div>
          )}

          {/* Categoría */}
          {type !== 'transfer' && (
            <div className="field">
              <label>Categoría</label>
              <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">— Sin categoría —</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          )}

          {/* Descripción */}
          <div className="field">
            <label>Descripción (opcional)</label>
            <input className="input" placeholder="¿En qué fue?" value={description}
              onChange={e => setDescription(e.target.value)} />
          </div>

          {error && <div className="field-error">⚠ {error}</div>}

          <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar transacción'}
          </button>
        </div>
      </div>
    </div>
  );
}