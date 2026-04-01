import { useState, useCallback } from 'react';

// ── Toast hook ──
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  return { toasts, show };
};

export const ToastContainer = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <div key={t.id} className={`toast toast-${t.type}`}>
        {t.type === 'success' ? '✓' : '✕'} {t.msg}
      </div>
    ))}
  </div>
);

// ── Format currency ──
export const fmt = (n) => {
  const num = Number(n) || 0;
  const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.abs(num));
  return `${num < 0 ? '-' : ''}$\u00a0${formatted}`;
};

// ── Format date ──
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Relative date ──
export const fmtRelative = (d) => {
  const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return `Hace ${diff} días`;
  return fmtDate(d);
};

// ── Account icons ──
export const ACCOUNT_ICONS = {
  checking: '🏦', savings: '💰', cash: '💵',
  credit: '💳', nequi: '📱', daviplata: '📲', other: '🪙'
};

export const ACCOUNT_LABELS = {
  checking: 'Cuenta corriente', savings: 'Ahorros', cash: 'Efectivo',
  credit: 'Tarjeta crédito', nequi: 'Nequi', daviplata: 'Daviplata', other: 'Otra'
};