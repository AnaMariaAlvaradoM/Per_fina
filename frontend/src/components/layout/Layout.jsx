import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { path: '/',             icon: '⬡',  label: 'Inicio'  },
  { path: '/transactions', icon: '↕',  label: 'Movimientos' },
  { path: '/accounts',     icon: '🏦', label: 'Cuentas' },
  { path: '/debts',        icon: '💳', label: 'Deudas'  },
];

export default function Layout({ children, onAdd }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const go = (p) => navigate(p);
  const active = (p) => pathname === p ? 'active' : '';

  return (
    <div className="layout">
      {/* Sidebar - desktop */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>💸</span> FinanzApp
        </div>

        {NAV.map(n => (
          <button key={n.path} className={`sidebar-link ${active(n.path)}`} onClick={() => go(n.path)}>
            <span className="sidebar-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
          <div style={{ padding: '8px 12px', fontSize: '0.82rem', color: 'var(--text2)', fontWeight: 600 }}>
            {user?.name}
          </div>
          <button className="sidebar-link" onClick={logout} style={{ color: 'var(--red)' }}>
            <span className="sidebar-icon">⎋</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">{children}</main>

      {/* Bottom nav - mobile */}
      <nav className="bottom-nav">
        {NAV.slice(0, 2).map(n => (
          <button key={n.path} className={`bottom-nav-item ${active(n.path)}`} onClick={() => go(n.path)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}

        <button className="bottom-nav-item add-btn" onClick={onAdd}>
          <span className="nav-icon">+</span>
        </button>

        {NAV.slice(2).map(n => (
          <button key={n.path} className={`bottom-nav-item ${active(n.path)}`} onClick={() => go(n.path)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
