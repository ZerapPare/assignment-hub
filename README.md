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
| HTTPS (เฉพาะตอน deploy) | Cloudflare + init.d gateway ข้างหน้า VM · Caddy 2 เป็น reverse proxy http ธรรมดาบน VM |

## โครงสร้าง services

**บนเครื่องตัวเอง — 3 services**

```
Browser  →  frontend (:4173, Vite)  →  backend (:3000, Express)  →  db (:3306, MySQL)
```

**บนเซิร์ฟเวอร์ — HTTPS จบที่ Cloudflare แล้วผ่าน Caddy บน VM**

```
Browser ──https──► Cloudflare ──► init.d ──http──► VM :4173 (caddy) ──► frontend ──/api──► backend ──► db
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
- **Google** — [Google Cloud Console](https://console.cloud.google.com/) → OAuth consent screen (External + ใส่อีเมลตัวเองเป็น Test user) → Credentials → OAuth client ID (Web) → redirect URI: `http://localhost:4173/api/auth/google/callback`
  - ต้องเปิด **Google Classroom API** และเพิ่ม scope `classroom.courses.readonly`, `classroom.coursework.me.readonly`, `classroom.student-submissions.me.readonly` ด้วย ไม่งั้นปุ่มซิงก์จะไม่ทำงาน
- **Microsoft** — [Azure Portal](https://portal.azure.com/) → App registrations → New registration → เพิ่ม Web redirect URI: `http://localhost:4173/api/auth/microsoft/callback` แล้วสร้าง client secret

> ยังไม่ใส่ก็รันได้ แต่กดปุ่ม login แล้วจะ error จนกว่าจะมี `.env.local`

### 3. รันด้วย Docker Compose

```bash
docker compose up --build
```

รอจนเห็น log ประมาณนี้:

```
backend-1   | Backend API running on http://localhost:3000
frontend-1  | ➜  Local:   http://localhost:4173/
db-1        | ... ready for connections
```

### 4. เปิดใช้งาน

เปิดเบราว์เซอร์ไปที่ **http://localhost:4173**

จะเจอหน้า **login** ก่อน → กด "เข้าสู่ระบบด้วย Google/Microsoft" → ไปหน้า consent ของ provider → กลับมาที่ **dashboard** (ระบบสร้าง user ในตาราง `User_Account` + เก็บ token ให้อัตโนมัติ) กด "ออกจากระบบ" ที่ sidebar เพื่อออก

**ครั้งแรก dashboard จะว่างเปล่า** เพราะ database ไม่มีข้อมูลตัวอย่าง — ตั้งวันที่ในช่อง "งานตั้งแต่วันที่"
แล้วกด **"ซิงก์ Classroom"** เพื่อดึงงานจริงจากบัญชี Google ของคุณเข้ามา

> ครั้งแรก MySQL start ช้ากว่าแอป ถ้าหน้า dashboard ขึ้น "รอ database พร้อม..." ให้รอ 10–20 วิ แล้ว refresh
>
> dev ใช้ session แบบ in-memory — backend restart (เช่นตอนแก้โค้ด) จะ logout เอง เป็นเรื่องปกติ

## หน้าจอ

| Path | หน้า |
|---|---|
| `/login` | หน้าเข้าสู่ระบบ (Google / Microsoft) |
| `/home` | Dashboard — การ์ดสถิติ 4 ใบ, กราฟแท่ง 7 วันข้างหน้า, โดนัทสถานะงาน, ปฏิทิน, กำหนดส่งใกล้ถึง, checklist งานด่วน |
| `/assignments` | งานทั้งหมด — ตารางงาน: ค้นหา + กรองตามแพลตฟอร์ม/สถานะ/รายวิชา, เปลี่ยนสถานะ, แก้ไข/ลบงานที่เพิ่มเอง |
| `/assignments/:id` | รายละเอียดงานชิ้นเดียว — เข้าจากการกดชื่องานในตาราง |
| `/stream` | ประกาศจาก Classroom + กรองตามรายวิชา |
| `/schedule` | จัดตาราง — เวลาเริ่มทำงานแต่ละวัน, พักเที่ยง, เวลาที่คาดว่าใช้ต่องาน, ปุ่มจัดตารางอัตโนมัติ |
| `/weekly` | ตารางที่จัดแล้วแบบรายสัปดาห์ (เข้าจากปุ่มในหน้า `/schedule`) |
| `/settings` | ตั้งค่า — โปรไฟล์, แก้รหัสนักศึกษา, **การแจ้งเตือน**, สถานะเชื่อมต่อ Google/Microsoft |
| `/admin/*` | คอนโซลผู้ดูแลระบบ — ต้องมี role `admin` (ดู [Admin access](#admin-access)) |

ทุกตัวเลขบนหน้า dashboard คำนวณจาก response ของ `/api/assignments` จริง ไม่มีข้อมูลตัวอย่างฝังในโค้ด
(บัญชีที่ยังไม่ซิงก์จะเห็น `0` และ empty state ทุกการ์ด)

**`+ เพิ่มงานใหม่`** (มีทั้งบน dashboard และหน้างานทั้งหมด) เปิด `AddTaskModal` แล้ว `POST` ไป
`/api/assignments` — แถวที่สร้างถูกใส่กลับเข้า state ตัวเดียวกับที่ `useMemo` อ่าน ทุกการ์ด กราฟ
จุดบนปฏิทิน และรายการจึงอัปเดตพร้อมกันโดยไม่ต้อง refetch
งานที่เพิ่มเองเก็บใต้ `Course` ที่ `platform_source IS NULL` ซึ่งตรงกับแท็บ `เพิ่มเอง`

## หน้างานทั้งหมด (`/assignments`)

ตารางงานอยู่หน้านี้หน้าเดียว **ไม่ได้อยู่บน dashboard แล้ว** — dashboard เหลือเฉพาะส่วนสรุป
(การ์ดสถิติ, กราฟ, ปฏิทิน, กำหนดส่งใกล้ถึง, งานด่วน) เข้าถึงได้จากเมนู `งานทั้งหมด` ใน sidebar

- **ค้นหา** จากชื่องาน · รายวิชา · คำอธิบาย
- **กรอง** ได้ 3 ชั้นพร้อมกัน — แท็บแพลตฟอร์ม (`ทั้งหมด` / `Classroom` / `Teams` / `เพิ่มเอง`),
  dropdown สถานะ, dropdown รายวิชา
- **ปุ่มแก้ไข / ลบ** ในแถว ขึ้นเฉพาะงานที่เพิ่มเอง — เปิด `EditTaskModal` (`PATCH /api/assignments/:id`)
  หรือลบทิ้ง (`DELETE /api/assignments/:id`) งานที่ซิงก์มาจาก Classroom แก้/ลบไม่ได้ ให้แพลตฟอร์มเป็นเจ้าของข้อมูล

โค้ดที่สองหน้าใช้ร่วมกันแยกไว้ที่ [`src/tasks.js`](frontend/src/tasks.js) (ชุดสถานะ, ตัวกรอง, ตัวจัดรูปแบบวันที่,
กติกาว่างานแบบไหนนับว่า "เสร็จ") และ [`src/useAssignments.js`](frontend/src/useAssignments.js)
(ดึงข้อมูล, เด้งไป `/login` เมื่อ `401`, handler เปลี่ยนสถานะ/ลบ/แก้ไข)
ถ้าจะเพิ่มสถานะใหม่หรือแก้วิธีแก้ไขงาน ให้แก้ที่สองไฟล์นี้ที่เดียว ทั้งสองหน้าจะตามไปเอง

### สถานะงาน (UC-5)

ช่องสถานะในตารางเป็น dropdown เลือกได้ 4 ค่า — `ยังไม่เริ่ม` · `กำลังทำ` · `ส่งแล้ว` · `เสร็จสมบูรณ์`
เลือกแล้วยิง `PATCH /api/assignments/:id/status` ทันที **ใช้ได้กับงานที่ซิงก์มาด้วย** เพราะสถานะถือเป็น
ความคืบหน้าส่วนตัวของนักศึกษา ไม่ใช่ข้อมูลของงานที่แพลตฟอร์มเป็นเจ้าของ

ครั้งแรกที่ตั้งสถานะเอง คอลัมน์ `Assignment_Detail.status_updated_at` จะเปลี่ยนจาก `NULL` เป็นเวลาที่กด
และตั้งแต่นั้น **ซิงก์จะไม่ทับสถานะนั้นอีก** (ก่อนหน้านั้น Google เป็นคนตั้งให้ — งานที่ `TURNED_IN`/`RETURNED`
มาเป็น `ส่งแล้ว`) งานที่ `ส่งแล้ว` หรือ `เสร็จสมบูรณ์` จะหลุดออกจากการ์ด "งานด่วน" และ checklist 48 ชม.

> ถ้ายิงไม่สำเร็จ error จะขึ้นในแถวนั้นแถวเดียว สถานะเดิมค้างไว้ ส่วนที่เหลือของหน้าไม่หาย

## การแจ้งเตือน (หน้าตั้งค่า)

การ์ด **การแจ้งเตือน** ใน `/settings` ให้ตั้งว่าจะให้เตือนก่อนกำหนดส่งล่วงหน้าเท่าไร

การ์ดแบ่งเป็น 2 กลุ่ม — **แจ้งเตือนประกาศ** ไว้บน **แจ้งเตือนงาน** ไว้ล่าง — ใต้สวิตช์หลักที่คุมทั้งใบ

- **สวิตช์หลัก** ปิดแล้วส่วนตั้งค่าจะจาง และสวิตช์ของทั้งสองกลุ่มแสดงเป็นปิดตามไปด้วย
  ค่าที่เก็บไว้ไม่ถูกแตะ — เปิดกลับมาเมื่อไรก็เด้งกลับเป็นค่าเดิม
- **แจ้งเตือนประกาศใหม่** — ส่งอีเมลเมื่อมีประกาศใหม่ในวิชาที่ซิงก์มาจาก Classroom
- **ช่วงเวลาล่วงหน้า** เลือกได้หลายค่าพร้อมกัน — preset `1 ชั่วโมง` · `3 ชั่วโมง` · `1 วัน` · `3 วัน`
  และ `+ กำหนดเอง` (ใส่ตัวเลข + หน่วย นาที/ชั่วโมง/วัน ได้ถึง 28 วัน) ค่ากำหนดเองที่เลือกอยู่จะขึ้นเป็นชิปให้กดเอาออกได้
- **แจ้งเตือนซ้ำรายวัน** + เวลาที่จะส่ง สำหรับงานที่ยังไม่เสร็จ
- กด `บันทึกการตั้งค่า` เพื่อเขียนลง database

> **ปุ่มบันทึกกดได้เสมอ** และอยู่นอกส่วนที่จาง — เดิมมันจางตามสวิตช์หลักและจางอีกทีเมื่อไม่มีอะไรเปลี่ยน
> จนดูเหมือนกดไม่ได้ คนจึงปิดแจ้งเตือนแล้วไม่กล้ากดบันทึก ค่าเลยไม่เคยถูกเก็บและอีเมลยังส่งต่อ
> ตอนนี้บอกด้วยข้อความว่า "ยังไม่ได้บันทึกการเปลี่ยนแปลง" แทนการหรี่ปุ่ม

ทุกค่าเก็บเป็น**นาที** ทั้ง preset และค่ากำหนดเอง จึงไม่ต้องมีคอลัมน์หน่วย และเทียบกับ `due_date` ได้ตรง ๆ

### แจ้งเตือนประกาศใหม่

ตัวส่งดูจาก `Announcement.created_at` (เวลาที่ระบบเห็นประกาศครั้งแรก ไม่ใช่เวลาที่อาจารย์โพสต์) คู่กับ `posted_at`
จะส่งก็ต่อเมื่อ**เพิ่งเห็นภายใน 24 ชม. และโพสต์ไล่เลี่ยกับตอนที่เห็น (ห่างไม่เกิน 2 วัน)**

เงื่อนไขคู่นี้จำเป็น เพราะการซิงก์ครั้งแรกของวิชาเก่าจะดึงประกาศทั้งเทอมเข้ามาพร้อมกัน โดยที่ `created_at`
เป็นตอนนี้ทั้งหมด — ถ้าดูแค่ `created_at` อย่างเดียว นักศึกษาจะได้อีเมลย้อนหลังเป็นร้อยฉบับในครั้งเดียว

> ประกาศจะเข้าระบบเฉพาะตอนกด **ซิงก์ Classroom** เท่านั้น ยังไม่มี background sync
> อีเมลจึงออกหลังจากกดซิงก์ ไม่ใช่ทันทีที่อาจารย์โพสต์

### ตัวส่งอีเมล (FR-07)

`backend/src/services/notificationSender.js` เดินรอบละ 5 นาที ส่งอีเมลเตือนล่วงหน้าตาม lead time
ที่ตั้งไว้ ข้ามงานที่ `submitted` / `completed` และไม่ส่งถ้าเลยกำหนดไปแล้ว ปุ่ม `ส่งอีเมลทดสอบ`
ใช้งานได้แล้วผ่าน `POST /api/notification-settings/test`

ตั้งค่า SMTP ใน `.env.local` (`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM`)
**ถ้าไม่ตั้ง ระบบจะพิมพ์อีเมลลง log แทนการส่งจริง** ทำให้รันทดสอบได้โดยไม่ต้องมีบัญชี SMTP
ดูรายละเอียดที่ [PROJECT_SETUP.md](PROJECT_SETUP.md#email-reminders-fr-07)

ถ้าส่งไม่สำเร็จ ระบบจะลองใหม่ **3 ครั้ง ห่าง 5 / 30 / 120 นาที** ระหว่างนั้นแบนเนอร์ "ส่งอีเมลไม่สำเร็จ"
จะยังไม่ขึ้น — ขึ้นต่อเมื่อลองครบแล้วยังไม่สำเร็จ ทุกครั้งที่ล้มเหลวบันทึกลง `System_Error_Log`

**แจ้งเตือนซ้ำรายวัน** (FR-07.2) เปิดได้ที่หน้าตั้งค่า ส่ง 1 ฉบับต่องานที่ยังไม่เสร็จ วันละครั้งตามเวลาที่เลือก
เฉพาะงานที่ครบกำหนด**ภายใน 7 วัน** (รวมที่เลยกำหนดมาแล้วไม่เกิน 7 วัน ซึ่งจะใช้ข้อความคนละแบบ)
กรอบนี้มีไว้กันไม่ให้คนมีงานค้าง 30 ชิ้นได้เมล 30 ฉบับทุกเช้า

หน้าตั้งค่ายังแสดง**รายการงานที่จะได้รับการแจ้งเตือน** แบบอ่านอย่างเดียว เพื่อให้เห็นว่าค่าที่ตั้งไว้มีผลกับงานไหนบ้าง

ส่วนที่ยังไม่พร้อมใช้:

- **checklist "งานด่วน"** — แสดงอย่างเดียว กดติ๊กในนั้นไม่ได้ (เปลี่ยนสถานะได้ที่หน้า `งานทั้งหมด`)
- **ช่อง "วิชา" ใน modal แก้ไข** — แก้แล้วไม่มีผล `PATCH /api/assignments/:id` ยังไม่รับ `course_name`

## Database

Database ชื่อ `assignment_hub` ถูกสร้างอัตโนมัติจาก `init.sql` ตอน start ครั้งแรก มี 21 ตาราง:

| ตาราง | เก็บอะไร |
|---|---|
| `University` | มหาวิทยาลัย + โดเมนอีเมล |
| `User_Account` | ผู้ใช้ทุกคน ทั้งนักศึกษาและผู้ดูแล อยู่ตารางเดียวกัน + token สำหรับ login (Google/Microsoft) |
| `Role` | บทบาท — มีแค่ `admin` กับ `student` |
| `Permission` | สิทธิ์ย่อยแบบ `resource` + `action` เช่น `user.suspend` |
| `Role_Permission` | บทบาทไหนมีสิทธิ์อะไรบ้าง (m:n) |
| `User_Role` | ผู้ใช้คนไหนถือบทบาทอะไร (m:n) |
| `Schedule_Setting` | **ไม่มีโค้ดไหนใช้** — สร้างจาก migration `010` แต่ตัวจัดตารางไปอ่าน 2 ตารางล่างแทน |
| `User_Settings` | เวลาพักเที่ยงที่ตัวจัดตารางใช้ (คอลัมน์ `working_hours_start/end` เก็บไว้แต่ไม่ถูกอ่าน) |
| `Working_Hours` | เวลาเริ่มทำงานรายวัน (0 = อาทิตย์) — วันที่ไม่มีแถวจะไม่ถูกจัดงานลง |
| `Announcement` | ประกาศที่ดึงมาจาก Classroom |
| `Product_Event` | event การใช้งานแบบ metadata ปลอดภัยสำหรับ business analytics |
| `Course` | รายวิชา + แพลตฟอร์มต้นทาง (Classroom/Teams) |
| `Assignment` | งาน: ชื่อ, ประเภท (`task_type`), ลิงก์ต้นทาง, วิชา |
| `Assignment_Detail` | รายละเอียด: คำอธิบาย, deadline, สถานะ, `status_updated_at`, priority |
| `Schedule` | ช่วงเวลาที่ตัวจัดตารางอัตโนมัติวางไว้ (แตกเป็นหลายช่วงได้ใน `segments`) |
| `Notification` | บันทึกการส่งอีเมลเตือนแต่ละฉบับ — ตัวส่งอีเมลใช้เป็นตัวกันส่งซ้ำและนับ retry |
| `Notification_Setting` | ตั้งค่าการแจ้งเตือนของนักศึกษา (เปิด/ปิด, ซ้ำรายวัน + เวลา, ค่ากำหนดเองล่าสุด) |
| `Notification_Lead_Time` | ช่วงเวลาล่วงหน้าที่เลือกไว้ เก็บเป็นนาที 1 แถวต่อ 1 ค่า |
| `System_Error_Log` | error log ที่ตัดข้อมูลลับออกแล้ว |
| `Admin_Audit_Log` | ประวัติการกระทำของผู้ดูแลระบบ |
| `System_Request_Metric_Hourly` | aggregate metrics ของ request รายชั่วโมง |

เช็คข้อมูลใน database:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub -e "SHOW TABLES; SELECT title, status FROM Assignment a JOIN Assignment_Detail d USING(assignment_id);"
```

### Migrations

`init.sql` รันครั้งเดียวตอนสร้าง database ใหม่เท่านั้น **database ที่มีอยู่แล้วจะไม่ได้ schema ใหม่ตามไปด้วย**
ไฟล์ใน `migrations/` ต้องรันตามลำดับกับ database เดิม และเป็น one-time migrations
(ไม่ควรรันซ้ำบนฐานข้อมูลที่ใช้ migration นั้นไปแล้ว — จะขึ้น error ของไฟล์ที่ลงไปแล้ว ซึ่งไม่เป็นอันตราย)

สคริปต์จะวนรันทุกไฟล์ใน `migrations/` ตามชื่อ ไม่ได้ไล่รายชื่อไว้ในสคริปต์ — ของเดิมไล่รายชื่อแล้วหยุดอยู่ที่ `009`
ทำให้ `010` กับ `011` ไม่เคยถูกรัน และ database หลายเครื่องขาดคอลัมน์ที่โค้ดเรียกใช้อยู่ เพิ่ม migration ใหม่แล้วไม่ต้องแก้สคริปต์

```bash
./migrate.sh        # macOS / Linux / Git Bash
migrate.bat         # Windows cmd
```

| ไฟล์ | เพิ่มอะไร |
|---|---|
| `001_identity.sql` | unique `University.email_domain` + unique `Student (student_id, university_id)` |
| `002_task_type.sql` | `Assignment.task_type` |
| `003_status_updated_at.sql` | `Assignment_Detail.status_updated_at` — **อย่า backfill** ค่านี้ `NULL` แปลว่า "นักศึกษายังไม่เคยตั้งสถานะเอง" ถ้าใส่ค่าให้ทุกแถว ซิงก์จะหยุดอัปเดตสถานะจาก Classroom ทั้งหมด |
| `004_admin_monitoring.sql` | role/status ของ Student + system error/audit/request metric tables |
| `005_announcement.sql` | ตาราง `Announcement` (ประกาศจาก Classroom) |
| `006_product_analytics.sql` | ตาราง `Product_Event` สำหรับ business analytics |
| `007_admin_identity.sql` | ตาราง `Admin` + ย้าย identity ผู้ดูแลออกจาก Student |
| `008_score.sql` | `Assignment_Detail.max_points` + `assigned_grade` |
| `009_admin_microsoft_identity.sql` | immutable Microsoft tenant/object IDs สำหรับ Admin |
| `010_schedule_setting.sql` | ตาราง `Schedule_Setting` สำหรับจัดตารางอัตโนมัติ |
| `011_assignment_time_estimate.sql` | `Assignment_Detail.time_estimate` — database ที่สร้างก่อนคอลัมน์นี้จะทำให้ `/api/assignments` ตอบ `ER_BAD_FIELD_ERROR` |
| `012_rbac.sql` | ยุบ `Student`/`Admin` เหลือ `User_Account` ตารางเดียว + `Role`/`Permission`/`Role_Permission`/`User_Role` และ 2 บทบาท (`admin`, `student`) · รวมหน้า login เป็นหน้าเดียว |
| `013_notifications.sql` | ตาราง `Notification_Setting` + `Notification_Lead_Time` · unique key กันส่งอีเมลซ้ำ + คอลัมน์ retry บน `Notification` · แจ้งเตือนประกาศใหม่พร้อมสวิตช์เปิด/ปิด |

**012 กับ 013 เป็นไฟล์ที่รวมมาจากหลายไฟล์** — เดิม RBAC และการแจ้งเตือนแยกเป็นเรื่องละ 3 ไฟล์
รันเรียงกันแล้วทำงานทับล้างกันเอง (ไฟล์แรกสร้าง `User_Account` เป็น supertype แล้วไฟล์ถัดมาทิ้งตารางนั้น ·
role ที่เพิ่งสร้างถูกเปลี่ยนชื่อทันทีในไฟล์ถัดไป) ตอนนี้แต่ละเรื่องเหลือไฟล์เดียวที่ทำตรงทาง

`013` ต้องอยู่หลัง `012` เพราะ `Notification_Setting` ชี้ `User_Account` ซึ่งเกิดหลังการยุบตารางใน `012`
และฝั่งประกาศต้องรอตาราง `Announcement` จาก `005`

> **เรียงเลขใหม่เมื่อ 2026-10-07** ให้ต่อเนื่อง `001`–`013` และไม่มีเลขซ้ำ ลำดับการรันเหมือนเดิมทุกไฟล์
> database ที่มีอยู่จึงไม่ได้รับผลกระทบ (สคริปต์ไม่ได้จำว่ารันไฟล์ไหนไปแล้ว)
> เลขเก่า → ใหม่: `005_admin_monitoring` → `004` · `006_announcement` → `005` · `007_score` → `008` ·
> `008_admin_microsoft_identity` → `009` · `015_notifications` → `013`
> **migration ถัดไปใช้เลข `014`**

> **ทุกขั้นใน `012` และ `013` มี guard** เช็ก `information_schema` ก่อนทำ รันซ้ำจึงไม่ error และไม่เปลี่ยนอะไร
> ต่างจากไฟล์ `001`–`011` ที่เป็น `ALTER TABLE` เปล่า ๆ รันซ้ำแล้วขึ้น `Duplicate column name` (ไม่เป็นอันตราย)

เช็คว่าลงครบ:

```bash
docker compose exec db mysql -uroot -proot123 assignment_hub -e "DESCRIBE Assignment; DESCRIBE Assignment_Detail;"
```

### Admin access

**Everyone signs in at `/login`.** There is no separate admin login page and no admin allowlist: signing in creates an ordinary account, and it takes a `User_Role` grant to make the console reachable. That grant is what "there is no public admin registration" means now — the person can log in, they simply cannot open `/admin` until somebody gives them a role.

To make an existing account an administrator, have them sign in once, then grant a role:

```sql
-- 'admin' is the full console; 'student' is an ordinary user. Those are the
-- only two roles, and a user holds one of them.
INSERT IGNORE INTO User_Role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM User_Account u
JOIN Role r ON r.role_code = 'admin'
WHERE u.email = 'admin@example.edu';
```

To provision an administrator who has never signed in, create the row first. They still have to log in through `/login` with the matching Google or Microsoft account:

```sql
INSERT INTO User_Account (full_name, email, user_type)
VALUES ('Assignment Hub Admin', 'admin@example.edu', 'admin');
```

Check what an account ended up with:

```sql
SELECT u.email, r.role_code, p.permission_code
FROM User_Account u
JOIN User_Role ur       ON ur.user_id = u.user_id
JOIN Role r             ON r.role_id = ur.role_id
JOIN Role_Permission rp ON rp.role_id = ur.role_id
JOIN Permission p       ON p.permission_id = rp.permission_id
WHERE u.email = 'admin@example.edu';
```

Roles are read from the database on **every** request rather than cached in the session, so granting or revoking one takes effect on the next request without the administrator logging out.

An account holding any administrative permission gets an extra "ผู้ดูแลระบบ" item in the sidebar; `/admin` is also reachable directly. Only the ordinary student callback URLs need registering with Google and Azure — the second pair for `/api/admin/auth/*` is no longer used.

## API (backend)

| Method | Path | ต้อง login? | คืนอะไร |
|---|---|---|---|
| GET | `/api/health` | — | สถานะการต่อ DB |
| GET | `/api/admin/me` | ต้องมีสิทธิ์ฝั่ง admin | ข้อมูลผู้ใช้ที่ login อยู่ + `roles` / `permissions` |
| POST | `/api/admin/auth/logout` | ต้อง login | ออกจากระบบ (session เดียวกับฝั่งนักศึกษา) |
| GET | `/api/admin/dashboard` · `/users` · `/errors` · `/system/*` | ต้องเป็น admin | monitoring console |
| GET | `/api/admin/business/*` | ต้องเป็น admin | business analytics แบบ aggregate |
| GET | `/api/auth/google` · `/microsoft` | — | ส่งไปหน้า consent ของ provider |
| GET | `/api/auth/{provider}/callback` | — | แลก code → สร้าง/อัปเดต user + token → เริ่ม session |
| GET | `/api/me` | ต้อง | ข้อมูล user ที่ login อยู่ + สถานะเชื่อมต่อ Google/Microsoft |
| PATCH | `/api/me` | ต้อง | แก้รหัสนักศึกษา (`409` ถ้าซ้ำในมหาลัยเดียวกัน) |
| POST | `/api/auth/logout` | — | ออกจากระบบ (ลบ session) |
| GET | `/api/assignments` | ต้อง | งาน**ของผู้ใช้ที่ login อยู่** (JOIN course + detail) |
| POST | `/api/assignments` | ต้อง | เพิ่มงานเอง คืน `201` พร้อมแถวที่สร้าง |
| PATCH | `/api/assignments/:id` | ต้อง | แก้งานที่เพิ่มเอง (งานที่ซิงก์มาแก้ไม่ได้ — คืน `404`) |
| PATCH | `/api/assignments/:id/status` | ต้อง | เปลี่ยนสถานะ — **ใช้ได้กับงานที่ซิงก์มาด้วย** |
| DELETE | `/api/assignments/:id` | ต้อง | ลบงานที่เพิ่มเอง คืน `204` (งานที่ซิงก์มาลบไม่ได้ — คืน `404`) |
| GET | `/api/announcements` | ต้อง | ประกาศ Classroom ของผู้ใช้ เรียงใหม่สุดก่อน |
| POST | `/api/classroom/sync` | ต้อง | ดึงงาน**และประกาศ**จาก Google Classroom มาลง DB |
| GET | `/api/notification-settings` | ต้อง | ค่าตั้งการแจ้งเตือน (ยังไม่เคยบันทึก → คืนค่า default) |
| PUT | `/api/notification-settings` | ต้อง | บันทึกค่าตั้งการแจ้งเตือนทั้งชุด |
| POST | `/api/notification-settings/test` | ต้อง | ส่งอีเมลทดสอบ 1 ฉบับไปที่อีเมลของผู้ใช้เอง |
| POST | `/api/analytics/events` | ต้อง | บันทึก event ฝั่ง client ที่อยู่ใน allow-list (ล้มเหลวก็ไม่ error) |
| GET · PUT | `/api/user/working-hours` | ต้อง | เวลาเริ่มทำงานรายวัน `{ "0": "08:00:00" \| null, … }` |
| GET · PUT | `/api/user/settings` | ต้อง | เวลาพักเที่ยง (GET ครั้งแรก**สร้างแถว default ให้**) |
| PATCH | `/api/tasks/:id/duration` | ต้อง* | ตั้งเวลาที่คาดว่าใช้ `time_estimate` 1–1440 นาที |
| GET | `/api/schedule/weekly` | ต้อง | งานที่ถูกจัดหรือครบกำหนดในสัปดาห์ (`?week_start=`) |
| POST | `/api/schedule/generate` | ต้อง | ลบตารางเดิมแล้วจัดงานที่ยังไม่เสร็จลงเวลาว่างใหม่ทั้งหมด |

`ต้อง` = ต้องมี session ไม่งั้นได้ `401` — และทุก query ผูกกับ `student_id` จาก session
ไม่ได้รับ id มาจาก client ผู้ใช้จึงเห็นเฉพาะข้อมูลของตัวเอง

\* `/api/tasks/:id/duration` ไม่มี `requireAuth` ถ้าไม่ได้ login จะได้ `404` แทน `401`

> **route ที่ mount อยู่แต่พัง:** handler อื่นใน `routes/tasks.js` (`/api/tasks`) และ `routes/settings.js`
> (mount ไว้ที่ root ไม่มี prefix) เป็นของเก่าที่อ่าน `req.user.id` ซึ่งไม่มีใครตั้งค่า และ query ตารางที่ไม่มีอยู่จริง
> frontend ไม่ได้เรียกใช้ แต่ `DELETE /api/tasks/:id`, `GET /` และ `PUT /lunch` ไม่มี `try` —
> request เดียวทำให้ backend ล้มได้ ดู [PROJECT_SETUP.md](PROJECT_SETUP.md#routes-that-are-mounted-but-broken)

`POST /api/assignments` รับ `{ title, task_type, course_name, description, due_date }` บังคับแค่ `title`
`task_type` เป็นหนึ่งใน `homework | project | quiz | exam | reading | other` ไม่ใส่ `course_name` จะไปอยู่ใต้วิชา `งานที่เพิ่มเอง`
`PATCH /api/assignments/:id` รับชุดย่อยของ `title` · `task_type` · `description` · `due_date` (ยังไม่รับ `course_name`)

**ทำไม status แยกเป็นอีก route:** `PATCH /:id` จำกัดไว้เฉพาะงานที่เพิ่มเอง เพราะข้อมูลของงานที่ซิงก์มา
ต้องไม่ต่างจากต้นทาง (UR05) แต่ *สถานะ* เป็นของนักศึกษาเอง (A3.3) จึงแก้ได้ทุกงาน
`PATCH /:id/status` รับ `{ "status": "not_started" | "in_progress" | "submitted" | "completed" }`
แล้วเขียนแบบ upsert (แถวที่ยังไม่มี `Assignment_Detail` ก็ตั้งสถานะได้) พร้อมประทับ `status_updated_at`
ซึ่งเป็นตัวบอกให้ซิงก์รอบต่อไป **ไม่ต้องไปยุ่งกับสถานะแถวนั้นอีก**

`PUT /api/notification-settings` รับ `{ enabled, lead_times, daily_repeat, daily_repeat_time, announcement_notify, last_custom_minutes }`
โดย `lead_times` เป็น array ของนาที (1–40320 คือ 28 วัน, ไม่เกิน 10 ค่า) และ `daily_repeat_time` เป็น `"HH:MM"`
เขียนทับทั้งชุดใน transaction เดียว แล้วคืน payload หน้าตาเดียวกับ `GET`

`GET` **ไม่สร้างแถวใน database** ถ้ายังไม่เคยบันทึก — คืนค่า default (`เปิด`, `1 วัน`, `08:00`) ไปเฉย ๆ
แถวจะเกิดตอนกดบันทึกครั้งแรกเท่านั้น ตารางที่ว่างจึงแปลว่า "ยังไม่มีใครตั้งค่า" ได้จริง
ทั้งสอง endpoint คืน `failed_count` / `last_failed_at` ด้วย นับจากแถว `Notification` ที่ตัวส่งอีเมลบันทึกว่าล้มเหลว (`is_sent = FALSE` และมี `sent_at`)

`/api/classroom/sync` รับ body `{ "cutoffDate": "YYYY-MM-DD" | null }` (เอาเฉพาะงานที่กำหนดส่งตั้งแต่วันนั้น
งานและประกาศเก่ากว่านั้นที่เคยซิงก์ไว้จะถูกลบ) แล้วคืน `{ ok, coursesSynced, assignmentsSynced, announcementsSynced, deletedCount, skippedCourses }`
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
├── migrations/          # ALTER สำหรับ database ที่สร้างไปแล้ว (001–013)
├── migrate.sh           # รัน migration ทั้งหมดเรียงตามลำดับ (มี .bat สำหรับ Windows)
├── backend/             # Express API + mysql2 + OAuth + Classroom sync
│   ├── server.js        # entry บาง ๆ — ตั้ง session แล้ว mount router
│   └── src/
│       ├── config.js    # รวม env var ไว้ที่เดียว
│       ├── db.js        # mysql2 pool ตัวเดียวที่ทุก route ใช้ร่วมกัน
│       ├── routes/      # health, auth, me, assignments, announcements, classroom,
│       │                # notifications, analytics, schedules, workingHours, admin*
│       │                # (+ tasks, settings — ของเก่าที่พังเกือบทั้งไฟล์)
│       ├── services/    # classroomSync, identity, oauthSession, notificationSender,
│       │                # mailer, analytics, adminMetrics, businessMetrics, rbac, ...
│       ├── utils/       # dueDate — แปลง datetime-local เป็น DATETIME ตามเวลาที่ผู้ใช้พิมพ์
│       └── middleware/  # requireAuth, requireAdmin, permissions, errorHandler, metrics
└── frontend/            # React + Vite + react-router
    └── src/
        ├── App.jsx          # router: /login, /home, /assignments, /stream, /schedule,
        │                    # /weekly, /settings, /admin/*
        ├── theme.js         # design token (สี, ฟอนต์, radius, ชื่อวัน/เดือนไทย)
        ├── tasks.js         # สถานะงาน, ตัวกรอง, ตัวจัดรูปแบบวันที่ — ใช้ร่วมทุกหน้า
        ├── useAssignments.js # hook: ดึงงาน + handler เปลี่ยนสถานะ/ลบ/แก้ไข
        ├── GlobalStyles.jsx # โหลดฟอนต์ Maitree + base CSS
        ├── pages/           # LoginPage, HomePage, AssignmentsPage, AssignmentDetailPage,
        │                    # StreamPage, Schedule, WeeklyView, SettingsPage, admin/
        ├── components/      # Sidebar, StatCard, AssignmentTable, TaskRow, BarChart,
        │                    # DonutChart, Calendar, DeadlineList, UrgentChecklist,
        │                    # AddTaskModal, EditTaskModal, NotificationSettings,
        │                    # Toggle, ProviderButton, BrandMark, AutoScheduleButton,
        │                    # LunchTimeSetting, WeeklyCalendar, AdPopup, admin/
        └── icons/           # Google/Microsoft SVG + ไอคอน UI (index.jsx)
```

> สี/ฟอนต์/ระยะทั้งหมดอ่านจาก `theme.js` ที่เดียว ถ้าจะปรับธีมให้แก้ที่นั่น อย่าฮาร์ดโค้ด hex ในคอมโพเนนต์

## Deploy บนเซิร์ฟเวอร์ (HTTPS ผ่านโดเมน)

ค่า default ทั้งหมดตั้งไว้สำหรับ `localhost:4173` — local dev ไม่ต้องแตะอะไรเลย

**ทำไมต้อง HTTPS:** Google ไม่รับ OAuth redirect URI ที่เป็น `http://` กับโดเมนจริง (อนุญาตเฉพาะ `localhost`)

### เส้นทางของ request บน VM จริง

```
Browser ──https──► Cloudflare ──► init.d gateway ──http──► VM :4173 ──► Caddy :80 ──► frontend :4173 ──/api──► backend
                   (ถือ cert)      (192.168.15.225)                      (ในเครื่อง)
```

- **HTTPS จบที่ Cloudflare** — Caddy ไม่ได้ขอ cert เอง (ขอไม่ได้ด้วย เพราะ Let's Encrypt ไปเจอ Cloudflare ไม่ถึง VM)
- **init.d ส่งต่อมาที่พอร์ต 4173 ของ VM แบบตายตัว** เราแก้ฝั่งนั้นไม่ได้ จึงให้ Caddy รับพอร์ต 4173 แทน
  แล้วย้ายพอร์ตของ frontend บน host ไป 4174 (`FRONTEND_PORT`)
- **Caddy ใส่ `X-Forwarded-Proto: https` ให้ทุก request** — ถ้าไม่ใส่ backend จะคิดว่าเป็น http
  แล้วไม่ตั้ง session cookie (`Secure`) → login แล้วเด้งกลับ `/login`

### 1. สร้างไฟล์ `.env` ที่ root

(คนละไฟล์กับ `.env.local` — อันนี้ Docker Compose อ่านเอง, git-ignored เหมือนกัน)

```env
PUBLIC_URL=https://assignment-hub.cskmitl.com
BIND=127.0.0.1
FRONTEND_PORT=4174
```

| ค่า | ถ้าไม่ใส่ |
|---|---|
| `PUBLIC_URL` | login เด้งกลับไป `http://localhost:4173` เพราะ redirect URI ใช้ค่า default |
| `BIND=127.0.0.1` | MySQL (`root123`) และ backend เปิดให้เครื่องอื่นในวง `192.168.15.x` เข้าได้ |
| `FRONTEND_PORT=4174` | `up` ล้มด้วย `port is already allocated` เพราะชนกับ Caddy ที่ 4173 |

เมื่อ `PUBLIC_URL` เป็น `https://` จะมีผลตามมาอัตโนมัติ 2 อย่าง:
- **`.env.local` ต้องมี `SESSION_SECRET`** — ถ้าไม่มี backend จะไม่ยอมสตาร์ท (ดู `docker compose logs backend`)
- **session cookie ถูกตั้งเป็น `Secure`** — ต้องพึ่ง header `X-Forwarded-Proto` ที่ Caddy ใส่ให้

ทุก service ตั้ง `restart: unless-stopped` ไว้ ถ้า backend ล้มหรือ VM reboot ระบบจะกลับขึ้นมาเอง
(ต้อง `sudo systemctl enable docker` ครั้งเดียว และอย่า `docker compose stop` ก่อนปิดเครื่อง)

### 2. เพิ่มโดเมนใน `allowedHosts`

ที่ [`frontend/vite.config.js`](frontend/vite.config.js) ไม่งั้น Vite ตอบ `403 Blocked request`
(ตอนนี้มี `assignment-hub.cskmitl.com` อยู่แล้ว)

### 3. รันด้วย profile `tls`

```bash
docker compose --profile tls up -d --build
docker compose ps                         # ต้อง Up ครบ 4 ตัว
curl -sI http://127.0.0.1:4173/ | head -1 # ต้องได้ 200 — นี่คือทางที่ init.d เข้ามา
```

ชื่อ profile ยังเป็น `tls` จากของเดิม ถึง Caddy จะไม่ได้ทำ TLS แล้ว

### 4. ลงทะเบียน redirect URI

- **Google Cloud Console** → Credentials → OAuth client → `https://<โดเมน>/api/auth/google/callback`
- **Azure Portal** → App registrations → Authentication → `https://<โดเมน>/api/auth/microsoft/callback`

ต้องตรงเป๊ะทุกตัวอักษร ไม่งั้นได้ `redirect_uri_mismatch`

### ถ้าเว็บขึ้น `502` ของ Cloudflare

แปลว่า init.d ต่อเข้า VM ไม่ติด ดักดูว่ามันยิงเข้าพอร์ตไหน (แล้ว refresh เว็บ):

```bash
sudo tcpdump -ni eth0 'tcp[tcpflags] & tcp-syn != 0 and not port 22' -c 5
```

ต้องเห็น `> 192.168.15.206.4173` — ถ้าเป็นพอร์ตอื่น ให้ตั้ง `PROXY_PORT=<พอร์ตนั้น>` ใน `.env` แล้ว `up -d --force-recreate`
ถ้าไม่มีอะไรขึ้นเลย init.d ไม่ได้ส่งมาที่ VM ตัวนี้

### อัปเดตโค้ดหลัง deploy แล้ว

ซอร์สถูก mount เข้า container อยู่ (`./frontend:/app`, `./backend:/app`) แต่สองฝั่งโหลดใหม่ไม่เหมือนกัน:
backend ใช้ `node --watch` ส่วน frontend รัน **`vite preview`** ที่เสิร์ฟ `frontend/dist` ซึ่ง build ไว้แล้ว
**ไม่มี HMR** — แก้ `.jsx` แล้วต้อง `npm run build` และ commit `dist/` ไปด้วย ไม่งั้นเซิร์ฟเวอร์ยังเสิร์ฟของเก่า

| แก้อะไร | ต้องทำ |
|---|---|
| โค้ด frontend (`.jsx`, `.css`) | `cd frontend && npm run build` แล้ว commit `dist/` — บนเซิร์ฟเวอร์แค่ `git pull` |
| โค้ด backend (`.js`, `server.js`) | ปกติไม่ต้องทำอะไร แต่ `node --watch` มักไม่เห็นไฟล์ที่มาทาง bind mount → `docker compose restart backend` |
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
| `docker compose down -v` | หยุด + ลบข้อมูล DB (ใช้เมื่อแก้ `init.sql`) — **บนเซิร์ฟเวอร์ข้อมูลผู้ใช้หายหมด** |
| `docker compose rm -fsv <service>` | ลบ service + anonymous volume (ใช้ตอนเพิ่ม npm package) |
| `docker compose logs -f backend` | ดู log backend |
| `./migrate.sh` · `migrate.bat` | รัน migration ทั้งหมดกับ database ที่มีอยู่แล้ว |

> `init.sql` รันเฉพาะตอนสร้าง database ครั้งแรก ถ้าแก้ไฟล์แล้ว table ไม่เปลี่ยน ให้ `docker compose down -v` ก่อนแล้ว `up` ใหม่
> — **บนเซิร์ฟเวอร์อย่าทำ** ข้อมูลผู้ใช้ทั้งหมดจะหาย ให้เขียน migration แทน

## เจอปัญหาบ่อย

| อาการ | สาเหตุ |
|---|---|
| `403 Blocked request. This host is not allowed` | โดเมนไม่อยู่ใน `allowedHosts` ของ [vite.config.js](frontend/vite.config.js) — เพิ่มแล้วต้อง restart frontend |
| `ERR_CONNECTION_REFUSED` | ไม่มีอะไรฟังพอร์ตนั้น เช็ค `docker compose ps` · **refused = firewall ผ่านแต่ไม่มีคนฟัง / timeout = โดน firewall บล็อก** |
| `/api/*` เป็น `500` ทุกเส้น | request ไปไม่ถึง Express — `/api/health` คืนได้แค่ `200`/`503` ถ้าได้ `500` แปลว่า Vite proxy ต่อ `backend:3000` ไม่ติด ดู `docker compose logs backend` |
| `Cannot find module '<pkg>'` | anonymous volume บัง `node_modules` ใหม่ → `docker compose rm -fsv backend` แล้ว `up -d --build` |
| `Unknown column 'status_updated_at'` / `'task_type'` | database เก่าที่สร้างก่อนแก้ `init.sql` — `init.sql` ไม่รันซ้ำ ต้องรัน `./migrate.sh` (หรือ `migrate.bat`) เอง |
| เปลี่ยนสถานะแล้วซิงก์รอบถัดไปทับกลับ | `status_updated_at` ของแถวนั้นยังเป็น `NULL` แปลว่า `PATCH /:id/status` ไม่ได้เขียนลงไปจริง เช็ค log backend |
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
