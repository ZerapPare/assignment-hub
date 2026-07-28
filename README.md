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

## โครงสร้าง 3 services

```
Browser  →  frontend (:5173, Vite)  →  backend (:3000, Express)  →  db (:3306, MySQL)
```

frontend ไม่คุยกับ MySQL ตรงๆ — เรียก `/api/*` แล้ว Vite proxy ส่งต่อไป backend (ไม่ต้องตั้ง CORS)

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

ทุกตัวเลขบนหน้า dashboard คำนวณจาก response ของ `/api/assignments` จริง ไม่มีข้อมูลตัวอย่างฝังในโค้ด
(บัญชีที่ยังไม่ซิงก์จะเห็น `0` และ empty state ทุกการ์ด)

หมายเหตุปุ่มที่ยังไม่พร้อมใช้:

- **`+ เพิ่มงานใหม่`** — `disabled` ไว้ เพราะ backend ยังไม่มี endpoint สร้างงาน
- **checklist "งานด่วน"** — แสดงอย่างเดียว กดติ๊กไม่ได้ เพราะยังไม่มี endpoint เปลี่ยนสถานะงาน
- **เมนูใน sidebar** (การบ้านทั้งหมด / สถิติ / ตั้งค่า) — ยังไม่มี route รองรับ

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
| GET | `/api/me` | ต้อง | ข้อมูล user ที่ login อยู่ |
| POST | `/api/auth/logout` | — | ออกจากระบบ (ลบ session) |
| GET | `/api/assignments` | ต้อง | งานทั้งหมด (JOIN course + detail) |
| POST | `/api/classroom/sync` | ต้อง | ดึงงานจาก Google Classroom มาลง DB |

`ต้อง` = ต้องมี session ไม่งั้นได้ `401`

`/api/classroom/sync` รับ body `{ "cutoffDate": "YYYY-MM-DD" | null }` (เอาเฉพาะงานที่กำหนดส่งตั้งแต่วันนั้น
งานเก่ากว่านั้นที่เคยซิงก์ไว้จะถูกลบ) แล้วคืน `{ ok, coursesSynced, assignmentsSynced, deletedCount }`
ปุ่ม "ซิงก์ Classroom" บน dashboard เรียก endpoint นี้ และจำค่า cutoff ไว้ใน `localStorage`

> Microsoft ยังเป็นแค่ login — ยังไม่มี sync ของ Teams

## Project Structure (ย่อ)

```
assignment-hub/
├── docker-compose.yml   # 3 services: frontend + backend + db
├── .env.local           # secret OAuth (git-ignored — สร้างเอง)
├── init.sql             # schema เปล่า ไม่มีข้อมูลตัวอย่าง (รันครั้งแรก)
├── backend/             # Express API + mysql2 + OAuth + Classroom sync
│   └── server.js
└── frontend/            # React + Vite + react-router
    └── src/
        ├── App.jsx          # router: /login, /home
        ├── theme.js         # design token (สี, ฟอนต์, radius, ชื่อวัน/เดือนไทย)
        ├── GlobalStyles.jsx # โหลดฟอนต์ Maitree + base CSS
        ├── pages/           # LoginPage, HomePage
        ├── components/      # Sidebar, StatCard, TaskRow, BarChart, DonutChart,
        │                    # MiniCalendar, DeadlineList, UrgentChecklist,
        │                    # ProviderButton, BrandMark
        └── icons/           # Google/Microsoft SVG + ไอคอน UI (index.jsx)
```

> สี/ฟอนต์/ระยะทั้งหมดอ่านจาก `theme.js` ที่เดียว ถ้าจะปรับธีมให้แก้ที่นั่น อย่าฮาร์ดโค้ด hex ในคอมโพเนนต์

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `docker compose up --build` | build + รันทั้งหมด |
| `docker compose down` | หยุดทั้งหมด |
| `docker compose down -v` | หยุด + ลบข้อมูล DB (ใช้เมื่อแก้ `init.sql` แล้วอยากให้รันใหม่) |
| `docker compose logs -f backend` | ดู log backend |

> `init.sql` รันเฉพาะตอนสร้าง database ครั้งแรก ถ้าแก้ไฟล์แล้ว table ไม่เปลี่ยน ให้ `docker compose down -v` ก่อนแล้ว `up` ใหม่
