const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/accounts — cuentas personales + compartidas del hogar
router.get('/', auth, async (req, res) => {
  const { household_id } = req.query;
  try {
    const personal = await pool.query(
      `SELECT a.*, 
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount WHEN t.type='expense' OR t.type='debt_payment' THEN -t.amount ELSE 0 END), 0) as computed_balance
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id
       WHERE a.owner_id = $1 AND a.is_active = true
       GROUP BY a.id ORDER BY a.created_at`,
      [req.user.id]
    );

    let shared = { rows: [] };
    if (household_id) {
      shared = await pool.query(
        `SELECT a.*,
          COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount WHEN t.type='expense' OR t.type='debt_payment' THEN -t.amount ELSE 0 END), 0) as computed_balance
         FROM accounts a
         LEFT JOIN transactions t ON t.account_id = a.id
         WHERE a.household_id = $1 AND a.is_active = true
         GROUP BY a.id ORDER BY a.created_at`,
        [household_id]
      );
    }

    res.json({ personal: personal.rows, shared: shared.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts
router.post('/', auth, async (req, res) => {
  const { name, type, balance = 0, color, icon, is_shared = false, household_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO accounts (name, type, balance, color, icon, owner_id, household_id, is_shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        name, type, balance, color || '#6366f1', icon || '🏦',
        is_shared ? null : req.user.id,
        is_shared ? household_id : null,
        is_shared
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/accounts/:id
router.put('/:id', auth, async (req, res) => {
  const { name, color, icon, is_active, balance } = req.body;
  try {
    const result = await pool.query(
      `UPDATE accounts SET name=$1, color=$2, icon=$3, is_active=$4, balance=$5
       WHERE id=$6 AND (owner_id=$7 OR household_id IN (
         SELECT household_id FROM household_members WHERE user_id=$7
       )) RETURNING *`,
      [name, color, icon, is_active, balance ?? 0, req.params.id, req.user.id]
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