# Assignment Hub

เว็บรวมงาน/การบ้านและกำหนดส่งจาก Google Classroom และ Microsoft Teams ไว้ในที่เดียว
รันด้วย Docker ทั้งหมด — ไม่ต้องลง Node.js หรือ MySQL ในเครื่อง

> 📄 รายละเอียดสถาปัตยกรรม/โครงสร้างแบบเต็ม ดูที่ [PROJECT_SETUP.md](PROJECT_SETUP.md)

## 🛠 Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18 + Vite + react-router-dom (ฟอนต์ Inter + Poppins) |
| Backend | Node.js 20 + Express |
| Database | MySQL 8.0 |
| Container | Docker + Docker Compose |

## 🧩 โครงสร้าง 3 services

```
Browser  →  frontend (:5173, Vite)  →  backend (:3000, Express)  →  db (:3306, MySQL)
```

frontend ไม่คุยกับ MySQL ตรงๆ — เรียก `/api/*` แล้ว Vite proxy ส่งต่อไป backend (ไม่ต้องตั้ง CORS)

## 📦 Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (เปิดโปรแกรมทิ้งไว้ก่อนรันคำสั่ง)
- [Git](https://git-scm.com/)

## 🚀 Getting Started

### 1. Clone โปรเจกต์

```bash
git clone https://github.com/ZerapPare/assignment-hub.git
cd assignment-hub
```

### 2. รันด้วย Docker Compose

```bash
docker compose up --build
```

รอจนเห็น log ประมาณนี้:

```
backend-1   | Backend API running on http://localhost:3000
frontend-1  | ➜  Local:   http://localhost:5173/
db-1        | ... ready for connections
```

### 3. เปิดใช้งาน

เปิดเบราว์เซอร์ไปที่ **http://localhost:5173**

จะเจอหน้า **login** ก่อน → กดปุ่ม "เข้าสู่ระบบด้วย Google/Microsoft" (ตอนนี้เป็น UI ยังไม่ต่อ OAuth จริง — กดแล้วเข้า **หน้า dashboard** เลย)

> ⏳ ครั้งแรก MySQL start ช้ากว่าแอป ถ้าหน้า dashboard ขึ้น "รอ database พร้อม..." ให้รอ 10–20 วิ แล้ว refresh

## 🖥 หน้าจอ

| Path | หน้า |
|---|---|
| `/login` | หน้าเข้าสู่ระบบ (Google / Microsoft) |
| `/home` | Dashboard — การ์ดสถิติ, งานด่วน, งานทั้งหมด, กราฟความคืบหน้า, ปฏิทิน (ดึงข้อมูลจริงจาก API) |

## 🗄 Database

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

## 🔌 API (backend)

| Method | Path | คืนอะไร |
|---|---|---|
| GET | `/api/health` | สถานะการต่อ DB |
| GET | `/api/assignments` | งานทั้งหมด (JOIN course + detail) |
| GET | `/api/student` | นักเรียน (ใช้เป็น user ที่ login อยู่ชั่วคราว) |

## 📁 Project Structure (ย่อ)

```
assignment-hub/
├── docker-compose.yml   # 3 services: frontend + backend + db
├── init.sql             # schema + ข้อมูลตัวอย่าง (รันครั้งแรก)
├── backend/             # Express API + mysql2
│   └── server.js
└── frontend/            # React + Vite + react-router
    └── src/
        ├── App.jsx      # router: /login, /home
        ├── pages/       # LoginPage, HomePage
        ├── components/  # Sidebar, StatCard, กราฟ ฯลฯ
        └── icons/       # Google/Microsoft SVG
```

## 🔧 คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `docker compose up --build` | build + รันทั้งหมด |
| `docker compose down` | หยุดทั้งหมด |
| `docker compose down -v` | หยุด + ลบข้อมูล DB (ใช้เมื่อแก้ `init.sql` แล้วอยากให้รันใหม่) |
| `docker compose logs -f backend` | ดู log backend |

> ⚠️ `init.sql` รันเฉพาะตอนสร้าง database ครั้งแรก ถ้าแก้ไฟล์แล้ว table ไม่เปลี่ยน ให้ `docker compose down -v` ก่อนแล้ว `up` ใหม่
