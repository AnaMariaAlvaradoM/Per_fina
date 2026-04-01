import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import TransactionsPage from './pages/TransactionsPage';
import AccountsPage from './pages/AccountsPage';
import DebtsPage from './pages/DebtsPage';
import HogarPage from './pages/HogarPage';
import AddTransactionModal from './components/ui/AddTransactionModal';
import { ToastContainer, useToast } from './components/ui/helpers.jsx';

function ProtectedApp() {
  const { user, loading } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toasts, show } = useToast();

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💸</div>
        <div style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Cargando...</div>
      </div>
    </div>
  );

  if (!user) return <AuthPage />;

  const refresh = () => {
    setRefreshKey(k => k + 1);
    show('Guardado ✓');
  };

  return (
    <>
      <Layout onAdd={() => setShowAdd(true)}>
        <Routes>
          <Route path="/"             element={<Dashboard      key={refreshKey} onAdd={() => setShowAdd(true)} />} />
          <Route path="/transactions" element={<TransactionsPage key={refreshKey} onAdd={() => setShowAdd(true)} />} />
          <Route path="/accounts"     element={<AccountsPage  key={refreshKey} />} />
          <Route path="/debts"        element={<DebtsPage      key={refreshKey} onAdd={() => setShowAdd(true)} />} />
          <Route path="/hogar"        element={<HogarPage      key={refreshKey} onAdd={() => setShowAdd(true)} />} />
          <Route path="*"             element={<Navigate to="/" />} />
        </Routes>
      </Layout>

      {showAdd && (
        <AddTransactionModal
          onClose={() => setShowAdd(false)}
          onSaved={refresh}
        />
      )}

      <ToastContainer toasts={toasts} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}