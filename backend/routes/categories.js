const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/categories — default + personales
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM categories
       WHERE is_default = true OR owner_id = $1
       ORDER BY is_default DESC, name ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories
router.post('/', auth, async (req, res) => {
  const { name, icon, color, type } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const insert = await pool.query(
      `INSERT INTO categories (name, icon, color, type, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name, type, owner_id) DO NOTHING
       RETURNING *`,
      [name, icon || '📌', color || '#6366f1', type || 'expense', req.user.id]
    );

    // Si ya existía (conflicto), recuperamos la categoría existente
    if (!insert.rows.length) {
      const existing = await pool.query(
        `SELECT * FROM categories
         WHERE name = $1 AND type = $2 AND owner_id = $3`,
        [name, type || 'expense', req.user.id]
      );
      return res.status(200).json(existing.rows[0]);
    }

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;