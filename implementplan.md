# Admin Monitoring & User Management — Implementation Plan

## 1. เป้าหมาย
สร้างพื้นที่ `/admin` สำหรับผู้ดูแล Assignment Hub เพื่อ monitor สุขภาพระบบ, ดูสถิติการใช้งาน, ตรวจสอบ error และจัดการบัญชีผู้ใช้ โดยต่อยอดจาก React/Vite + Express + MySQL ที่มีอยู่ ไม่สร้าง monitoring stack แยกเกินความจำเป็นใน MVP

### Admin ต้องตอบคำถามได้เร็ว
- ตอนนี้มีผู้ใช้ทั้งหมดกี่คน และเพิ่มขึ้นเท่าไร
- มีผู้ใช้ active วันนี้ / 7 วัน / 30 วันกี่คน
- ระบบ API + Database ปกติหรือไม่
- ช่วงนี้มี error เพิ่มขึ้นหรือไม่ และ error อะไรเกิดบ่อย
- ผู้ใช้คนไหนมีปัญหา sync/login บ่อย
- ค้นหา ดูรายละเอียด ระงับ และเปิดใช้งาน user ได้

## 2. Scope
### MVP
1. Admin authentication/authorization
2. Admin Dashboard
3. Error Log Explorer
4. User Management
5. System health + basic request/error metrics
6. Audit log สำหรับ action ที่ admin ทำ

### Out of scope รอบแรก
- Prometheus/Grafana/ELK/Sentry แบบเต็มระบบ
- Real-time websocket dashboard
- Advanced distributed tracing
- Billing/financial analytics
- การแก้ข้อมูล assignment ของ user จากหน้า admin
## 3. Current Architecture ที่เกี่ยวข้อง
- Frontend: React 18 + React Router + Vite
- Backend: Express 4 + `express-session`
- Database: MySQL ผ่าน `mysql2/promise`
- Auth: Google/Microsoft OAuth, session เก็บ `userId`
- User table หลัก: `Student`
- Health endpoint ปัจจุบัน: `GET /api/health` ตรวจ DB connection
- Error handling ปัจจุบันยังเป็น route-level `try/catch` และ `console.error`
- UI มี `StatCard`, chart components, sidebar และ theme reuse ได้

## 4. Information Architecture / Routes
```text
/admin
├── /admin/dashboard      ภาพรวมระบบ
├── /admin/users          รายการและจัดการผู้ใช้
├── /admin/users/:id      รายละเอียดผู้ใช้
├── /admin/errors         Error Log Explorer
└── /admin/system         System / Health (อาจรวม dashboard ใน MVP)
```

Admin UI ใช้ layout แยกจาก student UI แต่คง visual language เดิม เช่น `C.navy`, card radius, typography และ stat card pattern เพื่อให้ดูเป็น product เดียวกัน

## 5. Database Changes
สร้าง migration ใหม่ เช่น `migrations/005_admin_monitoring.sql`

### 5.1 Extend `Student`
เพิ่ม field ที่จำเป็นต่อการ monitor/account management:
- `role VARCHAR(20) NOT NULL DEFAULT 'student'` — `student | admin`
- `account_status VARCHAR(20) NOT NULL DEFAULT 'active'` — `active | suspended`
- `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `last_login_at DATETIME NULL`
- `last_seen_at DATETIME NULL`

> ห้ามแสดงหรือส่ง OAuth access/refresh token ออกทาง admin API เด็ดขาด

### 5.2 `System_Error_Log`
เก็บ application errors ที่ admin ค้นหาได้:
- `error_id BIGINT AUTO_INCREMENT PK`
- `occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- `level VARCHAR(20)` — error/warn
- `source VARCHAR(100)` — auth, classroom-sync, assignments, database, etc.
- `method VARCHAR(10) NULL`
- `path VARCHAR(255) NULL`
- `status_code INT NULL`
- `error_code VARCHAR(100) NULL`
- `message TEXT NOT NULL`
- `user_id INT NULL`
- `request_id VARCHAR(64) NULL`
- `metadata JSON NULL`

ไม่ควร persist secrets, session cookie, Authorization header, OAuth token หรือ raw request body ที่มีข้อมูลอ่อนไหว
### 5.3 `Admin_Audit_Log`
บันทึก action ของ admin เพื่อย้อนตรวจสอบได้:
- `audit_id BIGINT AUTO_INCREMENT PK`
- `admin_user_id INT NOT NULL`
- `action VARCHAR(100) NOT NULL`
- `target_type VARCHAR(50)`
- `target_id VARCHAR(100)`
- `detail JSON NULL`
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`

ตัวอย่าง action: `USER_SUSPEND`, `USER_UNSUSPEND`, `USER_VIEW_DETAIL`, `ERROR_VIEW_DETAIL`

### 5.4 Optional: `System_Request_Metric_Hourly`
MVP สามารถคำนวณจาก in-memory counters ได้ แต่ถ้าต้องการกราฟย้อนหลังแม้ restart ให้ aggregate รายชั่วโมง:
- `bucket_start DATETIME PK`
- `request_count INT`
- `error_count INT`
- `avg_response_ms DECIMAL(10,2)`
- `p95_response_ms DECIMAL(10,2)` (ถ้าเก็บ sample ได้)

## 6. Backend Design
### 6.1 Authorization middleware
เพิ่ม `backend/src/middleware/adminAuth.js`

Flow:
1. `requireAuth` ตรวจ session
2. query `Student.role` + `account_status`
3. ถ้าไม่ใช่ admin -> `403 forbidden`
4. ถ้า account ถูก suspended -> ไม่อนุญาตใช้งานระบบ

เสนอ helper:
- `requireAdmin`
- `requireActiveAccount`

ควรแก้ `/api/me` และ protected student routes ให้ reject suspended user ด้วย ไม่ใช่กันเฉพาะหน้า admin

### 6.2 Activity tracking
เพิ่ม middleware แบบ lightweight:
- update `last_login_at` เมื่อ OAuth login สำเร็จ
- update `last_seen_at` จาก authenticated requests
- throttle DB write เช่น update ได้สูงสุด 1 ครั้ง / 5 นาที / user เพื่อลด write load

### 6.3 Request metrics middleware
สร้าง `backend/src/middleware/requestMetrics.js`
เก็บอย่างน้อย:
- total request count
- 4xx count
- 5xx count
- response duration
- requests แยกตาม route group

MVP ไม่ต้องเก็บทุก request ลง MySQL เพราะจะโตเร็ว; ใช้ counters + periodic aggregate หรือเก็บเฉพาะ hourly summary

### 6.4 Central error handler
เพิ่ม request id ต่อ request และ centralized Express error middleware
เพื่อให้ error จากทุก route มีรูปแบบเดียวกันและ searchable

Structured error fields:
`request_id`, `timestamp`, `source`, `method`, `path`, `status`, `message`, `user_id`

Expected operational error เช่น validation 400 ไม่จำเป็นต้องเข้า error table ทุกครั้ง; เน้น unexpected 5xx และ integration failures
## 7. Admin API Contract
สร้าง `backend/src/routes/admin.js` และ mount หลัง middleware ที่จำเป็น

### Dashboard
`GET /api/admin/dashboard?range=7d`

Response concept:
```json
{
  "users": {
    "total": 1240,
    "active_today": 142,
    "active_7d": 491,
    "active_30d": 910,
    "new_7d": 53
  },
  "system": {
    "api_status": "healthy",
    "db_status": "healthy",
    "requests_24h": 18342,
    "errors_24h": 27,
    "error_rate": 0.15,
    "avg_response_ms": 84
  },
  "errors_by_day": [],
  "users_by_day": [],
  "top_error_sources": []
}
```

### Users
- `GET /api/admin/users?page=1&pageSize=25&search=&status=&provider=`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id/status` body `{ "status": "suspended" }`

User list fields:
`user_id`, `student_id`, `student_name`, `university_email`, `university_name`, `account_status`, `created_at`, `last_login_at`, `last_seen_at`, `google_connected`, `microsoft_connected`, assignment count

User detail เพิ่ม:
- จำนวน course / assignment
- assignment status counts
- sync/provider connection state (boolean only)
- recent errors ของ user
- recent admin audit actions

### Errors
- `GET /api/admin/errors?page=1&pageSize=50&level=&source=&status=&search=&from=&to=`
- `GET /api/admin/errors/:id`

ต้อง paginate/filter ที่ SQL ไม่โหลด log ทั้งหมดเข้า memory

### Health
- `GET /api/admin/system/health`
- ตรวจ API process + MySQL ping
- optional: uptime, Node memory usage, process version
- หลีกเลี่ยงการคืน environment variables/secrets

## 8. Frontend Design
### 8.1 `AdminLayout`
สร้าง component สำหรับ admin โดยเฉพาะ:
- Sidebar: Dashboard / Users / Error Logs / System
- Admin identity ด้านล่าง
- responsive collapse เมื่อจอเล็ก
- route guard ถ้า `/api/me` ไม่ใช่ admin ให้ redirect หรือแสดง 403

> แนะนำให้ `/api/me` เพิ่ม `role` และ `account_status` แต่ยังไม่คืน field ที่ sensitive

### 8.2 Admin Dashboard
Top stat cards:
1. Total Users
2. Active Today
3. Active 7 Days
4. Errors 24h
5. Error Rate
6. Avg API Response

Charts/cards:
- New Users / Active Users trend (7d/30d selector)
- Errors per day/hour
- Error source breakdown
- System Health card: API, Database, uptime
- Recent Critical Errors table
- Recently Active Users table

ใช้ component เดิมได้บางส่วน เช่น `StatCard`, card styles และสร้าง generic chart component เพิ่มเมื่อจำเป็น

### 8.3 User Management Page
Table columns:
- User
- Student ID
- University
- Provider
- Account status
- Last seen
- Joined
- Action

Features:
- search name/email/student ID
- filter active/suspended
- filter Google/Microsoft connection
- pagination
- click row -> detail drawer/page
- suspend/unsuspend ต้องมี confirmation
- ห้ามมี delete user ใน MVP เพราะ relation หลายตารางและเสี่ยง data loss

User Detail:
- profile summary
- account/provider state
- activity timestamps
- usage summary (courses/assignments)
- recent errors
- audit history
- Suspend/Unsuspend action
### 8.4 Error Log Explorer
Table columns:
- Time
- Severity
- Source
- Endpoint
- Status
- Message
- User
- Request ID

UX:
- severity badge
- filters ด้านบน
- search message/request ID
- date range
- click error -> detail drawer
- detail แสดง sanitized metadata และ context ที่จำเป็น
- ปุ่ม copy request ID เพื่อไล่ log ต่อได้ง่าย

## 9. Security & Privacy Requirements
- ทุก `/api/admin/*` ต้อง enforce `requireAdmin` ฝั่ง server; frontend guard อย่างเดียวไม่ถือเป็น security
- ห้าม expose OAuth access token / refresh token / session ID
- sanitize log metadata ก่อน persist
- ห้าม log cookie, Authorization header, client secrets หรือ full OAuth callback payload
- suspend/unsuspend ต้องเขียน `Admin_Audit_Log`
- ป้องกัน admin suspend ตัวเอง หรืออย่างน้อย require explicit safeguard
- สำหรับการ promote admin: ทำผ่าน migration/DB seed/manual bootstrap ใน MVP ไม่สร้าง public API ให้ user เปลี่ยน role เอง
- query user/log ต้อง paginate และใช้ parameterized SQL
- error response สำหรับ client ไม่ควรเปิด stack trace ใน production

## 10. Suggested File Changes
### Backend
```text
backend/server.js
backend/src/middleware/auth.js
backend/src/middleware/adminAuth.js          NEW
backend/src/middleware/requestContext.js     NEW
backend/src/middleware/requestMetrics.js     NEW
backend/src/middleware/errorHandler.js       NEW
backend/src/routes/admin.js                  NEW
backend/src/services/adminMetrics.js         NEW
backend/src/services/errorLogger.js          NEW
backend/src/services/oauthSession.js
migrations/005_admin_monitoring.sql          NEW
init.sql
```

### Frontend
```text
frontend/src/App.jsx
frontend/src/pages/admin/AdminDashboardPage.jsx   NEW
frontend/src/pages/admin/AdminUsersPage.jsx       NEW
frontend/src/pages/admin/AdminUserDetailPage.jsx  NEW
frontend/src/pages/admin/AdminErrorsPage.jsx      NEW
frontend/src/pages/admin/AdminSystemPage.jsx      NEW/optional MVP
frontend/src/components/admin/AdminLayout.jsx     NEW
frontend/src/components/admin/AdminSidebar.jsx    NEW
frontend/src/components/admin/AdminStatCard.jsx   NEW/reuse StatCard
frontend/src/components/admin/UserTable.jsx       NEW
frontend/src/components/admin/ErrorTable.jsx      NEW
frontend/src/components/admin/HealthCard.jsx      NEW
frontend/src/components/admin/TrendChart.jsx      NEW
```

## 11. Implementation Phases
### Phase 1 — Security/Foundation
1. migration role/status/timestamps + error/audit tables
2. bootstrap admin account manually
3. `requireAdmin` + active-account enforcement
4. update OAuth login timestamp
5. request context/request ID

**Done when:** student เข้า `/api/admin/*` แล้วได้ 403, admin เข้าได้, suspended user ใช้ protected API ไม่ได้

### Phase 2 — Observability Backend
1. centralized error logger
2. request metrics
3. admin dashboard queries
4. error list/detail API
5. enhanced health endpoint

**Done when:** admin API คืนจำนวน user จริง, active users จริง, 5xx ถูกบันทึกและค้นหาได้

### Phase 3 — Admin Dashboard UI
1. `AdminLayout`
2. KPI cards
3. health cards
4. user/error trends
5. recent errors/recent users

**Done when:** เปิด `/admin/dashboard` แล้วเห็นสถานะระบบหลักโดยไม่ต้องเปิด DB/terminal

### Phase 4 — User Management
1. paginated user API
2. search/filter
3. user detail
4. suspend/unsuspend
5. audit log

**Done when:** admin ค้น user, ดูสถานะ, ระงับ/คืนสิทธิ์ได้ และทุก action มี audit trail

### Phase 5 — Hardening
1. test authorization/SQL pagination/log sanitization
2. responsive UI
3. indexes สำหรับ query ที่ใช้บ่อย
4. retention policy error logs
5. production session/security settings review
## 12. Database Indexes ที่ควรมี
เพื่อให้ dashboard/log pages ไม่ช้าเมื่อข้อมูลโต:
- `Student(account_status)`
- `Student(created_at)`
- `Student(last_seen_at)`
- `Student(university_id)`
- `System_Error_Log(occurred_at)`
- `System_Error_Log(source, occurred_at)`
- `System_Error_Log(status_code, occurred_at)`
- `System_Error_Log(user_id, occurred_at)`
- `Admin_Audit_Log(admin_user_id, created_at)`
- `Admin_Audit_Log(target_type, target_id, created_at)`

## 13. KPI Definitions
กำหนดนิยามให้ชัดตั้งแต่แรกเพื่อให้ตัวเลขไม่สับสน:
- **Total Users** = จำนวน `Student` ทั้งหมด (หรือแยก suspended เป็น secondary count)
- **Active Today** = `last_seen_at >= start of today`
- **Active 7d/30d** = มี authenticated activity อย่างน้อยหนึ่งครั้งในช่วงนั้น
- **New Users** = `created_at` อยู่ในช่วงที่เลือก
- **Errors 24h** = unexpected/server/integration errors ที่ถูก persist ใน 24 ชม.
- **Error Rate** = `5xx responses / total requests * 100` ในช่วงเดียวกัน
- **Avg Response** = average server response duration ไม่รวม browser/network latency

## 14. Error Retention
ไม่ควรปล่อย log โตตลอด:
- MVP เก็บ error detail 30–90 วัน
- hourly metrics เก็บนานกว่า เช่น 6–12 เดือน
- cleanup ด้วย scheduled job/cron ใน deployment
- audit log เก็บนานกว่า error log เพราะใช้ตรวจสอบการกระทำของ admin

## 15. Test Checklist
### Authorization
- student เรียกทุก `/api/admin/*` -> 403
- unauthenticated -> 401
- admin -> 200
- suspended account -> blocked
- admin ไม่สามารถ suspend ตัวเองโดยไม่ผ่าน safeguard

### Dashboard
- counts ตรงกับ SQL fixture
- empty database แสดง 0 ไม่ crash
- date range 7d/30d ถูกต้อง
- DB unavailable แสดง degraded state

### Errors
- forced 500 ถูก persist
- token/cookie/secret ไม่อยู่ใน log
- filter source/date/status/search ใช้งานได้
- pagination stable เมื่อมี log จำนวนมาก

### Users
- search name/email/student ID
- filter status/provider
- detail ไม่คืน token columns
- suspend/unsuspend เปลี่ยน state จริง
- action ถูกบันทึกใน audit log

## 16. Acceptance Criteria (MVP)
Admin feature ถือว่าใช้งานได้เมื่อ:
1. มี admin role ที่ enforce ฝั่ง backend จริง
2. `/admin/dashboard` เห็น total users, active users, errors และ health
3. `/admin/users` ค้นหา/filter/paginate user ได้
4. admin ดูรายละเอียดและ suspend/unsuspend user ได้
5. `/admin/errors` ดู/filter error พร้อม request ID ได้
6. unexpected server errors ถูกเก็บแบบ structured และไม่มี secrets
7. admin mutations มี audit trail
8. UI ใช้ theme เดิมและ responsive ในระดับใช้งานได้

## 17. Recommended MVP Priority
ถ้าเวลาจำกัด ให้เรียงลำดับดังนี้:

**P0:** Admin RBAC -> User count/active stats -> Error logging -> Users list -> Suspend/Unsuspend

**P1:** Error explorer filters -> Health metrics -> Trend charts -> User detail -> Audit viewer

**P2:** p95 latency -> advanced charts -> realtime refresh -> external monitoring integration

## 18. Design Direction
หน้า admin ควรเน้น readability มากกว่าความ decorative:
- desktop-first dashboard, content width ใช้เต็มพื้นที่
- background `C.pageBg`, card `C.card`, primary action `C.navy`
- ใช้ pink เฉพาะ critical/error accent ไม่ใช้เต็มหน้า
- status: healthy=green, degraded=amber, down/error=pink/red
- stat card ตัวเลขใหญ่ + label สั้น
- tables มี sticky header หากรายการยาว
- filter bar อยู่เหนือ table และเก็บ state ใน URL query เพื่อ refresh/share view ได้
- critical actions เช่น Suspend ใช้ confirmation modal และแสดง email/name ของ target ชัดเจน

---

### Final Architecture Summary
ไม่แนะนำให้เริ่มจาก Grafana/ELK สำหรับ assignment นี้ เพราะระบบปัจจุบันยังเล็กและข้อมูลหลักอยู่ใน MySQL อยู่แล้ว แนวทางที่เหมาะกับ repo นี้คือ **เพิ่ม admin RBAC + instrumentation เล็ก ๆ ใน Express + structured error/audit tables + React admin console** ก่อน แล้วค่อยแยกไปใช้ Sentry/Prometheus/Grafana เมื่อ traffic และ operational needs โตขึ้น