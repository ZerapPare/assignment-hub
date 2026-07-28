const mysql = require('mysql2/promise');

// MySQL connection pool (reads config from docker-compose env vars)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root123',
  database: process.env.DB_NAME || 'assignment_hub',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
