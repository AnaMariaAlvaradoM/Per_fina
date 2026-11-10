const express = require('express');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const { today } = require('../utils/dates');
const router = express.Router();

// El saldo de una cuenta siempre se calcula desde sus movimientos.
// Un 'adjustment' es un movimiento neutro (no es ingreso ni gasto) cuyo monto
// puede ser positivo o negativo: sirve para corregir el saldo dejando rastro.
const BALANCE_SQL = `
  COALESCE(SUM(
    CASE
      WHEN t.type = 'income' THEN t.amount
      WHEN t.type = 'expense' THEN -t.amount
      WHEN t.type = 'adjustment' THEN t.amount
      WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
      WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
      ELSE 0
    END
  ), 0)`;

// GET /api/accounts — cuentas activas con saldo calculado
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, ${BALANCE_SQL} AS balance
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

// POST /api/accounts — si llega un saldo inicial, se registra como ajuste
router.post('/', auth, async (req, res) => {
  const { name, type, color, icon, balance } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO accounts (name, type, balance, color, icon, owner_id)
       VALUES ($1, $2, 0, $3, $4, $5) RETURNING *`,
      [name.trim(), type, color || '#6366f1', icon || '🏦', req.user.id]
    );
    const account = result.rows[0];

    const initial = Number(balance) || 0;
    if (initial !== 0) {
      await client.query(
        `INSERT INTO transactions (amount, type, description, date, account_id, created_by)
         VALUES ($1, 'adjustment', 'Saldo inicial', $2, $3, $4)`,
        [initial, today(), account.id, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ...account, balance: initial });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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

// PUT /api/accounts/:id/balance — fija el saldo creando un ajuste por la diferencia
router.put('/:id/balance', auth, async (req, res) => {
  const target = Number(req.body.balance);
  if (!Number.isFinite(target)) return res.status(400).json({ error: 'Saldo inválido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT a.id, ${BALANCE_SQL} AS balance
       FROM accounts a
       LEFT JOIN transactions t ON (t.account_id = a.id OR t.transfer_to_account_id = a.id)
       WHERE a.id = $1 AND a.owner_id = $2 AND a.is_active = true
       GROUP BY a.id`,
      [req.params.id, req.user.id]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const diff = Math.round((target - Number(current.rows[0].balance)) * 100) / 100;
    let adjustment = null;
    if (diff !== 0) {
      const tx = await client.query(
        `INSERT INTO transactions (amount, type, description, date, account_id, created_by)
         VALUES ($1, 'adjustment', 'Ajuste de saldo', $2, $3, $4)
         RETURNING id, amount, TO_CHAR(date, 'YYYY-MM-DD') AS date`,
        [diff, today(), req.params.id, req.user.id]
      );
      adjustment = tx.rows[0];
    }
    await client.query('COMMIT');
    res.json({ balance: target, adjustment });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
