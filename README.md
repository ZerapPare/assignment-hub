

## 🛠 Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Backend | Node.js + Express |
| Database | MySQL 8.0 |
| Container | Docker + Docker Compose |

## 📦 Prerequisites

ต้องติดตั้งก่อนรัน:

    - [Docker Desktop](https://www.docker.com/products/docker-desktop/) (เปิดโปรแกรมทิ้งไว้ก่อนรันคำสั่ง)
    - [Git](https://git-scm.com/)

ไม่ต้องติดตั้ง Node.js หรือ MySQL ในเครื่อง — Docker จัดการให้ทั้งหมด

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

รอจนเห็น log:

```
app-1  | App running on http://localhost:3000
db-1   | ... ready for connections
```

### 3. เปิดใช้งาน

เปิดเบราว์เซอร์ไปที่ **http://localhost:3000**

> ⏳ ครั้งแรกถ้าหน้าเว็บขึ้น "รอ database พร้อม..." ให้รอ 10–20 วินาทีแล้ว refresh (MySQL start ช้ากว่าแอป)

## 🗄 Database

Database ชื่อ `assignment_hub` ถูกสร้างอัตโนมัติจากไฟล์ `init.sql` ตอน start ครั้งแรก ประกอบด้วย 3 ตาราง:

| ตาราง | เก็บอะไร |
|---|---|
| `users` | ข้อมูลผู้ใช้และ provider ที่ใช้ login (google/microsoft) |
| `assignments` | งานทั้งหมด: ชื่องาน วิชา แพลตฟอร์ม deadline เวลาที่คาดว่าจะใช้ สถานะ |
| `notification_settings` | การตั้งค่าแจ้งเตือนของแต่ละผู้ใช้ |

เช็คข้อมูลใน database:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub -e "SHOW TABLES; SELECT * FROM assignments;"
```

## 📁 Project Structure

```
assignment-hub/
├── docker-compose.yml   # กำหนด services (app + db)
├── init.sql             # สร้าง table + ข้อมูลตัวอย่าง (รันอัตโนมัติครั้งแรก)
└── app/
    ├── Dockerfile       # image ของเว็บแอป
    ├── package.json     # dependencies
    └── index.js         # โค้ดเว็บเซิร์ฟเวอร์
```

## 🔧 คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `docker compose up --build` | build + รันทั้งหมด |
| `Ctrl + C` แล้ว `docker compose down` | หยุดทั้งหมด |
| `docker compose down -v` | หยุด + ลบข้อมูล DB (ใช้เมื่อแก้ `init.sql` แล้วต้องการให้รันใหม่) |

> ⚠️ `init.sql` รันเฉพาะตอนสร้าง database ครั้งแรกเท่านั้น ถ้าแก้ไฟล์แล้ว table ไม่เปลี่ยน ให้ `docker compose down -v` ก่อนแล้ว `up` ใหม่

