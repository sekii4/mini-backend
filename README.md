# Supabase Auth API

A Node.js and Express API that delegates account creation, password authentication, JWT verification, and session logout to Supabase Auth. The server does not store passwords or implement cryptography.

## Setup

Requirements: Node.js 22 or newer and a Supabase project.

1. Clone this public repository and install packages:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and fill in the values from your Supabase project settings:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `SUPABASE_URL`, the Supabase **anon/public** key as `SUPABASE_KEY`, and `PORT=3000`. Never use the `service_role` key. For this practice assignment, disable **Confirm email** in the Supabase project's Auth settings so a new account can log in immediately.

3. Start the API with the single command:

   ```bash
   npm start
   ```

The API listens at `http://localhost:3000`. The `.env` file is ignored by Git; commit only the placeholder `.env.example`.

## Endpoints

| Method | Path | Authentication | Success | Description |
| --- | --- | --- | --- | --- |
| POST | `/auth/signup` | No | 201 | Create an account with `{ "email": "...", "password": "..." }` |
| POST | `/auth/login` | No | 200 | Log in; returns `access_token` and `refresh_token` |
| POST | `/auth/logout` | Bearer JWT | 204 | Revoke the current session |
| GET | `/protected/profile` | Bearer JWT | 200 | Return verified user ID, email, and creation date |
| GET | `/public/info` | No | 200 | Return the public welcome message |
| GET | `/protected/dashboard` | Bearer JWT | 200 | Example of another middleware-protected route |

Missing credentials return `400`; invalid login credentials return `401`. Protected routes return `401` when the token is missing, malformed, invalid, or expired.

Example signup request:

```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"person@example.com","password":"your-password"}'
```

To log in, send the same email/password fields to `POST /auth/login`, then use its `access_token` as `Authorization: Bearer <access_token>` for protected routes.

## Swagger UI

Open [http://localhost:3000/docs](http://localhost:3000/docs). Use **Authorize** to paste the access token returned by login, then choose **Try it out** on `GET /protected/profile`. The OpenAPI document is also available at `/openapi.json`.

![Swagger UI showing the documented auth endpoints and bearer-protected routes](docs/swagger-ui.png)