const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/transactions/shared — SOLO transacciones con household_id (compartidas)
router.get('/shared', auth, async (req, res) => {
  const { household_id, limit = 100 } = req.query;
  if (!household_id) return res.status(400).json({ error: 'household_id requerido' });
  try {
    const result = await pool.query(
      `SELECT t.*,
        c.name as category_name, c.icon as category_icon, c.color as category_color,
        a.name as account_name,
        u.name as created_by_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts a ON a.id = t.account_id
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.household_id = $1
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $2`,
      [household_id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions — personales + opcionalmente filtradas
router.get('/', auth, async (req, res) => {
  const { household_id, account_id, category_id, type, from, to, limit = 50, offset = 0 } = req.query;
  try {
    let conditions = [`(t.created_by = $1`];
    let params = [req.user.id];
    let paramCount = 1;

    if (household_id) {
      paramCount++;
      conditions[0] += ` OR t.household_id = $${paramCount})`;
      params.push(household_id);
    } else {
      conditions[0] += ')';
    }

    if (account_id) {
      paramCount++;
      conditions.push(`t.account_id = $${paramCount}`);
      params.push(account_id);
    }
    if (category_id) {
      paramCount++;
      conditions.push(`t.category_id = $${paramCount}`);
      params.push(category_id);
    }
    if (type) {
      paramCount++;
      conditions.push(`t.type = $${paramCount}`);
      params.push(type);
    }
    if (from) {
      paramCount++;
      conditions.push(`t.date >= $${paramCount}`);
      params.push(from);
    }
    if (to) {
      paramCount++;
      conditions.push(`t.date <= $${paramCount}`);
      params.push(to);
    }

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const query = `
      SELECT t.*,
        c.name as category_name, c.icon as category_icon, c.color as category_color,
        a.name as account_name, a.type as account_type,
        u.name as created_by_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      LEFT JOIN users u ON u.id = t.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/summary — para dashboard e IA
router.get('/summary', auth, async (req, res) => {
  const { household_id, year, month } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;

  try {
    const dateFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    const dateTo = new Date(y, m, 0).toISOString().split('T')[0];

    // Totales del mes
    const totals = await pool.query(
      `SELECT 
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' OR type='debt_payment' THEN amount ELSE 0 END) as expenses,
        COUNT(*) as transaction_count
       FROM transactions
       WHERE (created_by=$1 ${household_id ? `OR household_id=$2` : ''})
         AND date BETWEEN $${household_id ? 3 : 2} AND $${household_id ? 4 : 3}`,
      household_id
        ? [req.user.id, household_id, dateFrom, dateTo]
        : [req.user.id, dateFrom, dateTo]
    );

    // Por categoría
    const byCategory = await pool.query(
      `SELECT c.name, c.icon, c.color, t.type,
        SUM(t.amount) as total, COUNT(*) as count
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE (t.created_by=$1 ${household_id ? `OR t.household_id=$2` : ''})
         AND t.date BETWEEN $${household_id ? 3 : 2} AND $${household_id ? 4 : 3}
         AND t.type IN ('expense','income')
       GROUP BY c.id, c.name, c.icon, c.color, t.type
       ORDER BY total DESC`,
      household_id
        ? [req.user.id, household_id, dateFrom, dateTo]
        : [req.user.id, dateFrom, dateTo]
    );

    // Últimos 6 meses
    const monthly = await pool.query(
      `SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' OR type='debt_payment' THEN amount ELSE 0 END) as expenses
       FROM transactions
       WHERE (created_by=$1 ${household_id ? `OR household_id=$2` : ''})
         AND date >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY month`,
      household_id ? [req.user.id, household_id] : [req.user.id]
    );

    res.json({
      period: { year: y, month: m, from: dateFrom, to: dateTo },
      totals: totals.rows[0],
      byCategory: byCategory.rows,
      monthly: monthly.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
router.post('/', auth, async (req, res) => {
  const { amount, type, description, date, account_id, category_id, debt_id, transfer_to_account_id, household_id, notes } = req.body;

  if (!amount || !type || !account_id)
    return res.status(400).json({ error: 'amount, type y account_id son requeridos' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO transactions (amount, type, description, date, account_id, category_id, debt_id, transfer_to_account_id, created_by, household_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [amount, type, description, date || new Date(), account_id, category_id, debt_id, transfer_to_account_id, req.user.id, household_id, notes]
    );

    // Actualizar saldo de cuenta
    if (type === 'income') {
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, account_id]);
    } else if (type === 'expense' || type === 'debt_payment') {
      await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, account_id]);
      if (debt_id && type === 'debt_payment') {
        await client.query('UPDATE debts SET paid_amount = paid_amount + $1 WHERE id = $2', [amount, debt_id]);
      }
    } else if (type === 'transfer' && transfer_to_account_id) {
      await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, account_id]);
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, transfer_to_account_id]);
    }

    await client.query('COMMIT');

    // Retornar con joins
    const full = await pool.query(
      `SELECT t.*, c.name as category_name, c.icon as category_icon, a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts a ON a.id = t.account_id
       WHERE t.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const t = await client.query('SELECT * FROM transactions WHERE id=$1 AND created_by=$2', [req.params.id, req.user.id]);
    if (!t.rows.length) return res.status(404).json({ error: 'Transacción no encontrada' });

    const tx = t.rows[0];

    // Revertir saldo
    if (tx.type === 'income') {
      await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [tx.amount, tx.account_id]);
    } else if (tx.type === 'expense' || tx.type === 'debt_payment') {
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [tx.amount, tx.account_id]);
      if (tx.debt_id) {
        await client.query('UPDATE debts SET paid_amount = paid_amount - $1 WHERE id = $2', [tx.amount, tx.debt_id]);
      }
    } else if (tx.type === 'transfer' && tx.transfer_to_account_id) {
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [tx.amount, tx.account_id]);
      await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [tx.amount, tx.transfer_to_account_id]);
    }

    await client.query('DELETE FROM transactions WHERE id=$1', [req.params.id]);
    await client.query('COMMIT');

    res.json({ message: 'Transacción eliminada y saldo revertido' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;