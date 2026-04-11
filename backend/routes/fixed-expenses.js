const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/fixed-expenses
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM fixed_expenses f
       LEFT JOIN categories c ON c.id = f.category_id
       WHERE f.owner_id = $1
       ORDER BY f.created_at ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fixed-expenses
router.post('/', auth, async (req, res) => {
  const { name, amount, category_id } = req.body;
  if (!name || !amount) return res.status(400).json({ error: 'name y amount son requeridos' });
  try {
    const result = await pool.query(
      `INSERT INTO fixed_expenses (name, amount, category_id, owner_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, amount, category_id || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fixed-expenses/:id
router.put('/:id', auth, async (req, res) => {
  const { name, amount, category_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE fixed_expenses SET name=$1, amount=$2, category_id=$3
       WHERE id=$4 AND owner_id=$5 RETURNING *`,
      [name, amount, category_id || null, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fixed-expenses/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM fixed_expenses WHERE id=$1 AND owner_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fixed-expenses/:id/register — crea la transacción real
router.post('/:id/register', auth, async (req, res) => {
  const { account_id, amount, date } = req.body;
  if (!account_id) return res.status(400).json({ error: 'account_id requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fe = await client.query(
      'SELECT * FROM fixed_expenses WHERE id=$1 AND owner_id=$2',
      [req.params.id, req.user.id]
    );
    if (!fe.rows.length) return res.status(404).json({ error: 'Gasto fijo no encontrado' });
    const fixed = fe.rows[0];

    const finalAmount = amount || fixed.amount;
    const finalDate   = date || new Date().toISOString().split('T')[0];

    await client.query(
      `INSERT INTO transactions (amount, type, description, date, account_id, category_id, created_by)
       VALUES ($1, 'expense', $2, $3, $4, $5, $6)`,
      [finalAmount, fixed.name, finalDate, account_id, fixed.category_id, req.user.id]
    );

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [finalAmount, account_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Transacción registrada' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;