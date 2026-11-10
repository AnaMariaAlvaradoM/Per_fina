const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const initDB = async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);

    // Migraciones: se corren en orden en cada arranque, todas son idempotentes
    const dir = path.join(__dirname, 'migrations');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : [];
    for (const file of files) {
      await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    }
    console.log('✅ Base de datos inicializada');
  } catch (err) {
    console.error('❌ Error inicializando DB:', err.message);
  }
};

module.exports = { pool, initDB };
