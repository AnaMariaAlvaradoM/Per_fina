const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// ── Helpers ──

const isValidMonth = (month) => /^\d{4}-\d{2}$/.test(month);

const monthBounds = (month) => {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(y, m, 0).toISOString().split('T')[0]; // último día del mes
  return { start, end };
};

const prevMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Busca el presupuesto del mes; si no existe lo crea y clona los montos
// asignados del mes anterior (si el usuario tenía uno)
const getOrCreateBudget = async (ownerId, month) => {
  const existing = await pool.query(
    'SELECT * FROM budgets WHERE owner_id=$1 AND month=$2',
    [ownerId, `${month}-01`]
  );
  if (existing.rows.length) return existing.rows[0];

  const created = await pool.query(
    'INSERT INTO budgets (owner_id, month) VALUES ($1,$2) RETURNING *',
    [ownerId, `${month}-01`]
  );
  const budget = created.rows[0];

  const prev = await pool.query(
    'SELECT * FROM budgets WHERE owner_id=$1 AND month=$2',
    [ownerId, `${prevMonth(month)}-01`]
  );
  if (prev.rows.length) {
    const prevItems = await pool.query(
      'SELECT category_id, amount_assigned FROM budget_items WHERE budget_id=$1',
      [prev.rows[0].id]
    );
    for (const item of prevItems.rows) {
      await pool.query(
        `INSERT INTO budget_items (budget_id, category_id, amount_assigned)
         VALUES ($1,$2,$3) ON CONFLICT (budget_id, category_id) DO NOTHING`,
        [budget.id, item.category_id, item.amount_assigned]
      );
    }
  }

  return budget;
};

// Gasto real por categoría en un rango de fechas
const getRealByCategory = async (ownerId, start, end) => {
  const result = await pool.query(
    `SELECT category_id, SUM(amount) as real
     FROM transactions
     WHERE created_by=$1 AND type = 'expense'
       AND date BETWEEN $2 AND $3
     GROUP BY category_id`,
    [ownerId, start, end]
  );
  const map = {};
  result.rows.forEach(r => { map[r.category_id] = Number(r.real); });
  return map;
};

const sumGroup = (rows, key, field) =>
  rows.filter(c => c.group_key === key).reduce((s, c) => s + c[field], 0);

// GET /api/budgets/:month — presupuesto + gasto real por categoría
router.get('/:month', auth, async (req, res) => {
  const { month } = req.params;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Formato de mes inválido, usa YYYY-MM' });

  try {
    const budget = await getOrCreateBudget(req.user.id, month);
    const { start, end } = monthBounds(month);

    const categories = await pool.query(
      `SELECT * FROM categories
       WHERE (is_default = true OR owner_id = $1) AND type != 'income'
       ORDER BY group_key NULLS LAST, name ASC`,
      [req.user.id]
    );

    const items = await pool.query(
      'SELECT category_id, amount_assigned FROM budget_items WHERE budget_id=$1',
      [budget.id]
    );
    const assigned = {};
    items.rows.forEach(i => { assigned[i.category_id] = Number(i.amount_assigned); });

    const real = await getRealByCategory(req.user.id, start, end);

    const result = categories.rows.map(c => {
      const presupuesto = assigned[c.id] || 0;
      const gastado = real[c.id] || 0;
      const disponible = presupuesto - gastado;
      const pct = presupuesto > 0 ? Math.round((gastado / presupuesto) * 100) : (gastado > 0 ? 100 : 0);
      return {
        category_id: c.id, name: c.name, icon: c.icon, color: c.color, group_key: c.group_key,
        presupuesto, gastado, disponible, pct
      };
    });

    res.json({ month, budget_id: budget.id, categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/budgets/:month/items/:categoryId — asigna/actualiza el monto de una categoría
router.put('/:month/items/:categoryId', auth, async (req, res) => {
  const { month, categoryId } = req.params;
  const { amount } = req.body;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Formato de mes inválido, usa YYYY-MM' });
  if (amount === undefined || isNaN(Number(amount)) || Number(amount) < 0) {
    return res.status(400).json({ error: 'amount inválido' });
  }

  try {
    const budget = await getOrCreateBudget(req.user.id, month);
    const result = await pool.query(
      `INSERT INTO budget_items (budget_id, category_id, amount_assigned)
       VALUES ($1,$2,$3)
       ON CONFLICT (budget_id, category_id)
       DO UPDATE SET amount_assigned = EXCLUDED.amount_assigned
       RETURNING *`,
      [budget.id, categoryId, amount]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets/:month/reset — vacía todos los montos asignados del mes
router.post('/:month/reset', auth, async (req, res) => {
  const { month } = req.params;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Formato de mes inválido, usa YYYY-MM' });

  try {
    const budget = await getOrCreateBudget(req.user.id, month);
    await pool.query('DELETE FROM budget_items WHERE budget_id=$1', [budget.id]);
    res.json({ message: 'Presupuesto vaciado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budgets/:month/summary — dashboard, desviaciones, 50-30-20, flujo de caja, alertas
router.get('/:month/summary', auth, async (req, res) => {
  const { month } = req.params;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Formato de mes inválido, usa YYYY-MM' });

  try {
    const budget = await getOrCreateBudget(req.user.id, month);
    const { start, end } = monthBounds(month);

    const totals = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as ingresos,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as gastos
       FROM transactions
       WHERE created_by=$1 AND date BETWEEN $2 AND $3`,
      [req.user.id, start, end]
    );
    const ingresos = Number(totals.rows[0].ingresos);
    const gastos = Number(totals.rows[0].gastos);

    const categories = await pool.query(
      `SELECT * FROM categories WHERE (is_default = true OR owner_id = $1) AND type != 'income'`,
      [req.user.id]
    );
    const items = await pool.query(
      'SELECT category_id, amount_assigned FROM budget_items WHERE budget_id=$1',
      [budget.id]
    );
    const assigned = {};
    items.rows.forEach(i => { assigned[i.category_id] = Number(i.amount_assigned); });
    const real = await getRealByCategory(req.user.id, start, end);

    const categoryRows = categories.rows.map(c => {
      const presupuesto = assigned[c.id] || 0;
      const gastado = real[c.id] || 0;
      return {
        category_id: c.id, name: c.name, icon: c.icon, group_key: c.group_key,
        presupuesto, gastado, diferencia: presupuesto - gastado
      };
    });

    // Desviaciones: categorías con presupuesto o gasto, ordenadas de mayor a menor desviación
    const desviaciones = categoryRows
      .filter(c => c.presupuesto > 0 || c.gastado > 0)
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

    // Regla 50-30-20 (solo básicos / personales / ahorro, tal como se pidió)
    const plan503020 = {
      basicos: sumGroup(categoryRows, 'basicos', 'presupuesto'),
      personales: sumGroup(categoryRows, 'personales', 'presupuesto'),
      ahorro: sumGroup(categoryRows, 'ahorro', 'presupuesto'),
    };
    const real503020 = {
      basicos: sumGroup(categoryRows, 'basicos', 'gastado'),
      personales: sumGroup(categoryRows, 'personales', 'gastado'),
      ahorro: sumGroup(categoryRows, 'ahorro', 'gastado'),
    };

    // Saldo actual (cuentas personales activas)
    const accounts = await pool.query(
      `SELECT a.id,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'income' THEN t.amount
            WHEN t.type = 'expense' THEN -t.amount
            WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
            WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
            ELSE 0
          END
        ), 0) AS balance
       FROM accounts a
       LEFT JOIN transactions t ON (t.account_id = a.id OR t.transfer_to_account_id = a.id)
       WHERE a.owner_id = $1 AND a.is_active = true
       GROUP BY a.id`,
      [req.user.id]
    );
    const saldoActual = accounts.rows.reduce((s, a) => s + Number(a.balance), 0);

    // Gastos fijos que aún no se han registrado este mes → pagos pendientes
    const fixed = await pool.query(
      `SELECT f.id, f.name, f.amount
       FROM fixed_expenses f
       WHERE f.owner_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM transactions t
           WHERE t.fixed_expense_id = f.id AND t.date BETWEEN $2 AND $3
         )`,
      [req.user.id, start, end]
    );
    const pagosPendientes = fixed.rows.reduce((s, f) => s + Number(f.amount), 0);

    // Ahorro real del mes = lo movido a categorías del grupo "ahorro"
    const ahorroMes = sumGroup(categoryRows, 'ahorro', 'gastado');

    // ── Alertas ──
    const alerts = [];

    categoryRows.forEach(c => {
      if (c.presupuesto > 0) {
        const pct = (c.gastado / c.presupuesto) * 100;
        if (pct >= 100) {
          alerts.push({ type: 'danger', message: `${c.name} superó el presupuesto (${Math.round(pct)}%)` });
        } else if (pct >= 80) {
          alerts.push({ type: 'warning', message: `${c.name} va en el ${Math.round(pct)}% del presupuesto` });
        }
      }
    });

    const today = new Date();

    // Solo se evalúa cerca del fin de mes (últimos 3 días)
    const lastDayOfMonth = new Date(end).getDate();
    const metaAhorro = plan503020.ahorro;
    if (today.getDate() >= lastDayOfMonth - 3 && metaAhorro > 0 && ahorroMes < metaAhorro) {
      alerts.push({
        type: 'warning',
        message: `El mes va a cerrar con un ahorro menor a tu meta (${Math.round(ahorroMes)} de ${Math.round(metaAhorro)})`
      });
    }

    res.json({
      month,
      cards: {
        ingresos, gastos, ahorro_mes: ahorroMes,
        disponible: saldoActual,
        pagos_pendientes: pagosPendientes
      },
      desviaciones,
      regla_50_30_20: { plan: plan503020, real: real503020, ingresos },
      flujo_de_caja: {
        saldo_actual: saldoActual,
        pagos_pendientes: pagosPendientes,
        disponible_real: saldoActual - pagosPendientes
      },
      alerts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
