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
db        (MySQL 8.0, schema created from init.sql)
```

The frontend never talks to MySQL directly — it calls `/api/*`, which Vite proxies to the backend over the internal Docker network. No CORS setup needed.

## Tech Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Frontend  | React 18 + Vite 5 (dev server) + react-router-dom 6 |
| Fonts     | Maitree (Google Fonts) — covers Thai + Latin        |
| Styling   | Inline style objects + shared tokens in `src/theme.js` (no CSS framework) |
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
| `/home`  | Dashboard     | Requires a session — redirects to `/login` if not logged in. Four stat cards, a 7-day workload bar chart, a status donut, the task table, a month calendar, upcoming deadlines, and a 48h checklist |
| `*`      | →             | Redirects to `/login`                                       |

Every figure on the dashboard is derived in a single `useMemo` over the `/api/assignments`
response — there is no seeded or placeholder data anywhere in the UI. A freshly
logged-in account (before its first sync) renders zeros and empty states.

Three controls are intentionally inert because no endpoint backs them yet:

- **`+ เพิ่มงานใหม่`** is `disabled` — there is no create-assignment endpoint.
- The **48h checklist** is read-only — nothing can write `Assignment_Detail.status` back.
- **Sidebar nav items** other than `หน้าแรก` have no route, so they carry no pointer cursor.

Fonts and base CSS are injected by `src/GlobalStyles.jsx` (mounted once in `App.jsx`)
rather than declared in `index.html`.

## Authentication (OAuth)

Both providers use the **OAuth 2.0 Authorization Code flow** on the backend. The whole redirect stays on the `localhost:5173` origin via the Vite `/api` proxy, so the session cookie is same-host. Each flow sends a random `state` held in the session and rejects a callback that doesn't match it (`/login?error=state`). On callback the backend upserts the user into `Student` (keyed on the unique email), stores the provider's access/refresh tokens (`gg_*` for Google, `ms_*` for Microsoft), and starts an `express-session` cookie. The dashboard reads `/api/me`; a `401` bounces you to `/login`.

**Identity.** The email domain resolves to a `University` row that is *created on first sight*, so a new institution needs no seed data or code change (UR02). `student_id` is taken from the email's local part when it is all digits — the common `67050115@…` format — and is otherwise left unset for the user to fill in; it is unique per university, not globally (UR03).

**Linking the other platform.** `/api/auth/{google,microsoft}?link=1` connects a provider to the account already in the session instead of signing in as a new one. This matters because a personal Google address rarely matches a university Microsoft address — a plain second login would create a second `Student` row. Link mode finds the row by session, leaves `student_name` alone, and returns to `/settings?linked=<provider>`. Signing in with Microsoft and then linking Google is what makes `/api/classroom/sync` usable.

**Prerequisites — create OAuth apps and a `.env.local`:**

1. **Google** — [Google Cloud Console](https://console.cloud.google.com/) → OAuth consent screen (External, add yourself as a Test user) → Credentials → OAuth client ID (Web application). Authorized redirect URI: `http://localhost:5173/api/auth/google/callback`. Enable the **Google Classroom API** and add the three `classroom.*.readonly` scopes below, or `/api/classroom/sync` will fail.
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

> **Google scopes:** `openid email profile` plus `classroom.courses.readonly`,
> `classroom.coursework.me.readonly`, and `classroom.student-submissions.me.readonly`.
> The consent request uses `access_type=offline` + `prompt=consent` so a refresh token
> always comes back — `/api/classroom/sync` runs on that stored refresh token, not on
> the session. If a user granted access before the Classroom scopes were added, they
> must log out and back in to re-consent.
>
> **Microsoft** only requests `openid email profile offline_access User.Read`. Its tokens
> are stored, but there is no Teams sync yet — nothing writes `platform_source = 'Microsoft Teams'`.
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
| GET    | `/api/me`                     | Yes  | The logged-in student + `google_connected` / `microsoft_connected` |
| PATCH  | `/api/me`                     | Yes  | Sets `student_id`; `409` if taken at the same university |
| POST   | `/api/auth/logout`            | —    | Destroys the session                                 |
| GET    | `/api/assignments`            | Yes  | All assignments joined with course + detail info     |
| POST   | `/api/classroom/sync`         | Yes  | Imports Google Classroom coursework into the DB      |

`Yes` = requires a logged-in session (returns `401` otherwise).

`POST /api/classroom/sync` takes `{ "cutoffDate": "YYYY-MM-DD" | null }` and returns
`{ ok, coursesSynced, assignmentsSynced, deletedCount }`. The cutoff both limits what
is imported and deletes previously-synced rows that now fall before it, so moving the
date forward prunes old semesters. Courses upsert on `(external_course_id, student_id)`
and assignments on `external_assignment_id`; a re-sync updates rather than duplicates,
and keeps a status the user set manually unless Classroom reports the work as turned in.

Quick check:

```bash
curl http://localhost:3000/api/health
curl -i http://localhost:3000/api/me          # 401 when logged out
curl -i http://localhost:3000/api/auth/google  # 302 to accounts.google.com
```

## Project Structure

```
assignment-hub/
├── docker-compose.yml        # defines frontend + backend + db
├── init.sql                  # schema only, no seed data (runs on first DB start)
├── .env.local                # OAuth secrets (git-ignored) — you create this
├── backend/
│   ├── Dockerfile
│   ├── package.json          # express, mysql2, express-session, google-auth-library, googleapis, jose
│   └── server.js             # Express API + MySQL pool + OAuth routes + Classroom sync
└── frontend/
    ├── Dockerfile
    ├── package.json          # react, react-router-dom, vite
    ├── vite.config.js        # dev server + /api proxy to backend
    ├── index.html            # bare Vite entry (fonts are injected from GlobalStyles.jsx)
    └── src/
        ├── main.jsx          # React entry
        ├── App.jsx           # router: /login, /home
        ├── theme.js          # design tokens: colours, font, radii, shadows, Thai day/month names
        ├── GlobalStyles.jsx  # injects the Maitree webfont + base CSS, sets lang="th"
        ├── pages/
        │   ├── LoginPage.jsx # two-panel login screen (Google/Microsoft OAuth)
        │   └── HomePage.jsx  # dashboard (fetches /api/me + /api/assignments, POSTs the sync)
        ├── components/       # Sidebar, StatCard, TaskRow, BarChart, DonutChart, MiniCalendar,
        │                     # DeadlineList, UrgentChecklist, ProviderButton, BrandMark
        └── icons/            # GoogleIcon, MicrosoftIcon + index.jsx (UI icon set, inline SVG)
```

Components hold their styles in a local `const styles = {...}` object and pull every
colour, radius, and shadow from `theme.js`. Add new values there instead of hard-coding
hex in a component, so both screens keep one palette.

## Database Schema (init.sql)

Auto-created on first DB start. Tables:

`University` · `Student` · `Course` · `Assignment` · `Assignment_Detail` · `Schedule` · `Notification`

`init.sql` creates the schema and **inserts nothing** — the database starts empty, so a
new account sees an empty dashboard until it runs a Classroom sync. `University` rows are
created on demand by the first login from each email domain, so that table fills itself.
`Schedule` and `Notification` are defined but never read or written outside the sync's
cascade delete.

Two constraints carry requirements rather than just shape: `University.email_domain` is
unique (so the find-or-create is safe), and `Student (student_id, university_id)` is unique
(UR03 — the same number may recur at a different university, and unset ids stay `NULL`).

Inspect data:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub -e "SHOW TABLES;"
docker compose exec db mysql -uroot -proot123 assignment_hub -e \
  "SELECT c.platform_source, a.title, d.due_date, d.status FROM Assignment a \
   JOIN Course c USING(course_id) JOIN Assignment_Detail d USING(assignment_id) ORDER BY d.due_date;"
```

> `init.sql` only runs when the database is first created. After editing it, run `docker compose down -v` then `up --build` to recreate the schema.

### Migrations

Because of that, an existing database never picks up schema changes. `migrations/` holds
the equivalent `ALTER`s, applied by hand and safe to skip on a database built from the
current `init.sql`:

```bash
docker compose exec -T db mysql -uroot -proot123 assignment_hub < migrations/001_identity.sql
```

Verify:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub \
  -e "SHOW INDEX FROM University; SHOW INDEX FROM Student;"
```

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
- **`Error: Cannot find module '<pkg>'` after a new dependency was added** — the `/app/node_modules` anonymous volume survives container recreation and shadows the `node_modules` baked into the freshly built image, so `--force-recreate` and even `docker compose down` + `up --build` do **not** fix it. Drop the volume for that one service:

  ```bash
  docker compose rm -fsv backend     # -v is the part that removes the anonymous volume
  docker compose up -d --build backend
  ```

  Do **not** reach for `docker compose down -v` — it also wipes the named volumes, including `caddy_data`, which means re-requesting a Let's Encrypt certificate against a 5-per-week limit.
