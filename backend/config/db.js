const mysql = require('mysql2/promise');

function createPool() {
  const {
    DB_HOST = '127.0.0.1',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'fightforge',
  } = process.env;

  return mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
}

const pool = createPool();

module.exports = { pool, createPool };
