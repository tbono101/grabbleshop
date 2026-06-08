import pg from 'pg';

const { Pool } = pg;

const isLocal =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => console.error('Idle PostgreSQL client error:', err));

/** Run a query and return all rows. */
export async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

/** Run a query and return the first row, or null. */
export async function queryOne(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] ?? null;
}

/** Run fn(client) inside a BEGIN/COMMIT transaction; rolls back on error. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
