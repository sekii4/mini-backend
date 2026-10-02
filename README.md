# Task CRUD API

A small Next.js API with a SQLite-backed task list. The API exposes the same five CRUD operations while task data persists between server restarts.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

The database is created automatically at `tasks.db` in the project root on the first task API request. The app creates the `tasks` table if it does not exist and inserts three example tasks only when the table is empty. The local database file is git-ignored, so a fresh clone starts with its own database.

SQLite was chosen because it stores data in one local file, needs no separate database server or setup, and keeps data after the app stops.

## API

| Method | Path | Success | Behavior |
| --- | --- | --- | --- |
| GET | `/tasks` | 200 | Return all tasks as a JSON array |
| GET | `/tasks/:id` | 200 | Return one task |
| POST | `/tasks` | 201 | Create a task from `{ "title": "..." }` |
| PUT | `/tasks/:id` | 200 | Replace a task using `{ "title": "...", "done": true }` |
| DELETE | `/tasks/:id` | 204 | Delete a task with an empty response body |

Task objects have the shape `{ "id": 1, "title": "...", "done": false }`. Missing or empty titles and invalid update bodies return 400. Unknown task IDs return 404 with `{ "error": "Task not found" }`. All values supplied by requests are passed to prepared SQL statements as parameters.

On Windows PowerShell, use `curl.exe` to avoid the `curl` alias. For example:

```bash
curl.exe -i http://localhost:3000/tasks
curl.exe -i http://localhost:3000/tasks/1
curl.exe -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d "{\"title\":\"Write SQL\"}"
curl.exe -i -X PUT http://localhost:3000/tasks/1 -H "Content-Type: application/json" -d "{\"title\":\"Write SQL\",\"done\":true}"
curl.exe -i -X DELETE http://localhost:3000/tasks/1
curl.exe -i http://localhost:3000/tasks/999
```

## Inspect SQLite

Open `tasks.db` in [DB Browser for SQLite](https://sqlitebrowser.org/). The database file and the API use the same rows; changes made in DB Browser are visible through the API without restarting the server.

Example Stage 4 query:

```sql
SELECT id, title, done FROM tasks ORDER BY id;
```

This returns every stored task in ID order.

**Database screenshot:** add a screenshot of `tasks.db` open in DB Browser for SQLite before submitting the assignment.