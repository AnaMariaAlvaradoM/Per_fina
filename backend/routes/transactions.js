const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/transactions — personales filtradas
router.get('/', auth, async (req, res) => {
  const { account_id, category_id, type, from, to, limit = 50, offset = 0 } = req.query;
  try {
    let conditions = ['t.created_by = $1'];
    let params = [req.user.id];
    let p = 1;

    if (account_id)  { p++; conditions.push(`t.account_id = $${p}`);   params.push(account_id); }
    if (category_id) { p++; conditions.push(`t.category_id = $${p}`);  params.push(category_id); }
    if (type)        { p++; conditions.push(`t.type = $${p}`);          params.push(type); }
    if (from)        { p++; conditions.push(`t.date >= $${p}`);         params.push(from); }
    if (to)          { p++; conditions.push(`t.date <= $${p}`);         params.push(to); }

    p++; params.push(limit);
    p++; params.push(offset);

    const query = `
      SELECT t.*,
        TO_CHAR(t.date, 'YYYY-MM-DD') as date,
        c.name as category_name, c.icon as category_icon, c.color as category_color,
        a.name as account_name, a.type as account_type
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $${p - 1} OFFSET $${p}
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/summary
router.get('/summary', auth, async (req, res) => {
  const { year, month } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;

  try {
    const dateFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    const dateTo   = new Date(y, m, 0).toISOString().split('T')[0];

    const totals = await pool.query(
      `SELECT
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' OR type='debt_payment' THEN amount ELSE 0 END) as expenses,
        COUNT(*) as transaction_count
       FROM transactions
       WHERE created_by = $1 AND date BETWEEN $2 AND $3`,
      [req.user.id, dateFrom, dateTo]
    );

    const byCategory = await pool.query(
      `SELECT c.name, c.icon, c.color, t.type,
        SUM(t.amount) as total, COUNT(*) as count
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.created_by = $1
         AND t.date BETWEEN $2 AND $3
         AND t.type IN ('expense','income')
       GROUP BY c.id, c.name, c.icon, c.color, t.type
       ORDER BY total DESC`,
      [req.user.id, dateFrom, dateTo]
    );

    const monthly = await pool.query(
      `SELECT
        TO_CHAR(date, 'YYYY-MM') as month,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' OR type='debt_payment' THEN amount ELSE 0 END) as expenses
       FROM transactions
       WHERE created_by = $1 AND date >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY month`,
      [req.user.id]
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
  const { amount, type, description, date, account_id, category_id, debt_id, transfer_to_account_id, notes } = req.body;

  if (!amount || !type || !account_id)
    return res.status(400).json({ error: 'amount, type y account_id son requeridos' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO transactions (amount, type, description, date, account_id, category_id, debt_id, transfer_to_account_id, created_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [amount, type, description, date || new Date().toISOString().split('T')[0],
       account_id, category_id, debt_id, transfer_to_account_id, req.user.id, notes]
    );

    // Actualizar saldo
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

    const full = await pool.query(
      `SELECT t.*, TO_CHAR(t.date, 'YYYY-MM-DD') as date,
        c.name as category_name, c.icon as category_icon, a.name as account_name
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

// PUT /api/transactions/:id — editar y recalcular saldos
router.put('/:id', auth, async (req, res) => {
  const { amount, type, description, date, account_id, category_id, debt_id, transfer_to_account_id, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Traer transacción original
    const orig = await client.query(
      'SELECT * FROM transactions WHERE id=$1 AND created_by=$2',
      [req.params.id, req.user.id]
    );
    if (!orig.rows.length) return res.status(404).json({ error: 'Transacción no encontrada' });
    const old = orig.rows[0];

    // 1. Revertir efecto de la transacción original en los saldos
    if (old.type === 'income') {
      await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [old.amount, old.account_id]);
    } else if (old.type === 'expense' || old.type === 'debt_payment') {
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [old.amount, old.account_id]);
      if (old.debt_id) {
        await client.query('UPDATE debts SET paid_amount = paid_amount - $1 WHERE id = $2', [old.amount, old.debt_id]);
      }
    } else if (old.type === 'transfer' && old.transfer_to_account_id) {
      await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [old.amount, old.account_id]);
      await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [old.amount, old.transfer_to_account_id]);
    }

    // 2. Actualizar la transacción
    const updated = await client.query(
      `UPDATE transactions
       SET amount=$1, type=$2, description=$3, date=$4, account_id=$5,
           category_id=$6, debt_id=$7, transfer_to_account_id=$8, notes=$9
       WHERE id=$10 AND created_by=$11 RETURNING *`,
      [amount, type, description, date, account_id, category_id,
       debt_id || null, transfer_to_account_id || null, notes, req.params.id, req.user.id]
    );

    // 3. Aplicar nuevo efecto en los saldos
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

    const full = await pool.query(
      `SELECT t.*, TO_CHAR(t.date, 'YYYY-MM-DD') as date,
        c.name as category_name, c.icon as category_icon, a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts a ON a.id = t.account_id
       WHERE t.id = $1`,
      [updated.rows[0].id]
    );

    res.json(full.rows[0]);
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

    const t = await client.query(
      'SELECT * FROM transactions WHERE id=$1 AND created_by=$2',
      [req.params.id, req.user.id]
    );
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