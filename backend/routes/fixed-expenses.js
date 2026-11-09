const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const { today, currentMonth, isValidMonth, monthBounds } = require('../utils/dates');
const router = express.Router();

// GET /api/fixed-expenses?month=YYYY-MM
// Lista los gastos fijos y, para el mes pedido, el movimiento con el que se pagó cada uno.
// Un fijo está "pagado" en un mes si existe un movimiento de ese mes vinculado a él.
router.get('/', auth, async (req, res) => {
  const month = isValidMonth(req.query.month) ? req.query.month : currentMonth();
  const { start, end } = monthBounds(month);
  try {
    const result = await pool.query(
      `SELECT f.id, f.name, f.amount, f.category_id, f.created_at,
              c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
              p.id AS paid_tx_id, p.amount AS paid_amount, p.date AS paid_date,
              p.account_name AS paid_account_name
       FROM fixed_expenses f
       LEFT JOIN categories c ON c.id = f.category_id
       LEFT JOIN LATERAL (
         SELECT t.id, t.amount, TO_CHAR(t.date, 'YYYY-MM-DD') AS date, a.name AS account_name
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
         WHERE t.fixed_expense_id = f.id
           AND t.created_by = $1
           AND t.date BETWEEN $2 AND $3
         ORDER BY t.date DESC, t.id DESC
         LIMIT 1
       ) p ON true
       WHERE f.owner_id = $1
       ORDER BY f.created_at ASC, f.id ASC`,
      [req.user.id, start, end]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fixed-expenses
router.post('/', auth, async (req, res) => {
  const { name, amount, category_id } = req.body;
  if (!name?.trim() || !(Number(amount) > 0))
    return res.status(400).json({ error: 'Nombre y valor son requeridos' });
  try {
    const result = await pool.query(
      `INSERT INTO fixed_expenses (name, amount, category_id, owner_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), amount, category_id || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fixed-expenses/:id — cambia el valor habitual; los pagos ya hechos no se tocan
router.put('/:id', auth, async (req, res) => {
  const { name, amount, category_id } = req.body;
  if (!name?.trim() || !(Number(amount) > 0))
    return res.status(400).json({ error: 'Nombre y valor son requeridos' });
  try {
    const result = await pool.query(
      `UPDATE fixed_expenses SET name=$1, amount=$2, category_id=$3
       WHERE id=$4 AND owner_id=$5 RETURNING *`,
      [name.trim(), amount, category_id || null, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fixed-expenses/:id
// Los movimientos ya registrados se conservan: solo se les quita el vínculo con el fijo.
router.delete('/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fe = await client.query(
      'SELECT id FROM fixed_expenses WHERE id=$1 AND owner_id=$2',
      [req.params.id, req.user.id]
    );
    if (!fe.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrado' });
    }

    await client.query(
      'UPDATE transactions SET fixed_expense_id = NULL WHERE fixed_expense_id=$1',
      [req.params.id]
    );
    await client.query('DELETE FROM fixed_expenses WHERE id=$1', [req.params.id]);

    await client.query('COMMIT');
    res.json({ message: 'Eliminado' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/fixed-expenses/:id/register — marca el fijo como pagado creando el gasto real
router.post('/:id/register', auth, async (req, res) => {
  const { account_id, amount, date } = req.body;
  if (!account_id) return res.status(400).json({ error: 'Selecciona una cuenta' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fe = await client.query(
      'SELECT * FROM fixed_expenses WHERE id=$1 AND owner_id=$2',
      [req.params.id, req.user.id]
    );
    const acc = await client.query(
      'SELECT id FROM accounts WHERE id=$1 AND owner_id=$2 AND is_active = true',
      [account_id, req.user.id]
    );
    if (!fe.rows.length || !acc.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: fe.rows.length ? 'Cuenta no encontrada' : 'Gasto fijo no encontrado'
      });
    }
    const fixed = fe.rows[0];

    const finalAmount = Number(amount) > 0 ? amount : fixed.amount;
    const finalDate   = date || today();

    const tx = await client.query(
      `INSERT INTO transactions (amount, type, description, date, account_id, category_id, created_by, fixed_expense_id)
       VALUES ($1, 'expense', $2, $3, $4, $5, $6, $7)
       RETURNING id, amount, TO_CHAR(date, 'YYYY-MM-DD') AS date`,
      [finalAmount, fixed.name, finalDate, account_id, fixed.category_id, req.user.id, fixed.id]
    );

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [finalAmount, account_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Pago registrado', transaction: tx.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
