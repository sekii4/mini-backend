import { Pool } from 'pg';

const globalForDatabase = globalThis;
const pool = globalForDatabase.taskPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
globalForDatabase.taskPool = pool;

const seedTasks = ['Learn PostgreSQL', 'Connect the API', 'Verify persistence'];

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [741025]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);

    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM tasks');
    if (rows[0].count === 0) {
      for (const title of seedTasks) {
        await client.query('INSERT INTO tasks (title, done) VALUES ($1, $2)', [title, false]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureDatabase() {
  if (!globalForDatabase.taskDatabaseReady) {
    globalForDatabase.taskDatabaseReady = initializeDatabase();
  }
  await globalForDatabase.taskDatabaseReady;
}

export async function listTasks() {
  await ensureDatabase();
  const { rows } = await pool.query('SELECT id, title, done FROM tasks ORDER BY id');
  return rows;
}

export async function findTask(id) {
  await ensureDatabase();
  const { rows } = await pool.query('SELECT id, title, done FROM tasks WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createTask(title) {
  await ensureDatabase();
  const { rows } = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING id, title, done',
    [title, false],
  );
  return rows[0];
}

export async function updateTask(id, title, done) {
  await ensureDatabase();
  const { rows } = await pool.query(
    'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING id, title, done',
    [title, done, id],
  );
  return rows[0] ?? null;
}

export async function deleteTask(id) {
  await ensureDatabase();
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return rowCount > 0;
}