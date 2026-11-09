import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { fmt, fmtDay, todayStr, useToast, ToastContainer } from '../components/ui/helpers.jsx';
import { IconCheck, IconDots, IconChevronLeft, IconChevronRight } from '../components/ui/icons.jsx';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const pad = (n) => String(n).padStart(2, '0');
const currentMonth = () => todayStr().slice(0, 7);

const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

const lastDayOf = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
};

// ── Piezas compartidas ──

function Sheet({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="stack">{children}</div>
      </div>
    </div>
  );
}

function MoneyInput({ value, onChange, autoFocus }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        fontSize: '1.2rem', fontWeight: 700, color: 'var(--text2)'
      }}>$</span>
      <input className="input" type="text" inputMode="numeric" placeholder="0"
        autoFocus={autoFocus}
        value={value ? Number(value).toLocaleString('es-CO') : ''}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        style={{ fontSize: '1.2rem', fontWeight: 700, paddingLeft: 28 }}
      />
    </div>
  );
}

// ── Marcar como pagado: crea el gasto en Movimientos ──

function PaySheet({ fixed, accounts, month, onClose, onPaid }) {
  const isCurrent = month === currentMonth();
  const [amount, setAmount]       = useState(String(Math.round(Number(fixed.amount))));
  const [accountId, setAccountId] = useState(accounts[0]?.id ? String(accounts[0].id) : '');
  const [date, setDate]           = useState(isCurrent ? todayStr() : lastDayOf(month));
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const submit = async () => {
    if (!(Number(amount) > 0)) { setError('Escribe el valor que pagaste'); return; }
    if (!accountId) { setError('Selecciona una cuenta'); return; }
    if (date.slice(0, 7) !== month) {
      setError(`La fecha debe ser de ${monthLabel(month).toLowerCase()}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.registerFixed(fixed.id, {
        account_id: parseInt(accountId),
        amount: Number(amount),
        date,
      });
      onPaid();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  if (!accounts.length) return (
    <Sheet title={`Pagar ${fixed.name}`} onClose={onClose}>
      <div style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
        Primero crea una cuenta en la sección Cuentas para poder registrar el pago.
      </div>
      <button className="btn btn-ghost btn-full" onClick={onClose}>Entendido</button>
    </Sheet>
  );

  return (
    <Sheet title={`Pagar ${fixed.name}`} onClose={onClose}>
      <div className="field">
        <label>Valor pagado (COP)</label>
        <MoneyInput value={amount} onChange={setAmount} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Cuenta</label>
          <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Fecha</label>
          <input className="input" type="date" value={date}
            min={`${month}-01`} max={lastDayOf(month)}
            onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="fx-hint">
        Se guarda como gasto en Movimientos y se descuenta de la cuenta.
      </div>
      {error && <div className="field-error">⚠ {error}</div>}
      <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
        {loading ? 'Guardando...' : 'Marcar como pagado'}
      </button>
    </Sheet>
  );
}

// ── Desmarcar: elimina el movimiento y devuelve el saldo ──

function UnpaySheet({ fixed, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await api.deleteTransaction(fixed.paid_tx_id);
      onDone();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <Sheet title={`¿Desmarcar ${fixed.name}?`} onClose={onClose}>
      <div style={{ color: 'var(--text2)', fontSize: '0.9rem', lineHeight: 1.5 }}>
        Se elimina el movimiento de {fmt(fixed.paid_amount)} del {fmtDay(fixed.paid_date)}
        {fixed.paid_account_name ? ` y ese valor vuelve a ${fixed.paid_account_name}` : ''}.
      </div>
      {error && <div className="field-error">⚠ {error}</div>}
      <div className="grid-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger" onClick={submit} disabled={loading}>
          {loading ? 'Desmarcando...' : 'Sí, desmarcar'}
        </button>
      </div>
    </Sheet>
  );
}

// ── Crear / editar / eliminar un gasto fijo ──

function FixedSheet({ initial, categories, onClose, onSaved, onDeleted }) {
  const editing = !!initial;
  const [name, setName]             = useState(initial?.name || '');
  const [amount, setAmount]         = useState(initial ? String(Math.round(Number(initial.amount))) : '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ? String(initial.category_id) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const run = async (action, done) => {
    setLoading(true);
    setError('');
    try {
      await action();
      done();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const save = () => {
    if (!name.trim() || !(Number(amount) > 0)) { setError('Completa nombre y valor'); return; }
    const data = { name: name.trim(), amount: Number(amount), category_id: categoryId ? parseInt(categoryId) : null };
    run(() => editing ? api.updateFixed(initial.id, data) : api.createFixed(data), onSaved);
  };

  const remove = () => run(() => api.deleteFixed(initial.id), onDeleted);

  return (
    <Sheet title={editing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'} onClose={onClose}>
      <div className="field">
        <label>Nombre</label>
        <input className="input" placeholder="Ej: Arriendo, Netflix" value={name}
          onChange={e => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Valor habitual (COP)</label>
        <MoneyInput value={amount} onChange={setAmount} />
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

      {!confirmDelete && (
        <button className="btn btn-primary btn-full" onClick={save} disabled={loading}>
          {loading ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar gasto fijo'}
        </button>
      )}

      {editing && !confirmDelete && (
        <button className="btn btn-full fx-delete-link" onClick={() => setConfirmDelete(true)} disabled={loading}>
          Eliminar gasto fijo
        </button>
      )}

      {editing && confirmDelete && (
        <>
          <div className="fx-hint">
            Se quita de la lista. Los movimientos que ya registraste se conservan.
          </div>
          <div className="grid-2">
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={loading}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={remove} disabled={loading}>
              {loading ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ── Fila de la lista ──

function FixedRow({ item, onToggle, onEdit }) {
  const paid = !!item.paid_tx_id;
  const category = item.category_name
    ? `${item.category_icon || ''} ${item.category_name}`.trim()
    : 'Sin categoría';

  return (
    <div className={`fx-row ${paid ? 'is-paid' : ''}`}>
      <button className="fx-check" onClick={() => onToggle(item)}
        aria-pressed={paid}
        aria-label={paid ? `Desmarcar ${item.name}` : `Marcar ${item.name} como pagado`}>
        <span className="fx-check-ring">{paid && <IconCheck size={15} />}</span>
      </button>

      <button className="fx-body" onClick={() => onEdit(item)}>
        <span className="fx-name">{item.name}</span>
        <span className="fx-meta">
          {paid
            ? `Pagado el ${fmtDay(item.paid_date)}${item.paid_account_name ? ` · ${item.paid_account_name}` : ''}`
            : category}
        </span>
      </button>

      <span className="fx-amount">{fmt(paid ? item.paid_amount : item.amount)}</span>

      <button className="fx-more" onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}>
        <IconDots size={18} />
      </button>
    </div>
  );
}

// ── Página ──

export default function FixedExpensesPage() {
  const [month, setMonth]           = useState(currentMonth());
  const [items, setItems]           = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');
  const [sheet, setSheet]           = useState(null); // { type: 'pay' | 'unpay' | 'edit' | 'new', item }
  const { toasts, show } = useToast();

  const loadItems = useCallback((m, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError('');
    return api.getFixed(m)
      .then(setItems)
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadItems(month); }, [month, loadItems]);

  useEffect(() => {
    Promise.all([api.getAccounts(), api.getCategories()])
      .then(([accs, cats]) => {
        setAccounts(accs.personal || []);
        setCategories(cats);
      })
      .catch(() => {});
  }, []);

  const done = (msg) => {
    setSheet(null);
    show(msg);
    loadItems(month, { silent: true });
  };

  const pending = items.filter(i => !i.paid_tx_id);
  const paid    = items.filter(i => i.paid_tx_id);

  const pendingTotal = pending.reduce((s, i) => s + Number(i.amount), 0);
  const paidTotal    = paid.reduce((s, i) => s + Number(i.paid_amount), 0);
  const progress     = items.length ? (paid.length / items.length) * 100 : 0;
  const allPaid      = items.length > 0 && pending.length === 0;
  const isCurrent    = month === currentMonth();

  const toggle = (item) => setSheet({ type: item.paid_tx_id ? 'unpay' : 'pay', item });
  const edit   = (item) => setSheet({ type: 'edit', item });

  return (
    <>
      <ToastContainer toasts={toasts} />

      {sheet?.type === 'pay' && (
        <PaySheet fixed={sheet.item} accounts={accounts} month={month}
          onClose={() => setSheet(null)}
          onPaid={() => done(`${sheet.item.name} pagado`)} />
      )}
      {sheet?.type === 'unpay' && (
        <UnpaySheet fixed={sheet.item}
          onClose={() => setSheet(null)}
          onDone={() => done(`${sheet.item.name} desmarcado`)} />
      )}
      {(sheet?.type === 'edit' || sheet?.type === 'new') && (
        <FixedSheet initial={sheet.item} categories={categories}
          onClose={() => setSheet(null)}
          onSaved={() => done('Guardado')}
          onDeleted={() => done('Eliminado')} />
      )}

      <div className="stack">
        <div className="flex-between page-header" style={{ marginBottom: 4 }}>
          <div className="page-title">Gastos fijos</div>
          <button className="btn btn-primary btn-sm" onClick={() => setSheet({ type: 'new', item: null })}>
            + Agregar
          </button>
        </div>

        <div className="month-switch">
          <button onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Mes anterior">
            <IconChevronLeft size={18} />
          </button>
          <div className="month-switch-label">{monthLabel(month)}</div>
          <button onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={isCurrent} aria-label="Mes siguiente">
            <IconChevronRight size={18} />
          </button>
        </div>

        {loading && (
          <div className="stack">
            <div className="skeleton" style={{ height: 104 }} />
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        )}

        {!loading && loadError && (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No se pudieron cargar los gastos fijos</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 16 }}>{loadError}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => loadItems(month)}>Reintentar</button>
          </div>
        )}

        {!loading && !loadError && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Aún no tienes gastos fijos</div>
            <div style={{ fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.5 }}>
              Agrega los pagos que se repiten cada mes<br />y márcalos a medida que los vas pagando.
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setSheet({ type: 'new', item: null })}>
              + Agregar el primero
            </button>
          </div>
        )}

        {!loading && !loadError && items.length > 0 && (
          <>
            <div className="card fx-summary">
              <div className="fx-summary-label">
                {allPaid ? 'Mes al día' : 'Falta por pagar'}
              </div>
              <div className={`fx-summary-amount ${allPaid ? 'is-done' : ''}`}>
                {allPaid ? 'Todo pagado' : fmt(pendingTotal)}
              </div>
              <div className="progress-bar" style={{ margin: '14px 0 10px' }}>
                <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--green)' }} />
              </div>
              <div className="flex-between fx-summary-foot">
                <span>{paid.length} de {items.length} pagados</span>
                <span>Pagado {fmt(paidTotal)}</span>
              </div>
            </div>

            {pending.length > 0 && (
              <div>
                <div className="fx-section-label">
                  <span>Pendientes</span><span>{pending.length}</span>
                </div>
                <div className="card fx-list">
                  {pending.map(item => (
                    <FixedRow key={item.id} item={item} onToggle={toggle} onEdit={edit} />
                  ))}
                </div>
              </div>
            )}

            {paid.length > 0 && (
              <div>
                <div className="fx-section-label">
                  <span>Pagados</span><span>{paid.length}</span>
                </div>
                <div className="card fx-list">
                  {paid.map(item => (
                    <FixedRow key={item.id} item={item} onToggle={toggle} onEdit={edit} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
