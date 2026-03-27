import mysql from "mysql2/promise";

// Singleton pool — prevents connection exhaustion during Next.js dev hot-reloads
const globalForDb = globalThis as unknown as { dbPool?: mysql.Pool };

export const pool =
  globalForDb.dbPool ??
  mysql.createPool({
    host:               process.env.DB_HOST ?? "localhost",
    port:               Number(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  });

if (process.env.NODE_ENV !== "production") globalForDb.dbPool = pool;
