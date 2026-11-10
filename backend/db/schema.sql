-- ============================================
-- FINANZAPP - Schema PostgreSQL
-- Se ejecuta en cada arranque del servidor: todo debe ser idempotente.
-- ============================================

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cuentas
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL, -- 'checking', 'savings', 'cash', 'credit', 'nequi', 'daviplata', 'other'
  balance DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'COP',
  color VARCHAR(7) DEFAULT '#6366f1',
  icon VARCHAR(10) DEFAULT '🏦',
  owner_id INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categorías
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  type VARCHAR(10) NOT NULL, -- 'expense' | 'income' | 'both'
  is_default BOOLEAN DEFAULT FALSE,
  owner_id INTEGER REFERENCES users(id), -- NULL si es global/default
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice único parcial: impide que las categorías default se dupliquen
-- (necesario para que el ON CONFLICT del seed funcione, ya que owner_id es NULL)
CREATE UNIQUE INDEX IF NOT EXISTS categories_default_unique
  ON categories (name, type)
  WHERE is_default = true;

-- Categorías por defecto
INSERT INTO categories (name, icon, color, type, is_default) VALUES
  -- Gastos del día a día
  ('Mercado',             '🛒', '#f97316', 'expense', true),
  ('Restaurantes',        '🍽️', '#ec4899', 'expense', true),
  ('Salidas',             '🎉', '#db2777', 'expense', true),
  ('Gasolina',            '⛽', '#eab308', 'expense', true),
  ('Perritas',            '🐾', '#84cc16', 'expense', true),
  ('Extras',              '📦', '#94a3b8', 'expense', true),
  -- Pagos del mes
  ('Arriendo',            '🏘️', '#3b82f6', 'expense', true),
  ('Servicios',           '💡', '#f59e0b', 'expense', true),
  ('Internet',            '📶', '#0ea5e9', 'expense', true),
  ('Plan celular',        '📱', '#06b6d4', 'expense', true),
  ('Salud',               '🏥', '#ef4444', 'expense', true),
  ('Seguro carro',        '🚗', '#64748b', 'expense', true),
  ('Educación',           '📚', '#8b5cf6', 'expense', true),
  -- Tarjetas y créditos (se registra el pago mensual)
  ('Tarjeta Bancolombia', '💳', '#f43f5e', 'expense', true),
  ('Tarjeta Rappi',       '🛵', '#fb923c', 'expense', true),
  ('Tarjeta Nu',          '💜', '#a855f7', 'expense', true),
  ('Crédito Nequi',       '🟣', '#7c3aed', 'expense', true),
  ('Crédito ADDI',        '🏷️', '#e11d48', 'expense', true),
  ('Otros créditos',      '🧾', '#9f1239', 'expense', true),
  -- Ahorro e ingresos
  ('Ahorro',              '💰', '#10b981', 'both',    true),
  ('Sueldo',              '💼', '#10b981', 'income',  true),
  ('Freelance',           '💻', '#6366f1', 'income',  true),
  ('Otros ingresos',      '➕', '#14b8a6', 'income',  true)
ON CONFLICT (name, type) WHERE is_default = true DO NOTHING;

-- Transacciones
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(15,2) NOT NULL,
  type VARCHAR(20) NOT NULL,       -- 'income' | 'expense' | 'transfer'
  description VARCHAR(255),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id INTEGER REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  transfer_to_account_id INTEGER REFERENCES accounts(id), -- si es transferencia
  created_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(created_by);

-- Gastos fijos
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_owner ON fixed_expenses(owner_id);

-- Vínculo transacción → gasto fijo que la originó
-- (permite saber qué fijos ya se pagaron en un mes)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fixed_expense_id INTEGER REFERENCES fixed_expenses(id);
