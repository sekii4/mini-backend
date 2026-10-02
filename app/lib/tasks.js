import Database from 'better-sqlite3';
import path from 'node:path';

const globalForDatabase = globalThis;
const database = globalForDatabase.taskDatabase ?? new Database(path.join(process.cwd(), 'tasks.db'));
globalForDatabase.taskDatabase = database;

database.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
  )
`);

const taskCount = database.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
if (taskCount === 0) {
  const insertSeed = database.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  database.transaction(() => {
    for (const title of ['Learn SQLite', 'Connect the API', 'Verify persistence']) {
      insertSeed.run(title, 0);
    }
  })();
}

const taskFromRow = (row) => (row ? { ...row, done: Boolean(row.done) } : null);

export function listTasks() {
  return database.prepare('SELECT id, title, done FROM tasks ORDER BY id').all().map(taskFromRow);
}

export function findTask(id) {
  return taskFromRow(database.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(id));
}

export function createTask(title) {
  const result = database.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)').run(title, 0);
  return findTask(Number(result.lastInsertRowid));
}

export function updateTask(id, title, done) {
  const result = database
    .prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?')
    .run(title, done ? 1 : 0, id);
  return result.changes ? findTask(id) : null;
}

export function deleteTask(id) {
  const result = database.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}