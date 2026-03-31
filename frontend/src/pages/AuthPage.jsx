import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name) { setError('Ingresa tu nombre'); setLoading(false); return; }
        await register(name, email, password);
      }
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: 'radial-gradient(ellipse at 60% 20%, #1e1b4b 0%, var(--bg) 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>💸</div>
          <h1 style={{ fontSize: '1.6rem' }}>FinanzApp</h1>
          <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginTop: 4 }}>
            Controla tus finanzas, sin estrés
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg3)',
          borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 24 }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '9px', border: 'none', borderRadius: 'calc(var(--radius-sm) - 2px)',
                background: mode === m ? 'var(--bg2)' : 'transparent',
                color: mode === m ? 'var(--text)' : 'var(--text2)',
                fontFamily: 'var(--font)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
              {m === 'login' ? 'Iniciar sesión' : 'Registrarme'}
            </button>
          ))}
        </div>

        <div className="stack">
          {mode === 'register' && (
            <div className="field">
              <label>Nombre</label>
              <input className="input" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <input className="input" type="email" placeholder="tu@email.com" value={email}
              onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input className="input" type="password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {error && (
            <div style={{ background: 'var(--red-dim)', color: 'var(--red)',
              padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              ⚠ {error}
            </div>
          )}

          <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}
            style={{ padding: '13px', fontSize: '0.95rem' }}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}
