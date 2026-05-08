const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'habitospersonales',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'contra1234',
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en la conexion a PostgreSQL:', err.message);
});

module.exports = pool;
