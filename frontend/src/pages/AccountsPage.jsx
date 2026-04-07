import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { fmt, ACCOUNT_ICONS, ACCOUNT_LABELS } from '../components/ui/helpers.jsx';

const COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#3b82f6','#8b5cf6','#06b6d4','#ec4899'];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState({ personal: [], shared: [] });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', type: 'checking', balance: '', color: COLORS[0], icon: '🏦' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingAccount, setEditingAccount] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const load = () => api.getAccounts().then(setAccounts).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await api.updateAccount(editingAccount.id, {
        name: editForm.name,
        color: editForm.color,
        icon: editForm.icon,
        balance: parseFloat(editForm.balance) || 0,
        is_active: true,
      });
      load();
      setEditingAccount(null);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const save = async () => {
    if (!form.name) { setError('Ingresa el nombre'); return; }
    setSaving(true); setError('');
    try {
      await api.createAccount({
        ...form,
        balance: parseFloat(form.balance) || 0,
      });
      setShowForm(false);
      setForm({ name: '', type: 'checking', balance: '', color: COLORS[0], icon: '🏦' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const allAccounts = [...(accounts.personal || []), ...(accounts.shared || [])];
  const totalBalance = allAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  return (
    <div className="stack">
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Cuentas</div>
          <div className="page-subtitle">Total: <span className={totalBalance >= 0 ? 'amount-income' : 'amount-expense'}>{fmt(totalBalance)}</span></div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nueva</button>
      </div>

      {loading && <div className="skeleton" style={{ height: 120 }} />}

      {allAccounts.length > 0 && (
        <div className="stack">
          {allAccounts.map(a => (
            <AccountCard
              key={a.id}
              account={a}
              onEdit={() => {
                setEditingAccount(a);
                setEditForm({ name: a.name, color: a.color, icon: a.icon, balance: a.balance });
              }}
            />
          ))}
        </div>
      )}

      {!loading && allAccounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text2)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏦</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Sin cuentas aún</div>
          <div style={{ fontSize: '0.85rem', marginBottom: 16 }}>Agrega tus cuentas bancarias, efectivo o Nequi</div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Agregar cuenta</button>
        </div>
      )}

      {/* Modal nueva cuenta */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Nueva cuenta</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="stack">
              <div className="field">
                <label>Nombre</label>
                <input className="input" placeholder="Ej: Bancolombia ahorros"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Tipo</label>
                  <select className="select" value={form.type} onChange={e => {
                    const icon = ACCOUNT_ICONS[e.target.value] || '🏦';
                    setForm(f => ({ ...f, type: e.target.value, icon }));
                  }}>
                    {Object.entries(ACCOUNT_LABELS).map(([k, v]) =>
                      <option key={k} value={k}>{ACCOUNT_ICONS[k]} {v}</option>
                    )}
                  </select>
                </div>
                <div className="field">
                  <label>Saldo inicial</label>
                  <input className="input" type="number" placeholder="0"
                    value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label>Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c,
                        border: form.color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              {error && <div className="field-error">⚠ {error}</div>}
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar cuenta */}
      {editingAccount && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingAccount(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Editar cuenta</h2>
              <button className="modal-close" onClick={() => setEditingAccount(null)}>✕</button>
            </div>
            <div className="stack">
              <div className="field">
                <label>Nombre</label>
                <input className="input" value={editForm.name || ''}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label>Saldo actual (COP)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: '1rem', fontWeight: 700, color: 'var(--text2)'
                  }}>$</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={editForm.balance !== '' && editForm.balance != null
                      ? Number(String(editForm.balance).replace(/\./g, '').replace(/[^0-9]/g, '') || 0).toLocaleString('es-CO')
                      : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                      setEditForm(f => ({ ...f, balance: raw }));
                    }}
                    style={{ paddingLeft: 28 }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                  Ajusta el saldo directamente para corregir valores incorrectos
                </span>
              </div>
              <div className="field">
                <label>Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c,
                        border: editForm.color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button className="btn btn-danger btn-full" onClick={async () => {
                if (!confirm('¿Desactivar esta cuenta?')) return;
                await api.deleteAccount(editingAccount.id);
                setEditingAccount(null);
                load();
              }}>
                Desactivar cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountCard({ account: a, onEdit }) {
  return (
    <div className="account-card" style={{ color: a.color, background: `linear-gradient(135deg, ${a.color}18, var(--bg2))`, borderColor: `${a.color}33` }}>
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '1.6rem' }}>{a.icon}</div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{a.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>{ACCOUNT_LABELS[a.type] || a.type}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div className={`amount ${parseFloat(a.balance) >= 0 ? 'amount-income' : 'amount-expense'}`}
              style={{ fontSize: '1.05rem' }}>
              {fmt(a.balance)}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEdit(a);
            }}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
              width: 44, height: 44, cursor: 'pointer', fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation'
            }}>
            ✏
          </button>
        </div>
      </div>
    </div>
  );
}