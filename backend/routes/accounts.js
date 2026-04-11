const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/accounts — solo cuentas personales, balance calculado desde transacciones
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'income' THEN t.amount
            WHEN t.type = 'expense' OR t.type = 'debt_payment' THEN -t.amount
            WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
            WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
            ELSE 0
          END
        ), 0) AS balance
       FROM accounts a
       LEFT JOIN transactions t ON (t.account_id = a.id OR t.transfer_to_account_id = a.id)
       WHERE a.owner_id = $1 AND a.is_active = true
       GROUP BY a.id
       ORDER BY a.created_at`,
      [req.user.id]
    );
    res.json({ personal: result.rows, shared: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts — balance siempre inicia en 0
router.post('/', auth, async (req, res) => {
  const { name, type, color, icon } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO accounts (name, type, balance, color, icon, owner_id)
       VALUES ($1, $2, 0, $3, $4, $5) RETURNING *`,
      [name, type, color || '#6366f1', icon || '🏦', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/accounts/:id — editar nombre, color, icono
router.put('/:id', auth, async (req, res) => {
  const { name, color, icon, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE accounts SET name=$1, color=$2, icon=$3, is_active=$4
       WHERE id=$5 AND owner_id=$6 RETURNING *`,
      [name, color, icon, is_active ?? true, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE accounts SET is_active=false WHERE id=$1 AND owner_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Cuenta desactivada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;