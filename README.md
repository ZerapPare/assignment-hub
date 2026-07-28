# Assignment Hub

เว็บรวมงาน/การบ้านและกำหนดส่งจาก Google Classroom และ Microsoft Teams ไว้ในที่เดียว
รันด้วย Docker ทั้งหมด — ไม่ต้องลง Node.js หรือ MySQL ในเครื่อง

> รายละเอียดสถาปัตยกรรม/โครงสร้างแบบเต็ม ดูที่ [PROJECT_SETUP.md](PROJECT_SETUP.md)

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18 + Vite + react-router-dom (ฟอนต์ Maitree — มี glyph ไทย) |
| Backend | Node.js 20 + Express |
| Auth | Google + Microsoft OAuth 2.0 (`google-auth-library`, `jose`, `express-session`) |
| Database | MySQL 8.0 |
| Container | Docker + Docker Compose |
| HTTPS (เฉพาะตอน deploy) | Caddy 2 + Let's Encrypt (ออก cert อัตโนมัติ) |

## โครงสร้าง services

**บนเครื่องตัวเอง — 3 services**

```
Browser  →  frontend (:5173, Vite)  →  backend (:3000, Express)  →  db (:3306, MySQL)
```

**บนเซิร์ฟเวอร์ — เพิ่ม Caddy คุม TLS ข้างหน้า**

```
Browser ──https:443──►  caddy  ──http──►  frontend  ──/api──►  backend  ──►  db
```

frontend ไม่คุยกับ MySQL ตรงๆ — เรียก `/api/*` แล้ว Vite proxy ส่งต่อไป backend (ไม่ต้องตั้ง CORS)

Caddy อยู่ใน Docker Compose profile ชื่อ `tls` จึง**ไม่สตาร์ทตอน dev ปกติ** ขึ้นเฉพาะตอนสั่ง
`docker compose --profile tls up -d` — ดู [Deploy บนเซิร์ฟเวอร์](#deploy-บนเซิร์ฟเวอร์-https-ผ่านโดเมน)

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (เปิดโปรแกรมทิ้งไว้ก่อนรันคำสั่ง)
- [Git](https://git-scm.com/)

## Getting Started

### 1. Clone โปรเจกต์

```bash
git clone https://github.com/ZerapPare/assignment-hub.git
cd assignment-hub
```

### 2. ตั้งค่า OAuth (สร้างไฟล์ `.env.local`)

Login เป็น OAuth จริง ต้องมี client id/secret ก่อน — สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์ (ถูก git-ignore ไว้แล้ว):

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
SESSION_SECRET=<สุ่มข้อความยาวๆ>
```

วิธีเอา client id/secret:
- **Google** — [Google Cloud Console](https://console.cloud.google.com/) → OAuth consent screen (External + ใส่อีเมลตัวเองเป็น Test user) → Credentials → OAuth client ID (Web) → redirect URI: `http://localhost:5173/api/auth/google/callback`
  - ต้องเปิด **Google Classroom API** และเพิ่ม scope `classroom.courses.readonly`, `classroom.coursework.me.readonly`, `classroom.student-submissions.me.readonly` ด้วย ไม่งั้นปุ่มซิงก์จะไม่ทำงาน
- **Microsoft** — [Azure Portal](https://portal.azure.com/) → App registrations → New registration → เพิ่ม Web redirect URI: `http://localhost:5173/api/auth/microsoft/callback` แล้วสร้าง client secret

> ยังไม่ใส่ก็รันได้ แต่กดปุ่ม login แล้วจะ error จนกว่าจะมี `.env.local`

### 3. รันด้วย Docker Compose

```bash
docker compose up --build
```

รอจนเห็น log ประมาณนี้:

```
backend-1   | Backend API running on http://localhost:3000
frontend-1  | ➜  Local:   http://localhost:5173/
db-1        | ... ready for connections
```

### 4. เปิดใช้งาน

เปิดเบราว์เซอร์ไปที่ **http://localhost:5173**

จะเจอหน้า **login** ก่อน → กด "เข้าสู่ระบบด้วย Google/Microsoft" → ไปหน้า consent ของ provider → กลับมาที่ **dashboard** (ระบบสร้าง user ในตาราง `Student` + เก็บ token ให้อัตโนมัติ) กด "ออกจากระบบ" ที่ sidebar เพื่อออก

**ครั้งแรก dashboard จะว่างเปล่า** เพราะ database ไม่มีข้อมูลตัวอย่าง — ตั้งวันที่ในช่อง "งานตั้งแต่วันที่"
แล้วกด **"ซิงก์ Classroom"** เพื่อดึงงานจริงจากบัญชี Google ของคุณเข้ามา

> ครั้งแรก MySQL start ช้ากว่าแอป ถ้าหน้า dashboard ขึ้น "รอ database พร้อม..." ให้รอ 10–20 วิ แล้ว refresh
>
> dev ใช้ session แบบ in-memory — backend restart (เช่นตอนแก้โค้ด) จะ logout เอง เป็นเรื่องปกติ

## หน้าจอ

| Path | หน้า |
|---|---|
| `/login` | หน้าเข้าสู่ระบบ (Google / Microsoft) |
| `/home` | Dashboard — การ์ดสถิติ 4 ใบ, กราฟแท่ง 7 วันข้างหน้า, โดนัทสถานะงาน, ตารางงานทั้งหมด, ปฏิทิน, กำหนดส่งใกล้ถึง, checklist งานด่วน |
| `/settings` | ตั้งค่า — โปรไฟล์, แก้รหัสนักศึกษา, สถานะเชื่อมต่อ Google/Microsoft |

ทุกตัวเลขบนหน้า dashboard คำนวณจาก response ของ `/api/assignments` จริง ไม่มีข้อมูลตัวอย่างฝังในโค้ด
(บัญชีที่ยังไม่ซิงก์จะเห็น `0` และ empty state ทุกการ์ด)

**`+ เพิ่มงานใหม่`** เปิด `AddTaskModal` แล้ว `POST` ไป `/api/assignments` — แถวที่สร้างถูกใส่กลับเข้า
state ตัวเดียวกับที่ `useMemo` อ่าน ทุกการ์ด กราฟ จุดบนปฏิทิน และรายการจึงอัปเดตพร้อมกันโดยไม่ต้อง refetch
งานที่เพิ่มเองเก็บใต้ `Course` ที่ `platform_source IS NULL` ซึ่งตรงกับแท็บ `เพิ่มเอง`

ส่วนที่ยังไม่พร้อมใช้:

- **checklist "งานด่วน"** — แสดงอย่างเดียว กดติ๊กไม่ได้ (`PATCH /api/assignments/:id` แก้ได้เฉพาะงานที่เพิ่มเอง ยังไม่มี UI เรียก)
- **เมนู sidebar** `การบ้านทั้งหมด` / `สถิติ` — ยังไม่มี route รองรับ

## Database

Database ชื่อ `assignment_hub` ถูกสร้างอัตโนมัติจาก `init.sql` ตอน start ครั้งแรก มี 7 ตาราง:

| ตาราง | เก็บอะไร |
|---|---|
| `University` | มหาวิทยาลัย + โดเมนอีเมล |
| `Student` | ผู้ใช้ + token สำหรับ login (Google/Microsoft) |
| `Course` | รายวิชา + แพลตฟอร์มต้นทาง (Classroom/Teams) |
| `Assignment` | งาน: ชื่อ, ลิงก์ต้นทาง, วิชา |
| `Assignment_Detail` | รายละเอียด: คำอธิบาย, deadline, สถานะ, priority |
| `Schedule` | ช่วงเวลาที่วางแผนทำ + เวลาที่คาดว่าจะใช้ |
| `Notification` | การแจ้งเตือนของแต่ละงาน |

เช็คข้อมูลใน database:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub -e "SHOW TABLES; SELECT title, status FROM Assignment a JOIN Assignment_Detail d USING(assignment_id);"
```

## API (backend)

| Method | Path | ต้อง login? | คืนอะไร |
|---|---|---|---|
| GET | `/api/health` | — | สถานะการต่อ DB |
| GET | `/api/auth/google` · `/microsoft` | — | ส่งไปหน้า consent ของ provider |
| GET | `/api/auth/{provider}/callback` | — | แลก code → สร้าง/อัปเดต user + token → เริ่ม session |
| GET | `/api/me` | ต้อง | ข้อมูล user ที่ login อยู่ + สถานะเชื่อมต่อ Google/Microsoft |
| PATCH | `/api/me` | ต้อง | แก้รหัสนักศึกษา (`409` ถ้าซ้ำในมหาลัยเดียวกัน) |
| POST | `/api/auth/logout` | — | ออกจากระบบ (ลบ session) |
| GET | `/api/assignments` | ต้อง | งาน**ของผู้ใช้ที่ login อยู่** (JOIN course + detail) |
| POST | `/api/assignments` | ต้อง | เพิ่มงานเอง คืน `201` พร้อมแถวที่สร้าง |
| PATCH | `/api/assignments/:id` | ต้อง | แก้งานที่เพิ่มเอง (งานที่ซิงก์มาแก้ไม่ได้) |
| POST | `/api/classroom/sync` | ต้อง | ดึงงานจาก Google Classroom มาลง DB |

`ต้อง` = ต้องมี session ไม่งั้นได้ `401` — และทุก query ผูกกับ `student_id` จาก session
ไม่ได้รับ id มาจาก client ผู้ใช้จึงเห็นเฉพาะข้อมูลของตัวเอง

`/api/classroom/sync` รับ body `{ "cutoffDate": "YYYY-MM-DD" | null }` (เอาเฉพาะงานที่กำหนดส่งตั้งแต่วันนั้น
งานเก่ากว่านั้นที่เคยซิงก์ไว้จะถูกลบ) แล้วคืน `{ ok, coursesSynced, assignmentsSynced, deletedCount, skippedCourses }`
ปุ่ม "ซิงก์ Classroom" บน dashboard เรียก endpoint นี้ และจำค่า cutoff ไว้ใน `localStorage`
(แยกตาม origin — `localhost` กับโดเมนจริงจำคนละค่า)

> **สำคัญสำหรับคนแก้โค้ด sync:** Google Classroom แจก course id และ coursework id
> **ตัวเดียวกันให้นักศึกษาทุกคนในวิชานั้น** แต่ schema เราให้แต่ละคนมีแถวของตัวเอง
> upsert จึงต้องใช้ key คู่กับเจ้าของเสมอ — `Course` ใช้ `(external_course_id, student_id)`
> และ `Assignment` ใช้ `(external_assignment_id, course_id)`
> ถ้าลืมครึ่งหลัง คนที่ซิงก์ทีหลังจะไปเจอแถวของเพื่อนแล้ว `UPDATE` ทับ **แทนที่จะ `INSERT` ของตัวเอง**
> — ซิงก์สำเร็จแต่งานไม่ขึ้น และ**จะไม่มีวันเจอบั๊กนี้ตอน dev คนเดียว**
> รายละเอียดที่ [PROJECT_SETUP.md](PROJECT_SETUP.md#both-upsert-keys-must-include-the-owner)

> Microsoft ยังเป็นแค่ login — ยังไม่มี sync ของ Teams

## Project Structure (ย่อ)

```
assignment-hub/
├── docker-compose.yml   # 3 services: frontend + backend + db
├── .env.local           # secret OAuth (git-ignored — สร้างเอง)
├── init.sql             # schema เปล่า ไม่มีข้อมูลตัวอย่าง (รันครั้งแรก)
├── backend/             # Express API + mysql2 + OAuth + Classroom sync
│   ├── server.js        # entry บาง ๆ — ตั้ง session แล้ว mount router
│   └── src/
│       ├── config.js    # รวม env var ไว้ที่เดียว
│       ├── db.js        # mysql2 pool ตัวเดียวที่ทุก route ใช้ร่วมกัน
│       ├── routes/      # health, auth, me, assignments, classroom
│       ├── services/    # classroomSync, identity, oauthSession
│       └── middleware/  # requireAuth
└── frontend/            # React + Vite + react-router
    └── src/
        ├── App.jsx          # router: /login, /home, /settings
        ├── theme.js         # design token (สี, ฟอนต์, radius, ชื่อวัน/เดือนไทย)
        ├── GlobalStyles.jsx # โหลดฟอนต์ Maitree + base CSS
        ├── pages/           # LoginPage, HomePage, SettingsPage
        ├── components/      # Sidebar, StatCard, TaskRow, BarChart, DonutChart,
        │                    # MiniCalendar, DeadlineList, UrgentChecklist,
        │                    # AddTaskModal, ProviderButton, BrandMark
        └── icons/           # Google/Microsoft SVG + ไอคอน UI (index.jsx)
```

> สี/ฟอนต์/ระยะทั้งหมดอ่านจาก `theme.js` ที่เดียว ถ้าจะปรับธีมให้แก้ที่นั่น อย่าฮาร์ดโค้ด hex ในคอมโพเนนต์

## Deploy บนเซิร์ฟเวอร์ (HTTPS ผ่านโดเมน)

ค่า default ทั้งหมดตั้งไว้สำหรับ `localhost:5173` — local dev ไม่ต้องแตะอะไรเลย
ส่วนบนเซิร์ฟเวอร์จะใช้ **Caddy** เป็น TLS reverse proxy ออก cert Let's Encrypt ให้อัตโนมัติและต่ออายุเอง

**ทำไมต้อง HTTPS:** Google ไม่รับ OAuth redirect URI ที่เป็น `http://` กับโดเมนจริง (อนุญาตเฉพาะ `localhost`)
ลงทะเบียนใน Console ไม่ได้ตั้งแต่แรก ดังนั้น login จะใช้งานไม่ได้เลยถ้าไม่มี TLS

### 1. DNS

โดเมนต้อง resolve มาที่ IP ของเซิร์ฟเวอร์ **ก่อน** ขอ cert (Let's Encrypt ตรวจผ่าน HTTP-01 challenge บนพอร์ต 80)

```bash
dig +short assignment-hubb.duckdns.org      # ต้องได้ IP ของ VM
```

### 2. เปิด firewall TCP 80 + 443

```bash
gcloud compute firewall-rules create allow-web --allow=tcp:80,tcp:443 --source-ranges=0.0.0.0/0
```

พอร์ต 80 จำเป็นแม้จะใช้ https เพราะ ACME challenge วิ่งผ่านมันและ Caddy ใช้ redirect ไป https

### 3. สร้างไฟล์ `.env` ที่ root

(คนละไฟล์กับ `.env.local` — อันนี้ Docker Compose อ่านเอง, git-ignored เหมือนกัน)

```env
SITE_HOST=assignment-hubb.duckdns.org
PUBLIC_URL=https://assignment-hubb.duckdns.org
BIND=127.0.0.1
HMR_CLIENT_PORT=443
```

`BIND=127.0.0.1` ทำให้พอร์ต frontend/backend/db ไม่โผล่ออกอินเทอร์เน็ต เหลือแค่ Caddy ที่ 80/443

### 4. เพิ่มโดเมนใน `allowedHosts`

ที่ [`frontend/vite.config.js`](frontend/vite.config.js) ไม่งั้น Vite ตอบ `403 Blocked request`

### 5. รันด้วย TLS profile

```bash
docker compose --profile tls up -d --force-recreate
docker compose logs -f caddy          # ดูว่าออก cert สำเร็จ
```

Caddy ออก cert ภายในไม่กี่วินาที ถ้าเห็น `certificate obtained successfully` แปลว่าเรียบร้อย

### 6. ลงทะเบียน redirect URI

- **Google Cloud Console** → Credentials → OAuth client → `https://<โดเมน>/api/auth/google/callback`
- **Azure Portal** → App registrations → Authentication → `https://<โดเมน>/api/auth/microsoft/callback`

ต้องตรงเป๊ะทุกตัวอักษร ไม่งั้นได้ `redirect_uri_mismatch`

> **cert เก็บใน named volume `caddy_data`** อย่าลบด้วย `docker compose down -v` โดยไม่จำเป็น
> เพราะ Let's Encrypt จำกัด 5 cert ต่อโดเมนต่อสัปดาห์ ถ้าขอใหม่ทุกครั้งที่ recreate จะโดน rate limit

### อัปเดตโค้ดหลัง deploy แล้ว

**แก้โค้ดเฉย ๆ ไม่ต้องรันคำสั่ง docker เลย** — ซอร์สถูก mount เข้า container อยู่ (`./frontend:/app`, `./backend:/app`)
Vite HMR กับ `node --watch` โหลดใหม่ให้เอง แค่ `git pull` บนเซิร์ฟเวอร์ก็พอ

| แก้อะไร | ต้องทำ |
|---|---|
| โค้ด `.jsx` `.js` `server.js` | ไม่ต้องทำอะไร |
| `.env` / `docker-compose.yml` | `docker compose --profile tls up -d --force-recreate` |
| `vite.config.js` | `docker compose restart frontend` |
| `Caddyfile` | `docker compose restart caddy` |
| เพิ่ม npm package | `docker compose rm -fsv <service>` แล้ว `docker compose --profile tls up -d --build` |

แถวสุดท้ายสำคัญ — package ใหม่ต้องลบ anonymous volume ของ `node_modules` ทิ้งก่อน ไม่งั้น container
ยังใช้ของเก่าแล้วพังด้วย `Cannot find module` (`--force-recreate` เฉย ๆ ไม่ช่วย)

> **บนเซิร์ฟเวอร์ ให้ใส่ `--profile tls` ทุกครั้งที่พิมพ์ `up`** ถ้าเผลอ `down` แล้ว `up` เปล่า ๆ
> Caddy จะไม่กลับมา เว็บหลุด https ทันที ส่วน `logs` / `restart` / `ps` ไม่ต้องใส่

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `docker compose up --build` | build + รันทั้งหมด (local dev) |
| `docker compose --profile tls up -d` | รันพร้อม Caddy (บนเซิร์ฟเวอร์) |
| `docker compose down` | หยุดทั้งหมด |
| `docker compose down -v` | หยุด + ลบข้อมูล DB (ใช้เมื่อแก้ `init.sql`) — **ลบ `caddy_data` ด้วย** ระวังบนเซิร์ฟเวอร์ |
| `docker compose rm -fsv <service>` | ลบ service + anonymous volume (ใช้ตอนเพิ่ม npm package) |
| `docker compose logs -f backend` | ดู log backend |

> `init.sql` รันเฉพาะตอนสร้าง database ครั้งแรก ถ้าแก้ไฟล์แล้ว table ไม่เปลี่ยน ให้ `docker compose down -v` ก่อนแล้ว `up` ใหม่
> — แต่บนเซิร์ฟเวอร์ที่มี HTTPS แล้ว ให้ลบเฉพาะ db ด้วย `docker compose rm -fsv db` แทน ไม่งั้น cert หายไปด้วย

## เจอปัญหาบ่อย

| อาการ | สาเหตุ |
|---|---|
| `403 Blocked request. This host is not allowed` | โดเมนไม่อยู่ใน `allowedHosts` ของ [vite.config.js](frontend/vite.config.js) — เพิ่มแล้วต้อง restart frontend |
| `ERR_CONNECTION_REFUSED` | ไม่มีอะไรฟังพอร์ตนั้น เช็ค `docker compose ps` · **refused = firewall ผ่านแต่ไม่มีคนฟัง / timeout = โดน firewall บล็อก** |
| `/api/*` เป็น `500` ทุกเส้น | request ไปไม่ถึง Express — `/api/health` คืนได้แค่ `200`/`503` ถ้าได้ `500` แปลว่า Vite proxy ต่อ `backend:3000` ไม่ติด ดู `docker compose logs backend` |
| `Cannot find module '<pkg>'` | anonymous volume บัง `node_modules` ใหม่ → `docker compose rm -fsv backend` แล้ว `up -d --build` |
| แก้โค้ดแล้ว backend ยังรันของเก่า | `node --watch` มักไม่เห็นไฟล์ที่เปลี่ยนผ่าน bind mount ของ Docker → `docker compose restart backend` หลัง `git pull` |
| ซิงก์สำเร็จแต่งานไม่ขึ้น (และ localhost ได้เยอะกว่า) | upsert key ขาดเงื่อนไขเจ้าของ → คนที่ซิงก์ทีหลังไปเจอแถวของเพื่อน ดู [หมายเหตุใต้ตาราง API](#api-backend) |
| `Error 400: redirect_uri_mismatch` | URI ไม่ตรงกับที่ลงทะเบียนใน OAuth client **ตัวนั้น** — เช็คว่าเซิร์ฟเวอร์ส่ง client ไหนก่อน (ดูด้านล่าง) |

**เช็คว่าเซิร์ฟเวอร์ใช้ OAuth client ตัวไหนอยู่:**

```bash
curl -s -D - -o /dev/null https://<โดเมน>/api/auth/google | grep -i location
```

เลขหน้า `client_id` คือ **project number** ของ Google Cloud เอาไปเปิด
`https://console.cloud.google.com/apis/credentials?project=<เลขนั้น>` จะเข้า project ที่ถูกต้องเลย

`.env.local` เป็น git-ignored เครื่องที่ clone ใหม่จึงไม่ได้ credentials ติดมาด้วย ถ้า local login ได้
แต่เซิร์ฟเวอร์ไม่ได้ ให้เทียบ `GOOGLE_CLIENT_ID` ของสองเครื่อง — มักเป็นคนละ client กัน
(ก๊อป id กับ secret ไปคู่กันเสมอ ถ้าสลับคู่จะได้ `invalid_client`)

> รายการเต็มพร้อมคำอธิบายละเอียด ดูที่ [PROJECT_SETUP.md → Troubleshooting](PROJECT_SETUP.md#troubleshooting)
