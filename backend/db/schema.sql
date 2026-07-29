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

-- Índice único parcial: impide que las categorías default se dupliquen
-- (necesario para que el ON CONFLICT del seed funcione, ya que owner_id es NULL)
CREATE UNIQUE INDEX IF NOT EXISTS categories_default_unique
  ON categories (name, type)
  WHERE is_default = true;

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
ON CONFLICT (name, type) WHERE is_default = true DO NOTHING;

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

-- ============================================
-- GASTOS FIJOS
-- (tabla que ya existía en la base de datos de producción
--  pero faltaba en este schema.sql — se agrega en modo idempotente)
-- ============================================
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_owner ON fixed_expenses(owner_id);

-- Vínculo transacción → gasto fijo que la originó (para saber qué fijos
-- ya se pagaron este mes y calcular el flujo de caja proyectado)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fixed_expense_id INTEGER REFERENCES fixed_expenses(id);

-- ============================================
-- PRESUPUESTO
-- ============================================

-- Grupo al que pertenece cada categoría, para el módulo de presupuesto:
-- 'basicos' | 'deudas' | 'trabajo' | 'ahorro' | 'personales' (NULL para categorías de ingreso)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_key VARCHAR(20);

-- Mapeo de categorías default existentes a su grupo (no borra ni crea, solo clasifica)
UPDATE categories SET group_key = 'basicos'    WHERE is_default = true AND name IN ('Comida','Transporte','Servicios','Salud','Educación','Mascota','Hogar');
UPDATE categories SET group_key = 'deudas'     WHERE is_default = true AND name = 'Deuda';
UPDATE categories SET group_key = 'ahorro'     WHERE is_default = true AND name = 'Ahorro';
UPDATE categories SET group_key = 'personales' WHERE is_default = true AND name IN ('Ropa','Entretenimiento','Otros gastos');

-- Categorías nuevas recomendadas, agrupadas (se agregan sin tocar las existentes)
INSERT INTO categories (name, icon, color, type, is_default, group_key) VALUES
  -- 🏠 Básicos
  ('Arriendo',            '🏘️', '#3b82f6', 'expense', true, 'basicos'),
  ('Mercado',             '🛒', '#f97316', 'expense', true, 'basicos'),
  ('Internet',            '📶', '#0ea5e9', 'expense', true, 'basicos'),
  ('Celular',             '📱', '#0ea5e9', 'expense', true, 'basicos'),
  ('Gasolina',            '⛽', '#eab308', 'expense', true, 'basicos'),
  ('Seguros',             '🛡️', '#64748b', 'expense', true, 'basicos'),
  -- 💳 Deudas
  ('Tarjeta de crédito',  '💳', '#ef4444', 'expense', true, 'deudas'),
  ('RappiCard',           '🛵', '#f97316', 'expense', true, 'deudas'),
  ('ADDI',                '🏷️', '#ef4444', 'expense', true, 'deudas'),
  ('Nequi (crédito)',     '🟣', '#a855f7', 'expense', true, 'deudas'),
  ('Caja Social',         '🏦', '#ef4444', 'expense', true, 'deudas'),
  ('Crédito vehículo',    '🚗', '#ef4444', 'expense', true, 'deudas'),
  ('Otros préstamos',     '🧾', '#ef4444', 'expense', true, 'deudas'),
  -- 💼 Trabajo
  ('ChatGPT',             '🤖', '#8b5cf6', 'expense', true, 'trabajo'),
  ('Claude',              '✨', '#8b5cf6', 'expense', true, 'trabajo'),
  ('Software',            '🧩', '#7c3aed', 'expense', true, 'trabajo'),
  ('Dominio',             '🌐', '#7c3aed', 'expense', true, 'trabajo'),
  ('Hosting',             '🖥️', '#7c3aed', 'expense', true, 'trabajo'),
  ('Cursos',              '🎓', '#8b5cf6', 'expense', true, 'trabajo'),
  -- 🎯 Ahorro e inversión
  ('Fondo de emergencia', '🆘', '#10b981', 'expense', true, 'ahorro'),
  ('Ahorro vehículo',     '🚙', '#10b981', 'expense', true, 'ahorro'),
  ('Ahorro vivienda',     '🏡', '#10b981', 'expense', true, 'ahorro'),
  ('Inversiones',         '📈', '#059669', 'expense', true, 'ahorro'),
  ('Cesantías',           '🧾', '#059669', 'expense', true, 'ahorro'),
  -- 🎉 Gastos personales
  ('Restaurantes',        '🍽️', '#ec4899', 'expense', true, 'personales'),
  ('Salidas',              '🎉', '#ec4899', 'expense', true, 'personales'),
  ('Compras personales',  '🛍️', '#db2777', 'expense', true, 'personales'),
  ('Streaming',            '📺', '#06b6d4', 'expense', true, 'personales'),
  ('Regalos',              '🎁', '#db2777', 'expense', true, 'personales'),
  ('Viajes',                '✈️', '#06b6d4', 'expense', true, 'personales')
ON CONFLICT (name, type) WHERE is_default = true DO NOTHING;

-- Presupuesto mensual (un registro por usuario por mes, siempre día 1)
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) NOT NULL,
  month DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(owner_id, month)
);

-- Monto asignado por categoría dentro de un presupuesto mensual
CREATE TABLE IF NOT EXISTS budget_items (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  amount_assigned DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(budget_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_owner_month ON budgets(owner_id, month);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id);