require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db/pool');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/fixed-expenses', require('./routes/fixed-expenses'));
// app.use('/api/ai', require('./routes/ai'));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

const PORT = process.env.PORT || 3001;

initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
});
