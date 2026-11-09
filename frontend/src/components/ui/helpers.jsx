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

// ── Fechas ──
// Las fechas llegan del backend como 'YYYY-MM-DD' y se leen en hora local.
// new Date('2026-11-09') las tomaría como UTC y en Colombia mostraría el día anterior.
export const parseDate = (d) => {
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day);
};

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' de hoy según el reloj del dispositivo
export const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};

export const fmtDate = (d) =>
  parseDate(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

// Fecha corta sin año: "9 nov"
export const fmtDay = (d) =>
  parseDate(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');

// ── Relative date ──
export const fmtRelative = (d) => {
  const diff = Math.round((parseDate(todayStr()) - parseDate(d)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) return `Hace ${diff} días`;
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