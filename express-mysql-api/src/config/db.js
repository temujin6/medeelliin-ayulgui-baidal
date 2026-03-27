const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: "root",
  password: "Nest123$",
  database: "medeelel",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Verify connectivity on startup
pool
  .getConnection()
  .then((conn) => {
    console.log("MySQL connected");
    conn.release();
  })
  .catch((err) => {
    console.error("MySQL connection failed:", err.message);
    process.exit(1);
  });

module.exports = pool;
