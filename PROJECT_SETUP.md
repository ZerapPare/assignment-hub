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

| Service    | Build / Image   | Port          | Role                                          |
|------------|-----------------|---------------|-----------------------------------------------|
| `frontend` | `./frontend`    | `5173`        | Vite dev server, hot reload, proxies `/api`   |
| `backend`  | `./backend`     | `3000`        | Express REST API, connects to MySQL           |
| `db`       | `mysql:8.0`     | `3306`        | Database `assignment_hub`, root pw `root123`  |
| `caddy`    | `caddy:2-alpine`| `80`, `443`   | TLS reverse proxy — **profile `tls` only**, not started locally |

`caddy` sits behind a Compose profile, so `docker compose up` never starts it. It
only comes up with `docker compose --profile tls up -d`, which is what a deployed
host uses. See [Deploying over HTTPS](#deploying-over-https).

### Hot reload

Both app services mount their source folder as a volume (`./frontend:/app`, `./backend:/app`) with an anonymous volume for `node_modules`. Edit a file on your machine → the container picks it up live:
- **frontend** — Vite HMR (`usePolling` is on so changes are detected inside Docker on Windows)
- **backend** — `node --watch` restarts the server on change

### Environment variables — three separate places

This trips people up, so be precise about which file a variable belongs in:

| File | Read by | Committed? |
|---|---|---|
| `docker-compose.yml` | Compose | yes — non-secret defaults live here |
| `.env` | **Compose itself**, for `${...}` substitution | no (`.env*` is git-ignored) |
| `.env.local` | loaded **into the backend container** via `env_file` | no |

`.env` is optional: local dev needs none at all. Only a deployed host creates one.

| Variable                | Where            | Value / purpose                                  |
|-------------------------|------------------|--------------------------------------------------|
| `DB_HOST`               | compose          | `db`                                             |
| `DB_USER`               | compose          | `root`                                           |
| `DB_PASSWORD`           | compose          | `root123`                                        |
| `DB_NAME`               | compose          | `assignment_hub`                                 |
| `OAUTH_REDIRECT_URL`    | compose          | derived — `${PUBLIC_URL}/api/auth/google/callback` |
| `MS_OAUTH_REDIRECT_URL` | compose          | derived — `${PUBLIC_URL}/api/auth/microsoft/callback` |
| `FRONTEND_URL`          | compose          | derived — `${PUBLIC_URL}`                        |
| `PUBLIC_URL`            | **.env**         | origin the browser uses. Defaults to `http://localhost:5173`. Builds all three redirect URLs above, so it must match what is registered with Google/Azure exactly |
| `SITE_HOST`             | **.env**         | hostname Caddy requests a certificate for        |
| `BIND`                  | **.env**         | interface the app ports publish on. `127.0.0.1` on a deployed host keeps frontend/backend/db off the internet; defaults to `0.0.0.0` |
| `FRONTEND_PORT`         | **.env**         | host port mapped to Vite's 5173; defaults to `5173`. Leave it alone when Caddy is in front — Caddy owns 80/443 |
| `HMR_CLIENT_PORT`       | **.env**         | public port the hot-reload websocket dials (`443` behind TLS). Unset locally |
| `GOOGLE_CLIENT_ID`      | **.env.local**   | Google OAuth client ID                           |
| `GOOGLE_CLIENT_SECRET`  | **.env.local**   | Google OAuth client secret — must come from the *same* client as the ID |
| `MS_CLIENT_ID`          | **.env.local**   | Azure app (application) ID                        |
| `MS_CLIENT_SECRET`      | **.env.local**   | Azure client secret                              |
| `MS_TENANT_ID`          | **.env.local**   | *(optional)* Azure tenant; defaults to `organizations` |
| `SESSION_SECRET`        | **.env.local**   | random string that signs the session cookie. **Set this on any internet-facing host** — the fallback in `server.js` is a literal published in this repo, so leaving it empty lets anyone forge a session. Generate with `openssl rand -hex 32`; it does not need to match between machines |

## Frontend routes

| Path     | Page          | Notes                                                        |
|----------|---------------|-------------------------------------------------------------|
| `/login` | Login screen  | Real Google / Microsoft OAuth (buttons redirect to the backend) |
| `/home`  | Dashboard     | Requires a session — redirects to `/login` if not logged in. Four stat cards, a 7-day workload bar chart, a status donut, a month calendar, upcoming deadlines, and a 48h checklist. **Summary only — no task table** |
| `/assignments` | All tasks | Requires a session. The task table: search, platform/status/course filters, per-row status control, edit + delete on manual tasks |
| `/settings` | Settings   | Requires a session. Student profile + editable รหัสนักศึกษา, notification preferences, and connect state for Google and Microsoft |
| `*`      | →             | Redirects to `/login`                                       |

Every figure on the dashboard is derived in a single `useMemo` over the `/api/assignments`
response — there is no seeded or placeholder data anywhere in the UI. A freshly
logged-in account (before its first sync) renders zeros and empty states.

**`+ เพิ่มงานใหม่`** (on both the dashboard and the assignments page) opens `AddTaskModal`
and `POST`s to `/api/assignments`. The created row is appended to the same `assignments`
state the `useMemo` reads, so every stat card, chart, calendar dot and list updates without a
refetch. Manual work is stored under a `Course` with `platform_source IS NULL`, which is what
the `เพิ่มเอง` filter tab matches.

### Shared task code

The dashboard summarises the assignment list and `/assignments` lists it, so the pieces both
need live in two modules rather than being duplicated:

| Module | Holds |
|---|---|
| [`src/tasks.js`](frontend/src/tasks.js) | The `STATUS` map and `STATUS_OPTIONS`, `normalizeStatus`, `DONE`/`isDone`, `PLATFORM_FILTERS`, `withDerived` (parses `due_date`, normalises status), `isUrgent`, `fmtDate`/`fmtTime`, `HOUR`/`URGENT_H` |
| [`src/useAssignments.js`](frontend/src/useAssignments.js) | The `/api/me` + `/api/assignments` fetch, the `401` → `/login` bounce, `logout`, and the `changeStatus` / `deleteTask` / `saveEdit` handlers with their per-row `statusPending` / `statusErrors` |

Adding a status, changing what counts as done, or changing how a task is edited is a one-file
change that both screens pick up. `AssignmentTable.jsx` owns the table itself and keeps its
own search and filter state — no page cares which tab is open, so it never leaves the component.

Each table row carries an **edit** and a **delete** button, shown only for manual work
(`platform_source IS NULL`). Edit opens `EditTaskModal` → `PATCH /api/assignments/:id` and
splices the returned row back into state; delete confirms, calls `DELETE /api/assignments/:id`,
and filters the row out. Synced coursework has neither: the platform stays the source of
truth (UR05), and the backend answers `404` for it rather than trusting the UI to hide them.

**Task status (UC-5)** is a `<select>` in the status cell, over the four values in
`tasks.js`'s `STATUS` map — `not_started` · `in_progress` · `submitted` · `completed`.
Choosing one `PATCH`es `/api/assignments/:id/status` immediately. Unlike edit and delete this
is offered on **every** task including synced ones, because status is the student's own
progress marker rather than the platform's data (A3.3).

Two details of that control matter:

- **Failures are per-row.** `statusPending` and `statusErrors` are keyed by assignment id, so
  a rejected change shows its message inside that one row and leaves the old status visible.
  The page-level `error` state is deliberately not used here — the body renders only when
  `!error`, so reusing it would blank the whole page over one failed dropdown (UC-5 ext 4a).
- **`submitted` and `completed` both count as done.** `DONE`/`isDone` in `tasks.js` drop
  them from the dashboard's urgent card and 48h checklist, so a finished task stops nagging (UR26).

### Notification preferences

`/settings` holds a third card, `NotificationSettings.jsx`, which fetches and saves
`/api/notification-settings` on its own — `SettingsPage.jsx` passes it nothing but the email
to display. Lead times are multi-select over four presets (60 / 180 / 1440 / 4320 minutes)
plus a custom value; **every selected chip uses one style** (filled `C.navy`), and custom
values that are currently selected render as chips beside the presets so they can be
deselected the same way. `Toggle.jsx` is a new shared `role="switch"` control, used twice here.

The master switch dims and disables the rest of the card rather than hiding it, and saving
still works while off — turning notifications off must not discard the schedule behind them.
The save button stays disabled until something actually changes, compared against a snapshot
of what was loaded.

**No email is sent yet.** There is no scheduler, no SMTP, and nothing writes the
`Notification` table, so `ส่งอีเมลทดสอบ` is disabled and the failure banner never appears
(`failed_count` is structurally 0 — see [API Endpoints](#api-endpoints-backend)).

Still inert:

- The **`ส่งอีเมลทดสอบ` button** — disabled until a sender exists.
- The **48h checklist** is display-only. `Assignment_Detail.status` is writable now, but
  `UrgentChecklist` takes no `onToggle` — status changes go through the table's dropdown.
- **`EditTaskModal`'s course field** posts `course_name`, which `PATCH /api/assignments/:id`
  does not accept — the value is silently dropped. Either add it to the handler or remove
  the input; right now it looks editable and isn't.
- The **`สถิติ` sidebar item** has no route, so it carries no pointer cursor.

Fonts and base CSS are injected by `src/GlobalStyles.jsx` (mounted once in `App.jsx`)
rather than declared in `index.html`.

## Authentication (OAuth)

Both providers use the **OAuth 2.0 Authorization Code flow** on the backend. The whole redirect stays on a single origin (`localhost:5173` locally, `PUBLIC_URL` when deployed) via the Vite `/api` proxy, so the session cookie is same-host. Each flow sends a random `state` held in the session and rejects a callback that doesn't match it (`/login?error=state`). On callback the backend upserts the user into `Student` (keyed on the unique email), stores the provider's access/refresh tokens (`gg_*` for Google, `ms_*` for Microsoft), and starts an `express-session` cookie. The dashboard reads `/api/me`; a `401` bounces you to `/login`.

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
| GET    | `/api/assignments`            | Yes  | The **session user's** assignments + course/detail info |
| POST   | `/api/assignments`            | Yes  | Creates a manual task; `201` with the created row    |
| PATCH  | `/api/assignments/:id`        | Yes  | Edits a **manual** task; `404` for synced or other users' rows |
| PATCH  | `/api/assignments/:id/status` | Yes  | Sets the task's status — allowed on **synced** rows too |
| DELETE | `/api/assignments/:id`        | Yes  | Deletes a **manual** task; `204` on success, `404` for synced or other users' rows |
| POST   | `/api/classroom/sync`         | Yes  | Imports Google Classroom coursework into the DB      |
| GET    | `/api/notification-settings`  | Yes  | Reminder preferences; **defaults without writing** when never saved |
| PUT    | `/api/notification-settings`  | Yes  | Replaces the whole preference set in one transaction |

`Yes` = requires a logged-in session (returns `401` otherwise).

`POST /api/assignments` takes `{ title, task_type, course_name, description, due_date }`.
Only `title` is required; `task_type` is one of `homework | project | quiz | exam | reading | other`;
`due_date` is a `datetime-local` string treated as wall-clock time. A blank `course_name`
files the task under `งานที่เพิ่มเอง`. `PATCH /api/assignments/:id` accepts any subset of
`title`, `task_type`, `description`, `due_date` — most often to move a deadline (UR07).
Synced coursework is deliberately not editable: the platforms stay the source of truth (UR05).
`course_name` is **not** among the accepted fields, so a manual task cannot be moved to a
different course through this route even though `EditTaskModal` sends the key.

`DELETE /api/assignments/:id` (UR08) checks the same ownership-and-manual condition, then
removes `Assignment_Detail` and `Assignment` in one transaction. The schema declares no
`ON DELETE CASCADE`, so dropping the detail row by hand is what keeps orphans out; the same
reason `POST` writes both rows inside a transaction.

### Status is the student's, not the platform's

`PATCH /api/assignments/:id/status` is a separate route rather than another field on
`PATCH /:id`, and the difference is a requirement, not a style choice:

| | `PATCH /:id` | `PATCH /:id/status` |
|---|---|---|
| Ownership check | `student_id` **and** `platform_source IS NULL` | `student_id` only |
| Applies to | manual tasks | every task, synced included |
| Rationale | a task's data must not diverge from Classroom/Teams (UR05) | progress is the student's private marker (A3.3) |

The body is `{ "status": "not_started" | "in_progress" | "submitted" | "completed" }`; anything
else is `400`. The write is an upsert (`INSERT … ON DUPLICATE KEY UPDATE`) rather than an
`UPDATE`, because the list query `LEFT JOIN`s `Assignment_Detail` — a row without one is
possible, and a plain `UPDATE` would match nothing and still report `status: null` back.

It also stamps `Assignment_Detail.status_updated_at = NOW()`, and **that column is what
divides ownership of the field**:

- While `status_updated_at IS NULL`, Classroom may seed the status — a sync writes
  `submitted` for coursework it reports as `TURNED_IN` or `RETURNED`.
- Once the student picks a status by hand the column goes non-`NULL`, and the sync's
  `UPDATE … WHERE status_updated_at IS NULL` stops matching that row forever. Without that
  predicate every sync would silently undo the student's choice.

`TURNED_IN`/`RETURNED` seed `submitted`, never `completed`. The two are distinct on purpose:
handed in is something Google can observe, finished is a judgement only the student makes.
`routes/assignments.js` and `routes/classroom.js` both hold the status list — change one and
you must change the other.

`POST /api/classroom/sync` takes `{ "cutoffDate": "YYYY-MM-DD" | null }` and returns
`{ ok, coursesSynced, assignmentsSynced, deletedCount, skippedCourses }`. The cutoff both
limits what is imported and deletes previously-synced rows that now fall before it, so
moving the date forward prunes old semesters. A re-sync updates rather than duplicates,
and never touches a status the student set by hand — see [Status is the student's, not the
platform's](#status-is-the-students-not-the-platforms).
A course whose coursework can't be read is pushed onto `skippedCourses` instead of
aborting the whole run.

### Both upsert keys must include the owner

Classroom hands **every student in a class the same course id and the same coursework
id**. This schema, on the other hand, gives each student their own `Course` and
`Assignment` rows. So a Classroom id alone never identifies one row here:

| Table | Upsert key |
|---|---|
| `Course` | `(external_course_id, student_id)` |
| `Assignment` | `(external_assignment_id, course_id)` — and `course_id` is already scoped to the student |

Dropping the owner half of either key breaks quietly and only in multi-user data: the
second classmate to sync *finds* the first one's row, takes the `UPDATE` branch, and
never inserts their own copy. Their sync reports success while their assignments simply
never appear, because the read path filters on `c.student_id`. On a single-user dev
database both key forms behave identically, so this cannot be caught locally — see the
matching entry under [Troubleshooting](#troubleshooting).

Neither key is enforced by a database constraint (`external_assignment_id` is
deliberately **not** unique — several students legitimately hold the same one), so
correctness here rests entirely on the queries in `routes/classroom.js`.

### Notification preferences

`PUT /api/notification-settings` takes the panel's entire state
(`{ enabled, lead_times, daily_repeat, daily_repeat_time, last_custom_minutes }`) and
**replaces** rather than merges — `Notification_Lead_Time` rows for that student are deleted
and re-inserted inside the same transaction as the `Notification_Setting` upsert. Validation
runs before any write: `lead_times` must be integers in `1`–`40320` minutes (28 days, max 10
values, de-duplicated) and `daily_repeat_time` must match `HH:MM`. The response has the same
shape as `GET`, so the panel drops it straight into state.

Two behaviours are deliberate:

- **`GET` never writes.** A student who has never saved gets defaults (`enabled`, `[1440]`,
  `08:00`) in the response and still has no row. That keeps "nobody has configured this" a
  question the table can answer — a read that seeded rows would make it unanswerable.
- **An empty `lead_times` is a real saved state**, not a reason to fall back to the default.
  A student who deselects every chip and saves must not find `1 วัน` selected again on reload.

Both responses also carry `failed_count` and `last_failed_at`, counted from `Notification`
rows where `is_sent = FALSE AND sent_at IS NOT NULL`, scoped to the student by walking
`Assignment_Detail → Assignment → Course`. **Nothing writes `Notification`, so this is always
`0`** — it exists so the failure banner has a real source the moment a sender lands.

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
├── migrations/               # ALTERs for databases created before a schema change
│   ├── 001_identity.sql      # unique email domain + (student_id, university_id)
│   ├── 002_task_type.sql     # Assignment.task_type
│   ├── 003_status_updated_at.sql  # Assignment_Detail.status_updated_at
│   └── 004_notification_settings.sql  # Notification_Setting + Notification_Lead_Time
├── migrate.sh / migrate.bat  # run every migration in order (keep the two in step)
├── Caddyfile                 # TLS reverse proxy config (used by the `tls` profile)
├── .env                      # deploy settings for Compose substitution (git-ignored)
├── .env.local                # OAuth secrets (git-ignored) — you create this
├── backend/
│   ├── Dockerfile
│   ├── package.json          # express, mysql2, express-session, google-auth-library, googleapis, jose
│   ├── server.js             # thin entry: session middleware, then mounts the routers
│   └── src/
│       ├── config.js         # env vars in one place (PORT, SESSION_SECRET, OAuth ids)
│       ├── db.js             # the shared mysql2 pool
│       ├── middleware/auth.js    # requireAuth — 401 without a session
│       ├── routes/           # health, auth, me, assignments, classroom, notifications
│       ├── services/
│       │   ├── classroomSync.js  # Classroom paging + date conversion
│       │   ├── identity.js       # find-or-create University / upsert Student
│       │   └── oauthSession.js   # `state` handling and the link-mode flow
│       └── utils/dueDate.js  # datetime-local → DATETIME, kept in wall-clock time
└── frontend/
    ├── Dockerfile
    ├── package.json          # react, react-router-dom, vite
    ├── vite.config.js        # dev server + /api proxy to backend
    ├── index.html            # bare Vite entry (fonts are injected from GlobalStyles.jsx)
    └── src/
        ├── main.jsx          # React entry
        ├── App.jsx           # router: /login, /home, /assignments, /settings
        ├── theme.js          # design tokens: colours, font, radii, shadows, Thai day/month names
        ├── tasks.js          # shared task model: STATUS, filters, isDone, withDerived, date fmt
        ├── useAssignments.js # shared hook: fetch + status/delete/edit handlers
        ├── GlobalStyles.jsx  # injects the Maitree webfont + base CSS, sets lang="th"
        ├── pages/
        │   ├── LoginPage.jsx    # two-panel login screen (Google/Microsoft OAuth)
        │   ├── HomePage.jsx     # dashboard summary + the Classroom sync toolbar
        │   ├── AssignmentsPage.jsx # the task table
        │   └── SettingsPage.jsx # profile, รหัสนักศึกษา, notifications, provider link state
        ├── components/       # Sidebar, StatCard, AssignmentTable, TaskRow, BarChart,
        │                     # DonutChart, MiniCalendar, DeadlineList, UrgentChecklist,
        │                     # AddTaskModal, EditTaskModal, NotificationSettings, Toggle,
        │                     # ProviderButton, BrandMark
        └── icons/            # GoogleIcon, MicrosoftIcon + index.jsx (UI icon set, inline SVG)
```

The backend is split by area rather than kept in one file: `routes/` holds the HTTP layer
and `services/` the logic worth testing on its own. `db.js` exports a single pool that every
route imports — don't create a second one.

Components hold their styles in a local `const styles = {...}` object and pull every
colour, radius, and shadow from `theme.js`. Add new values there instead of hard-coding
hex in a component, so both screens keep one palette.

## Database Schema (init.sql)

Auto-created on first DB start. Tables:

`University` · `Student` · `Course` · `Assignment` · `Assignment_Detail` · `Schedule` ·
`Notification` · `Notification_Setting` · `Notification_Lead_Time`

`init.sql` creates the schema and **inserts nothing** — the database starts empty, so a
new account sees an empty dashboard until it runs a Classroom sync. `University` rows are
created on demand by the first login from each email domain, so that table fills itself.
`Schedule` and `Notification` are defined but never read or written outside the sync's
cascade delete.

Three constraints carry requirements rather than just shape: `University.email_domain` is
unique (so the find-or-create is safe), `Student (student_id, university_id)` is unique
(UR03 — the same number may recur at a different university, and unset ids stay `NULL`),
and `Course.platform_source IS NULL` is what marks a course as manually created.

Two columns are load-bearing in the same way. `Assignment.task_type` holds one of
`homework | project | quiz | exam | reading | other` (validated in the API, not the schema)
and is `NULL` for synced coursework, which carries no equivalent. `Assignment_Detail.status_updated_at`
is `NULL` until the student sets a status by hand, and the Classroom sync reads that `NULL`
as permission to write status — so the column is a flag about *who owns the field*, not just
an audit timestamp. Never backfill it.

`Notification_Setting` is 1:1 with `Student` and holds the reminder preferences;
`Notification_Lead_Time` holds one row per selected lead time. Two choices there are worth
knowing: lead times are stored **in minutes** so presets and custom values share a single
representation that compares directly against `due_date` (no unit column), and they live in
a child table rather than a CSV column because a student picks several and the future sender
has to `JOIN` on them to find which assignments are due. `last_custom_minutes` on the parent
is only a UI convenience — it remembers the last value typed under `+ กำหนดเอง` so the hint
line can offer it again, and being set there does **not** mean it is currently selected.
`Notification` itself is still written by nothing.

Two *absent* constraints are just as deliberate: `Course.external_course_id` and
`Assignment.external_assignment_id` carry no unique index, because classmates share those
Classroom ids and each needs their own row. That makes the composite upsert keys in
`routes/classroom.js` the only thing keeping one student's sync out of another's data —
see [Both upsert keys must include the owner](#both-upsert-keys-must-include-the-owner).

Inspect data:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub -e "SHOW TABLES;"
docker compose exec db mysql -uroot -proot123 assignment_hub -e \
  "SELECT c.platform_source, a.title, d.due_date, d.status FROM Assignment a \
   JOIN Course c USING(course_id) JOIN Assignment_Detail d USING(assignment_id) ORDER BY d.due_date;"
```

> `init.sql` only runs when the database is first created. After editing it, run `docker compose down -v` then `up --build` to recreate the schema — but on a host already serving HTTPS, remove just the database instead (`docker compose rm -fsv db`), since `down -v` would take `caddy_data` with it.

### Migrations

Because `init.sql` only runs on a fresh database, an existing one never picks up schema
changes. `migrations/` holds the equivalent `ALTER`s, applied by hand and safe to skip on
a database built from the current `init.sql`:

| File | Adds | For |
|---|---|---|
| `001_identity.sql` | unique `University.email_domain`; unique `Student (student_id, university_id)` | UR02, UR03 |
| `002_task_type.sql` | `Assignment.task_type` | UR06, A5.1 |
| `003_status_updated_at.sql` | `Assignment_Detail.status_updated_at` | UC-5, A3.3, UR12 |
| `004_notification_settings.sql` | `Notification_Setting` + `Notification_Lead_Time` tables | UC-6, UR12 |

`migrate.sh` (and `migrate.bat` for cmd) runs them all in order against a running stack:

```bash
./migrate.sh        # macOS / Linux / Git Bash
migrate.bat         # Windows cmd
```

Both are plain sequences of the same command, so re-running them on an up-to-date database
just prints "Duplicate column name" / "Duplicate key name" per statement and moves on —
there is no migration ledger and nothing tracks which ones already ran. New migrations must
be appended to **both** scripts by hand.

Applying one on its own:

```bash
docker compose exec -T db mysql -uroot -proot123 assignment_hub < migrations/003_status_updated_at.sql
```

Verify:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub \
  -e "DESCRIBE Assignment; DESCRIBE Assignment_Detail; SHOW INDEX FROM University; SHOW INDEX FROM Student;"
```

> `003` is the one to watch on a database that already holds synced rows: leave
> `status_updated_at` `NULL` everywhere. Filling it in — for instance to "record" when rows
> were imported — permanently stops the Classroom sync from updating any status, because
> non-`NULL` is exactly the signal that the student has taken the field over.

## Deploying over HTTPS

Local dev stays on plain HTTP. A deployed host adds Caddy, which obtains and
renews a Let's Encrypt certificate by itself.

**HTTPS is not optional if you want Google login to work.** Google refuses any
`redirect_uri` that is not `https://` unless the host is `localhost` — the Cloud
Console rejects such a URI at save time, so there is nothing to configure your way
around.

1. **DNS** — the hostname must already resolve to the machine. Caddy proves control
   of it via an ACME challenge, so this has to be true *before* the first start.
2. **Firewall** — open TCP **80 and 443**. Port 80 is still required with HTTPS: the
   ACME challenge uses it and Caddy redirects `http://` → `https://` from it. On GCP
   the instance's *Allow HTTP/HTTPS traffic* checkboxes do this.
3. **`.env`** at the repo root:

   ```env
   SITE_HOST=your-host.example.org
   PUBLIC_URL=https://your-host.example.org
   BIND=127.0.0.1
   HMR_CLIENT_PORT=443
   ```

4. **`server.allowedHosts`** in `frontend/vite.config.js` must list the hostname, or
   Vite answers every request with `403 Blocked request`.
5. **Start with the profile** — a port-mapping or `.env` change needs a recreate, not
   a restart:

   ```bash
   docker compose --profile tls up -d --force-recreate
   docker compose logs -f caddy      # wait for "certificate obtained successfully"
   ```

6. **Register the redirect URIs** with the providers — `https://<host>/api/auth/google/callback`
   in Google Cloud Console, `.../microsoft/callback` in Azure. Keep the `localhost`
   entries so local dev still works.

Certificates live in the `caddy_data` named volume. Avoid `docker compose down -v`,
which deletes it and forces a re-issue against Let's Encrypt's limit of 5
certificates per domain per week.

## Common Commands

| Command                          | What it does                            |
|----------------------------------|-----------------------------------------|
| `docker compose up --build`      | Build and run all three services        |
| `docker compose down`            | Stop all services                       |
| `docker compose down -v`         | Stop and wipe DB data (re-run init.sql). **Also deletes `caddy_data`** — only safe before TLS is set up |
| `docker compose logs -f backend` | Follow backend logs                     |
| `docker compose logs -f frontend`| Follow frontend logs                    |
| `docker compose --profile tls up -d` | Bring the stack up with Caddy in front (deployed hosts) |
| `docker compose rm -fsv <service>`   | Drop a service **and its anonymous `node_modules` volume** — the fix after adding a dependency |
| `./migrate.sh` / `migrate.bat`   | Apply every `migrations/*.sql` to an existing database (no-op errors if already applied) |

## Troubleshooting

- **`port is already allocated`** — an old container is holding 3306/3000/5173. `docker ps -a`, then `docker rm -f <name>`.
- **`403 Blocked request. This host is not allowed`** — Vite rejects Host headers it doesn't recognise. Add the hostname to `server.allowedHosts` in `frontend/vite.config.js`, then recreate the frontend container (the setting is read once at startup, so a reload won't pick it up).
- **`ERR_CONNECTION_REFUSED` on the bare domain** — nothing is listening on port 80. Either `FRONTEND_PORT` is still 5173, or the `tls` profile wasn't used so Caddy never started. `docker compose ps` shows what is actually published. A *refused* connection means the firewall let the packet through and no process answered; a firewall block shows up as a **timeout** instead — a useful way to tell the two apart.
- **Every `/api/*` route returns `500`, including `/api/health`** — the request never reached Express. `/api/health` can only answer `200` or `503`, so a `500` there is Vite's proxy failing to connect to `backend:3000`. Check `docker compose logs backend` for a crash; `docker compose logs frontend | grep proxy` confirms it (`[vite] http proxy error`).
- **`Error 400: redirect_uri_mismatch`** — Google compares the `redirect_uri` byte-for-byte against what is registered on **that specific OAuth client**. Before editing anything in the Console, confirm which client the server is actually sending:

  ```bash
  curl -s -D - -o /dev/null https://<host>/api/auth/google | grep -i location
  ```

  The `client_id` prefix is the **Google Cloud project number** (`123456789-abc….apps.googleusercontent.com` lives in project `123456789`), so `https://console.cloud.google.com/apis/credentials?project=<that number>` opens the right project directly. Editing a client in a different project — easy to do when several exist — changes nothing and looks identical from the outside. Also check `http` vs `https`, a stray trailing slash, and that the URI went in *Authorized redirect URIs*, not *Authorized JavaScript origins*.
- **A sync reports success but the assignments never show up — and the same account gets more of them on a single-user database** — the row exists, it just belongs to a classmate. Compare what is stored against what the API returns:

  ```bash
  docker compose exec db mysql -uroot -proot123 assignment_hub -e "SELECT s.user_id, s.university_email, COUNT(a.assignment_id) AS cnt FROM Student s LEFT JOIN Course c ON c.student_id = s.user_id LEFT JOIN Assignment a ON a.course_id = c.course_id GROUP BY s.user_id, s.university_email;"
  ```

  A lopsided split (one student holding nearly everything while later ones hold almost nothing) means an upsert lookup lost its owner condition and the first student to sync claimed the shared rows — see [Both upsert keys must include the owner](#both-upsert-keys-must-include-the-owner). No migration is needed after fixing the query: the next sync stops matching other people's rows and inserts the missing ones. Far more `Course` rows than `Assignment` rows is the same symptom seen from the other side, since the course upsert is scoped and the assignment one was not.
- **Code changed on disk but the backend still runs the old version** — `node --watch` uses `fs.watch`, which frequently misses writes arriving through a Docker bind mount (the same reason Vite needs `usePolling`). `docker compose exec backend grep …` will show the new source while the running process still holds the old one in memory. `docker compose restart backend` after a `git pull` on a deployed host.
- **`redirect_uri` is correct but login still fails on a deployed host while localhost works** — the two hosts are probably using different OAuth clients. Compare `GOOGLE_CLIENT_ID` in each machine's `.env.local`; `.env.local` is git-ignored, so a deployed checkout never inherits the one you use locally. Copy the ID **and** secret together — a mixed pair fails with `invalid_client`.
- **`Unknown column 'status_updated_at' in 'field list'`** (or `'task_type'`) — the database predates the schema change and `init.sql` does not re-run on an existing volume. Apply the migrations: `./migrate.sh`, or the single file with `docker compose exec -T db mysql -uroot -proot123 assignment_hub < migrations/003_status_updated_at.sql`. Every `/api/assignments` read fails with this, so the dashboard shows the DB-not-ready state rather than an empty list.
- **A status set by hand reverts after the next Classroom sync** — the sync only skips rows whose `status_updated_at` is non-`NULL`, so a status that keeps getting overwritten means the column never got stamped. Check the row directly:

  ```bash
  docker compose exec db mysql -uroot -proot123 assignment_hub -e \
    "SELECT assignment_id, status, status_updated_at FROM Assignment_Detail WHERE assignment_id = <id>;"
  ```

  `status_updated_at` still `NULL` after a successful-looking dropdown change means the `PATCH /api/assignments/:id/status` write did not land — check `docker compose logs backend` for `[assignments] status update failed`. The mirror image of this bug is a status that *never* updates from Classroom, which is what backfilling the column causes.
- **`getaddrinfo ENOTFOUND db`** — the stack started in a bad state. `docker compose down` then `docker compose up -d --force-recreate`.
- **Frontend loads but shows "waiting for database"** — MySQL is still initializing on first run; wait ~15s and refresh.
- **`Error: Cannot find module '<pkg>'` after a new dependency was added** — the `/app/node_modules` anonymous volume survives container recreation and shadows the `node_modules` baked into the freshly built image, so `--force-recreate` and even `docker compose down` + `up --build` do **not** fix it. Drop the volume for that one service:

  ```bash
  docker compose rm -fsv backend     # -v is the part that removes the anonymous volume
  docker compose up -d --build backend
  ```

  Do **not** reach for `docker compose down -v` — it also wipes the named volumes, including `caddy_data`, which means re-requesting a Let's Encrypt certificate against a 5-per-week limit.
