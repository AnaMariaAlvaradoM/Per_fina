import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmt, ACCOUNT_ICONS, ACCOUNT_LABELS } from '../components/ui/helpers';

const COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#3b82f6','#8b5cf6','#06b6d4','#ec4899'];

export default function AccountsPage() {
  const { household } = useAuth();
  const [accounts, setAccounts] = useState({ personal: [], shared: [] });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', type: 'checking', balance: '', color: COLORS[0], icon: '🏦', is_shared: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.getAccounts(household?.id).then(setAccounts).finally(() => setLoading(false));
  useEffect(() => { load(); }, [household]);

  const save = async () => {
    if (!form.name) { setError('Ingresa el nombre'); return; }
    setSaving(true); setError('');
    try {
      await api.createAccount({
        ...form,
        balance: parseFloat(form.balance) || 0,
        household_id: household?.id
      });
      setShowForm(false);
      setForm({ name: '', type: 'checking', balance: '', color: COLORS[0], icon: '🏦', is_shared: false });
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

      {/* Personales */}
      {accounts.personal?.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10, color: 'var(--text2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Mis cuentas
          </h3>
          <div className="stack">
            {accounts.personal.map(a => <AccountCard key={a.id} account={a} />)}
          </div>
        </div>
      )}

      {/* Compartidas */}
      {accounts.shared?.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10, color: 'var(--text2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🏠 Cuentas del hogar
          </h3>
          <div className="stack">
            {accounts.shared.map(a => <AccountCard key={a.id} account={a} shared />)}
          </div>
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

      {/* Hogar invite */}
      {household && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 6 }}>
            📎 Código de invitación del hogar
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem', fontWeight: 700,
            color: 'var(--accent)', letterSpacing: '0.15em' }}>
            {household.invite_code}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 4 }}>
            Comparte este código con tu pareja para que se una al hogar
          </div>
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
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              {household && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text2)' }}>
                  <input type="checkbox" checked={form.is_shared} onChange={e => setForm(f => ({ ...f, is_shared: e.target.checked }))} />
                  Cuenta compartida del hogar
                </label>
              )}
              {error && <div className="field-error">⚠ {error}</div>}
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountCard({ account: a, shared }) {
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
        <div style={{ textAlign: 'right' }}>
          <div className={`amount ${parseFloat(a.balance) >= 0 ? 'amount-income' : 'amount-expense'}`}
            style={{ fontSize: '1.05rem' }}>
            {fmt(a.balance)}
          </div>
          {shared && <span className="badge badge-blue" style={{ fontSize: '0.65rem', marginTop: 4 }}>Hogar</span>}
        </div>
      </div>
    </div>
  );
}
