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

| Variable      | Value            |
|---------------|------------------|
| `DB_HOST`     | `db`             |
| `DB_USER`     | `root`           |
| `DB_PASSWORD` | `root123`        |
| `DB_NAME`     | `assignment_hub` |

## Frontend routes

| Path     | Page          | Notes                                                        |
|----------|---------------|-------------------------------------------------------------|
| `/login` | Login screen  | Google/Microsoft buttons (UI only — click routes to `/home`) |
| `/home`  | Dashboard     | Stat cards, urgent + all tasks, progress donut, trend, calendar — all derived from the API |
| `*`      | →             | Redirects to `/login`                                       |

> Login is **not real auth yet** — the buttons just navigate to the dashboard. Real Google OAuth is a planned next step (the `Student` table already has `gg_/ms_` token columns for it).

## API Endpoints (backend)

| Method | Path               | Returns                                                    |
|--------|--------------------|------------------------------------------------------------|
| GET    | `/api/health`      | `{ status, db }` — verifies the DB connection is up        |
| GET    | `/api/assignments` | All assignments joined with course + detail info           |
| GET    | `/api/student`     | The first student (used as the logged-in user for now)     |

Try them:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/assignments
curl http://localhost:3000/api/student
```

## Project Structure

```
assignment-hub/
├── docker-compose.yml        # defines frontend + backend + db
├── init.sql                  # schema + seed data (runs on first DB start)
├── backend/
│   ├── Dockerfile
│   ├── package.json          # express, mysql2
│   └── server.js             # Express API + MySQL pool
└── frontend/
    ├── Dockerfile
    ├── package.json          # react, react-router-dom, vite
    ├── vite.config.js        # dev server + /api proxy to backend
    ├── index.html            # loads Inter + Poppins fonts
    └── src/
        ├── main.jsx          # React entry
        ├── App.jsx           # router: /login, /home
        ├── pages/
        │   ├── LoginPage.jsx # two-panel login screen
        │   └── HomePage.jsx  # dashboard (fetches /api/assignments + /api/student)
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
