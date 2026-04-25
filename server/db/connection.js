const mysql = require('mysql2/promise');
require('dotenv').config();

// Aiven requires SSL — enabled when DB_SSL=true in env
const sslConfig = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: false }   // Aiven free tier uses self-signed cert
  : false;

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'bingo_db',
  ssl:      sslConfig,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+00:00',
});

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
  });

module.exports = pool;
