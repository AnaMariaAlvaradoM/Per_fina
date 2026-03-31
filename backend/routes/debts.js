const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/debts
router.get('/', auth, async (req, res) => {
  const { household_id } = req.query;
  try {
    const result = await pool.query(
      `SELECT d.*,
        ROUND((d.paid_amount / NULLIF(d.total_amount, 0)) * 100, 1) as progress_pct,
        (d.total_amount - d.paid_amount) as remaining
       FROM debts d
       WHERE (d.owner_id = $1 ${household_id ? `OR d.household_id = $2` : ''})
         AND d.is_active = true
       ORDER BY d.due_date ASC NULLS LAST, d.created_at DESC`,
      household_id ? [req.user.id, household_id] : [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debts
router.post('/', auth, async (req, res) => {
  const { name, description, total_amount, direction, counterpart, due_date, interest_rate, is_shared, household_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO debts (name, description, total_amount, direction, counterpart, due_date, interest_rate, owner_id, household_id, is_shared)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        name, description, total_amount, direction, counterpart, due_date, interest_rate,
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

// PUT /api/debts/:id
router.put('/:id', auth, async (req, res) => {
  const { name, description, total_amount, counterpart, due_date, interest_rate, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE debts SET name=$1, description=$2, total_amount=$3, counterpart=$4,
        due_date=$5, interest_rate=$6, is_active=$7
       WHERE id=$8 AND (owner_id=$9 OR household_id IN (
         SELECT household_id FROM household_members WHERE user_id=$9
       )) RETURNING *`,
      [name, description, total_amount, counterpart, due_date, interest_rate, is_active, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Deuda no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
