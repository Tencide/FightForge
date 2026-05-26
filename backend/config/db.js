const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function sslOptions() {
  const on = process.env.DB_SSL === '1' || process.env.DB_SSL === 'true';
  if (!on) return undefined;
  const fromEnv = (process.env.DB_SSL_CA || '').trim();
  if (fromEnv) return { ca: fromEnv, rejectUnauthorized: true };
  const caPath = path.join(__dirname, '..', 'certs', 'aiven-ca.pem');
  if (fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  }
  // Aiven (and similar) use a project CA; without ca.pem, Node rejects the chain.
  return { rejectUnauthorized: false };
}
function createPool() {
  const {
    DB_HOST = '127.0.0.1',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'fightforge',
  } = process.env;

  const ssl = sslOptions();
  return mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    namedPlaceholders: true,
    ...(ssl ? { ssl } : {}),
  });
}

const pool = createPool();

module.exports = { pool, createPool };
