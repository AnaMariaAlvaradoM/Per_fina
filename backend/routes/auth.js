const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0)
      return res.status(409).json({ error: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, avatar_color',
      [name, email, hash]
    );
    const user = result.rows[0];

    // Crear hogar personal automáticamente
    const household = await pool.query(
      `INSERT INTO households (name, created_by, invite_code)
       VALUES ($1, $2, $3) RETURNING id`,
      [`Hogar de ${name}`, user.id, Math.random().toString(36).substring(2, 8).toUpperCase()]
    );
    await pool.query(
      'INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, $3)',
      [household.rows[0].id, user.id, 'owner']
    );

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { ...user, household_id: household.rows[0].id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    // Obtener household
    const hh = await pool.query(
      `SELECT h.id, h.name, h.invite_code FROM households h
       JOIN household_members hm ON hm.household_id = h.id
       WHERE hm.user_id = $1 ORDER BY h.created_at LIMIT 1`,
      [user.id]
    );

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color },
      household: hh.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, avatar_color, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const hh = await pool.query(
      `SELECT h.id, h.name, h.invite_code, hm.role FROM households h
       JOIN household_members hm ON hm.household_id = h.id
       WHERE hm.user_id = $1`,
      [req.user.id]
    );
    res.json({ user: result.rows[0], households: hh.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/join-household
router.post('/join-household', auth, async (req, res) => {
  const { invite_code } = req.body;
  try {
    const hh = await pool.query('SELECT * FROM households WHERE invite_code = $1', [invite_code]);
    if (!hh.rows.length) return res.status(404).json({ error: 'Código inválido' });

    const household = hh.rows[0];
    const existing = await pool.query(
      'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
      [household.id, req.user.id]
    );
    if (existing.rows.length) return res.status(409).json({ error: 'Ya perteneces a este hogar' });

    await pool.query(
      'INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, $3)',
      [household.id, req.user.id, 'member']
    );
    res.json({ message: 'Te uniste al hogar', household });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
