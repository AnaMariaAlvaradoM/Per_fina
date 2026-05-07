// GET /api/transactions/export
router.get('/export', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(t.date, 'YYYY-MM-DD') as fecha,
        t.description as descripcion,
        c.name as categoria,
        CASE t.type 
          WHEN 'income' THEN 'Ingreso'
          WHEN 'expense' THEN 'Gasto'
          WHEN 'transfer' THEN 'Transferencia'
          WHEN 'debt_payment' THEN 'Pago deuda'
        END as tipo,
        t.amount as monto,
        a.name as cuenta,
        t.notes as notas
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts a ON a.id = t.account_id
       WHERE t.created_by = $1
       ORDER BY t.date ASC, t.created_at ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;