import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IconHome, IconSwap, IconWallet, IconCalendarCheck } from '../ui/icons.jsx';

const NAV = [
  { path: '/',             Icon: IconHome,          label: 'Inicio' },
  { path: '/transactions', Icon: IconSwap,          label: 'Movimientos' },
  { path: '/accounts',     Icon: IconWallet,        label: 'Cuentas' },
  { path: '/fixed',        Icon: IconCalendarCheck, label: 'Fijos' },
];

// En el celular el botón "+" va en el centro (null marca su posición)
const NAV_MOBILE = [NAV[0], NAV[1], null, NAV[2], NAV[3]];

export default function Layout({ children, onAdd }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const active = (p) => pathname === p ? 'active' : '';

  return (
    <div className="layout">
      {/* Sidebar - desktop */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>💸</span> FinanzApp
        </div>

        {NAV.map(n => (
          <button key={n.path} className={`sidebar-link ${active(n.path)}`}
            onClick={() => navigate(n.path)}>
            <span className="sidebar-icon"><n.Icon size={20} /></span>
            {n.label}
          </button>
        ))}

        <button className="btn btn-primary" onClick={onAdd} style={{ margin: '16px 8px 0' }}>
          + Agregar
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
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
        {NAV_MOBILE.map((n, i) =>
          n === null ? (
            <button key="add" className="bottom-nav-item add-btn" onClick={onAdd}>
              <span className="nav-icon">+</span>
            </button>
          ) : (
            <button key={n.path} className={`bottom-nav-item ${active(n.path)}`}
              onClick={() => navigate(n.path)}>
              <span className="nav-icon"><n.Icon size={23} /></span>
              {n.label}
            </button>
          )
        )}
      </nav>
    </div>
  );
}