-- ============================================
-- FINANCE APP - Schema PostgreSQL
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

-- Hogares / espacios compartidos
CREATE TABLE IF NOT EXISTS households (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'Mi Hogar',
  created_by INTEGER REFERENCES users(id),
  invite_code VARCHAR(10) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Miembros del hogar
CREATE TABLE IF NOT EXISTS household_members (
  id SERIAL PRIMARY KEY,
  household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'owner' | 'member'
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Cuentas (personal o compartida)
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL, -- 'checking', 'savings', 'cash', 'credit', 'nequi', 'daviplata', 'other'
  balance DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'COP',
  color VARCHAR(7) DEFAULT '#6366f1',
  icon VARCHAR(10) DEFAULT '🏦',
  owner_id INTEGER REFERENCES users(id),         -- NULL si es compartida
  household_id INTEGER REFERENCES households(id), -- NULL si es personal
  is_shared BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT owner_or_household CHECK (
    (owner_id IS NOT NULL AND household_id IS NULL) OR
    (owner_id IS NULL AND household_id IS NOT NULL)
  )
);

-- Categorías
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  type VARCHAR(10) NOT NULL, -- 'expense' | 'income' | 'both'
  is_default BOOLEAN DEFAULT FALSE,
  owner_id INTEGER REFERENCES users(id),         -- NULL si es global/default
  household_id INTEGER REFERENCES households(id), -- NULL si no es del hogar
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categorías por defecto
INSERT INTO categories (name, icon, color, type, is_default) VALUES
  ('Comida', '🍔', '#f97316', 'expense', true),
  ('Transporte', '🚌', '#3b82f6', 'expense', true),
  ('Servicios', '💡', '#eab308', 'expense', true),
  ('Salud', '🏥', '#ef4444', 'expense', true),
  ('Educación', '📚', '#8b5cf6', 'expense', true),
  ('Ropa', '👗', '#ec4899', 'expense', true),
  ('Entretenimiento', '🎮', '#06b6d4', 'expense', true),
  ('Mascota', '🐾', '#84cc16', 'expense', true),
  ('Hogar', '🏠', '#f59e0b', 'expense', true),
  ('Ahorro', '💰', '#10b981', 'both', true),
  ('Sueldo', '💼', '#10b981', 'income', true),
  ('Freelance', '💻', '#6366f1', 'income', true),
  ('Otros ingresos', '➕', '#14b8a6', 'income', true),
  ('Deuda', '💳', '#ef4444', 'expense', true),
  ('Otros gastos', '📦', '#94a3b8', 'expense', true)
ON CONFLICT DO NOTHING;

-- Deudas
CREATE TABLE IF NOT EXISTS debts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  total_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  direction VARCHAR(10) NOT NULL, -- 'owe' (yo debo) | 'owed' (me deben)
  counterpart VARCHAR(100),       -- a quién le debo o quién me debe
  due_date DATE,
  interest_rate DECIMAL(5,2),
  owner_id INTEGER REFERENCES users(id),
  household_id INTEGER REFERENCES households(id),
  is_shared BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transacciones
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(15,2) NOT NULL,
  type VARCHAR(20) NOT NULL,       -- 'income' | 'expense' | 'transfer' | 'debt_payment'
  description VARCHAR(255),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id INTEGER REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  debt_id INTEGER REFERENCES debts(id),            -- si es pago de deuda
  transfer_to_account_id INTEGER REFERENCES accounts(id), -- si es transferencia
  created_by INTEGER REFERENCES users(id),
  household_id INTEGER REFERENCES households(id),  -- NULL si es personal
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_debts_owner ON debts(owner_id);
