# Task CRUD API

A Next.js task API backed by PostgreSQL. Docker Compose runs the API and database together, and a named volume keeps task data between container restarts.

## Run the stack

Requires Docker Desktop with its engine running. In PowerShell, copy the environment template and set your own local `POSTGRES_PASSWORD` in `.env`:

```powershell
Copy-Item .env.example .env
```

Then start the complete stack with:

```bash
docker compose up --build
```

The API is available at `http://localhost:3000`; PostgreSQL is exposed on port `5432`. Compose connects the API to the database using the service hostname `db`. The database creates the `tasks` table automatically and inserts three example tasks only when the table is empty. The `postgres_data` named volume preserves rows when containers are stopped and recreated.

To test persistence, run `docker compose down` and then `docker compose up --build`; the task rows remain in the named volume. `docker compose down -v` deletes the database volume and all stored tasks; use that only when you intentionally want a fresh database.

## Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `POSTGRES_USER` | Database user | `tasks` |
| `POSTGRES_PASSWORD` | Required local database password; keep in ignored `.env` | Set your own value |
| `POSTGRES_DB` | Database name (defaults to `tasks`) | `tasks` |
| `DATABASE_URL` | Local PostgreSQL connection string for tools outside Compose | `postgresql://tasks:password@localhost:5432/tasks` |

`.env` is git-ignored. `.env.example` contains placeholders only. Compose sets the API's `DATABASE_URL` to use `db` as the hostname inside the Docker network; the localhost URL in `.env` is for tools connecting from your computer. If you change `POSTGRES_PASSWORD`, update the password in `DATABASE_URL` as well when using a local tool or running the API outside Compose.

## API

| Method | Path | Success | Behavior |
| --- | --- | --- | --- |
| GET | `/tasks` | 200 | Return all tasks as a JSON array |
| GET | `/tasks/:id` | 200 | Return one task |
| POST | `/tasks` | 201 | Create a task from `{ "title": "..." }` |
| PUT | `/tasks/:id` | 200 | Update using `{ "title": "...", "done": true }` |
| DELETE | `/tasks/:id` | 204 | Delete a task; response has no body |

Tasks have the shape `{ "id": 1, "title": "...", "done": false }`. Invalid or empty titles and invalid update bodies return 400. Unknown IDs return 404 with `{ "error": "Task not found" }`. Database values use parameterized PostgreSQL queries.

Example request:

```bash
curl -i http://localhost:3000/tasks
```

Create a task:

```bash
curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Review PostgreSQL"}'
```

## Inspect the database

Use a PostgreSQL client such as `psql` or a GUI such as pgAdmin, connecting to `localhost:5432` with the values in `.env`. To inspect rows using Compose:

```bash
docker compose exec db psql -U tasks -d tasks -c "SELECT id, title, done FROM tasks ORDER BY id;"
```

PostgreSQL `tasks` table and query results:

![PostgreSQL tasks table showing the stored rows](docs/postgres-tasks.png)

## Clean-clone check

After cloning the public repository, copy `.env.example` to `.env`, set `POSTGRES_PASSWORD`, and run `docker compose up --build`. The API and database start together, and `GET /tasks` returns the three seed tasks on a fresh volume. No database server or manual schema setup is required.
