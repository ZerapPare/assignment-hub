# Project Setup — Assignment Hub

A student assignment manager, split into **three independent services** run with Docker Compose: a React frontend, an Express API backend, and a MySQL database. No local Node.js or MySQL install required.

## Architecture

```
Browser
  │  http://localhost:5173
  ▼
frontend  (Vite dev server, React, hot reload)
  │  proxies /api/*  →  backend:3000
  ▼
backend   (Express + mysql2 REST API)
  │  DB_HOST=db
  ▼
db        (MySQL 8.0, seeded from init.sql)
```

The frontend never talks to MySQL directly — it calls `/api/*`, which Vite proxies to the backend over the internal Docker network. No CORS setup needed.

## Tech Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Frontend  | React 18 + Vite 5 (dev server) + react-router-dom 6 |
| Fonts     | Inter + Poppins (Google Fonts)                      |
| Backend   | Node.js 20 + Express 4                              |
| Auth      | Google + Microsoft OAuth 2.0 — `google-auth-library`, `jose`, `express-session` |
| DB Driver | mysql2                                              |
| Database  | MySQL 8.0                                           |
| Container | Docker + Docker Compose                             |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running before you start)
- [Git](https://git-scm.com/)

## Quick Start

```bash
git clone https://github.com/ZerapPare/assignment-hub.git
cd assignment-hub
docker compose up --build
```

Then open **http://localhost:5173**.

> First run: MySQL takes ~10–20s to initialize. If the page shows a "waiting for database" warning, wait and refresh.

> **Login needs OAuth credentials.** The stack runs without them, but clicking "เข้าสู่ระบบด้วย Google/Microsoft" will fail until you create a `.env.local` (see [Authentication](#authentication-oauth)).

## Services (docker-compose.yml)

| Service    | Build / Image | Port          | Role                                          |
|------------|---------------|---------------|-----------------------------------------------|
| `frontend` | `./frontend`  | `5173:5173`   | Vite dev server, hot reload, proxies `/api`   |
| `backend`  | `./backend`   | `3000:3000`   | Express REST API, connects to MySQL           |
| `db`       | `mysql:8.0`   | `3306:3306`   | Database `assignment_hub`, root pw `root123`  |

### Hot reload

Both app services mount their source folder as a volume (`./frontend:/app`, `./backend:/app`) with an anonymous volume for `node_modules`. Edit a file on your machine → the container picks it up live:
- **frontend** — Vite HMR (`usePolling` is on so changes are detected inside Docker on Windows)
- **backend** — `node --watch` restarts the server on change

### Backend environment variables

Non-secret config lives in `docker-compose.yml`; **secrets** live in a git-ignored `.env.local` at the repo root (loaded via the backend service's `env_file`).

| Variable                | Where            | Value / purpose                                  |
|-------------------------|------------------|--------------------------------------------------|
| `DB_HOST`               | compose          | `db`                                             |
| `DB_USER`               | compose          | `root`                                           |
| `DB_PASSWORD`           | compose          | `root123`                                        |
| `DB_NAME`               | compose          | `assignment_hub`                                 |
| `OAUTH_REDIRECT_URL`    | compose          | `http://localhost:5173/api/auth/google/callback` |
| `MS_OAUTH_REDIRECT_URL` | compose          | `http://localhost:5173/api/auth/microsoft/callback` |
| `FRONTEND_URL`          | compose          | `http://localhost:5173`                          |
| `GOOGLE_CLIENT_ID`      | **.env.local**   | Google OAuth client ID                           |
| `GOOGLE_CLIENT_SECRET`  | **.env.local**   | Google OAuth client secret                       |
| `MS_CLIENT_ID`          | **.env.local**   | Azure app (application) ID                        |
| `MS_CLIENT_SECRET`      | **.env.local**   | Azure client secret                              |
| `MS_TENANT_ID`          | **.env.local**   | *(optional)* Azure tenant; defaults to `organizations` |
| `SESSION_SECRET`        | **.env.local**   | random string that signs the session cookie      |

## Frontend routes

| Path     | Page          | Notes                                                        |
|----------|---------------|-------------------------------------------------------------|
| `/login` | Login screen  | Real Google / Microsoft OAuth (buttons redirect to the backend) |
| `/home`  | Dashboard     | Requires a session — redirects to `/login` if not logged in. Stat cards, urgent + all tasks, progress donut, trend, calendar (from the API) |
| `*`      | →             | Redirects to `/login`                                       |

## Authentication (OAuth)

Both providers use the **OAuth 2.0 Authorization Code flow** on the backend. The whole redirect stays on the `localhost:5173` origin via the Vite `/api` proxy, so the session cookie is same-host. On callback the backend upserts the user into `Student` (keyed on the unique email; university matched by email domain), stores the provider's access/refresh tokens (`gg_*` for Google, `ms_*` for Microsoft), and starts an `express-session` cookie. The dashboard reads `/api/me`; a `401` bounces you to `/login`.

**Prerequisites — create OAuth apps and a `.env.local`:**

1. **Google** — [Google Cloud Console](https://console.cloud.google.com/) → OAuth consent screen (External, add yourself as a Test user) → Credentials → OAuth client ID (Web application). Authorized redirect URI: `http://localhost:5173/api/auth/google/callback`.
2. **Microsoft** — [Azure Portal](https://portal.azure.com/) → App registrations → New registration (accounts: *organizations* / work-school). Add a Web redirect URI: `http://localhost:5173/api/auth/microsoft/callback`, and create a client secret.
3. Create **`.env.local`** at the repo root (git-ignored via `.env*`):

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   MS_CLIENT_ID=...
   MS_CLIENT_SECRET=...
   SESSION_SECRET=<random-string>
   ```

4. Recreate the backend so it picks up the env: `docker compose up -d backend`.

> Scope is **login only** (email + profile) for now, so Google stays in "Testing" (no verification needed). Tokens are stored ready for a future Google Classroom / Microsoft Teams sync.
>
> Dev sessions use an in-memory store, so a backend restart (including `node --watch` reloads on save) logs you out. Fine for development.

## API Endpoints (backend)

| Method | Path                          | Auth | Returns / does                                       |
|--------|-------------------------------|------|------------------------------------------------------|
| GET    | `/api/health`                 | —    | `{ status, db }` — verifies the DB connection        |
| GET    | `/api/auth/google`            | —    | Redirects to Google's consent screen                 |
| GET    | `/api/auth/google/callback`   | —    | Exchanges code, upserts user + tokens, starts session |
| GET    | `/api/auth/microsoft`         | —    | Redirects to Microsoft's consent screen              |
| GET    | `/api/auth/microsoft/callback`| —    | Exchanges code, upserts user + tokens, starts session |
| GET    | `/api/me`                     | Yes  | The logged-in student (greeting + sidebar profile)   |
| POST   | `/api/auth/logout`            | —    | Destroys the session                                 |
| GET    | `/api/assignments`            | Yes  | All assignments joined with course + detail info     |

`Yes` = requires a logged-in session (returns `401` otherwise). Quick check:

```bash
curl http://localhost:3000/api/health
curl -i http://localhost:3000/api/me          # 401 when logged out
curl -i http://localhost:3000/api/auth/google  # 302 to accounts.google.com
```

## Project Structure

```
assignment-hub/
├── docker-compose.yml        # defines frontend + backend + db
├── init.sql                  # schema + seed data (runs on first DB start)
├── .env.local                # OAuth secrets (git-ignored) — you create this
├── backend/
│   ├── Dockerfile
│   ├── package.json          # express, mysql2, express-session, google-auth-library, jose
│   └── server.js             # Express API + MySQL pool + OAuth routes
└── frontend/
    ├── Dockerfile
    ├── package.json          # react, react-router-dom, vite
    ├── vite.config.js        # dev server + /api proxy to backend
    ├── index.html            # loads Inter + Poppins fonts
    └── src/
        ├── main.jsx          # React entry
        ├── App.jsx           # router: /login, /home
        ├── pages/
        │   ├── LoginPage.jsx # two-panel login screen (Google/Microsoft OAuth)
        │   └── HomePage.jsx  # dashboard (fetches /api/me + /api/assignments)
        ├── components/       # Sidebar, StatCard, TaskRow, DonutChart, TrendChart, MiniCalendar, ProviderButton
        ├── icons/            # GoogleIcon, MicrosoftIcon (inline SVG)
        └── Dashboard.jsx     # early assignment-list view (kept, not routed)
```

## Database Schema (init.sql)

Auto-created on first DB start. Tables:

`University` · `Student` · `Course` · `Assignment` · `Assignment_Detail` · `Schedule` · `Notification`

Inspect data:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub -e "SHOW TABLES;"
```

> `init.sql` only runs when the database is first created. After editing it, run `docker compose down -v` then `up --build` to re-seed.

## Common Commands

| Command                          | What it does                            |
|----------------------------------|-----------------------------------------|
| `docker compose up --build`      | Build and run all three services        |
| `docker compose down`            | Stop all services                       |
| `docker compose down -v`         | Stop and wipe DB data (re-run init.sql) |
| `docker compose logs -f backend` | Follow backend logs                     |
| `docker compose logs -f frontend`| Follow frontend logs                    |

## Troubleshooting

- **`port is already allocated`** — an old container is holding 3306/3000/5173. `docker ps -a`, then `docker rm -f <name>`.
- **`getaddrinfo ENOTFOUND db`** — the stack started in a bad state. `docker compose down` then `docker compose up -d --force-recreate`.
- **Frontend loads but shows "waiting for database"** — MySQL is still initializing on first run; wait ~15s and refresh.
- **Added a new npm dependency but the container can't find it** — the `node_modules` anonymous volume from the old container shadows the freshly built image. Either install it into the running container (`docker exec assignment-hub-frontend-1 npm install <pkg>`) or do a clean rebuild: `docker compose down` then `docker compose up -d --build`.
