# บทบาทและสิทธิ์ (Role-Based Access Control)

เอกสารนี้อธิบายว่าระบบตัดสินอย่างไรว่าใครทำอะไรได้บ้าง

> **สถานะ:** โมเดล 2 บทบาทตามเอกสารนี้ยังไม่ได้ลงโค้ด — ฐานข้อมูลปัจจุบันยัง seed บทบาทไว้ 4 ตัว
> (`super_admin`, `support_admin`, `analytics_viewer`, `student`) โดยสองตัวกลางไม่มีใครถือเลย
> และ `User_Role` ยังให้ถือได้หลายบทบาท ต้องมี migration `014` มาปรับให้ตรงกับที่เขียนไว้นี้

---

## ภาพรวม

```
User_Account ──< User_Role >── Role ──< Role_Permission >── Permission
```

- **`User_Account`** — ผู้ใช้ทุกคนอยู่ตารางเดียวกัน ไม่มีตาราง admin แยก
- **`Role`** — บทบาท มีแค่ 2 ตัว
- **`Permission`** — สิทธิ์ย่อยว่าทำ *action* อะไร กับ *resource* ไหนได้
- **`Role_Permission`** — บทบาทไหนมีสิทธิ์อะไรบ้าง (many-to-many)
- **`User_Role`** — ใครถือบทบาทอะไร

---

## บทบาทมี 2 ตัวเท่านั้น

| `role_code` | ใครเป็น | เข้าถึงอะไรได้ |
|---|---|---|
| **`student`** | นักศึกษาทั่วไป ได้รับอัตโนมัติตอน login ครั้งแรก | หน้าฝั่งนักศึกษาทั้งหมด — งาน ตาราง ประกาศ การแจ้งเตือน โปรไฟล์ของตัวเอง |
| **`admin`** | ผู้ดูแลระบบ ต้องมีคนกำหนดให้เท่านั้น ไม่ได้มาเอง | หน้า `/admin` ทั้งหมด — แดชบอร์ด จัดการผู้ใช้ error log สถานะระบบ business analytics |

**ไม่มีบทบาทอื่นและไม่มีบทบาทย่อย** ถ้าต้องการแบ่งระดับผู้ดูแลในอนาคต ให้เพิ่มแถวใน `Role` แล้วผูก
`Role_Permission` ชุดใหม่ ไม่ต้องแก้โค้ด — แต่ตอนนี้ตั้งใจให้มีแค่ 2

---

## ผู้ใช้ 1 คน ถือได้ 1 บทบาท

ข้อนี้**บังคับที่ฐานข้อมูล ไม่ใช่ข้อตกลงที่ต้องคอยระวังกันเอง**

```sql
CREATE TABLE User_Role (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    ...
    PRIMARY KEY (user_id)      -- ← คีย์เป็น user_id เดี่ยว ไม่ใช่ (user_id, role_id)
);
```

เพราะ primary key เป็น `user_id` เพียงคอลัมน์เดียว ตารางจึงเก็บได้แถวเดียวต่อผู้ใช้หนึ่งคน —
จะ `INSERT` บทบาทที่สองก็ชนคีย์ทันที

ผลที่ตามมาสองข้อ:

1. **admin เป็น student ไปด้วยไม่ได้** เป็นบทบาทที่แยกขาดจากกัน (disjoint)
2. **การให้บทบาทใหม่คือการแทนที่ของเดิม** ไม่ใช่การเพิ่มอีกใบ จึงต้องเขียนด้วย
   `ON DUPLICATE KEY UPDATE` ไม่ใช่ `INSERT IGNORE` (ดูหัวข้อ "การกำหนดบทบาท")

เหตุผลที่บังคับด้วย primary key ไม่ใช่วิธีอื่น: MySQL ใช้ `CHECK` กับ subquery ไม่ได้ และถ้าใช้ trigger
คนที่อ่าน DDL จะมองไม่เห็นกฎข้อนี้เลย การทำให้มันเป็น*นิยามของตาราง*จึงชัดเจนที่สุด

---

## บทบาทไหนมีสิทธิ์อะไร

ตาราง `Permission` แยกสิทธิ์เป็น `resource` + `action` เพื่อให้แต่ละ endpoint ประกาศได้ว่าต้องการอะไร

### `admin` — 7 สิทธิ์

| `permission_code` | คุม endpoint |
|---|---|
| `dashboard.view` | `GET /api/admin/dashboard` |
| `user.read` | `GET /api/admin/users` · `GET /api/admin/users/:id` |
| `user.suspend` | `PATCH /api/admin/users/:id/status` |
| `error_log.read` | `GET /api/admin/errors` · `GET /api/admin/errors/:id` |
| `system.health.read` | `GET /api/admin/system/health` |
| `business.analytics.read` | `GET /api/admin/business/*` |
| `audit_log.read` | ฟิลด์ `recent_audit_actions` ในหน้ารายละเอียดผู้ใช้ |

### `student` — 4 สิทธิ์

| `permission_code` | ครอบคลุม |
|---|---|
| `assignment.manage` | จัดการงานของตัวเอง |
| `schedule.manage` | จัดตารางของตัวเอง |
| `notification.manage` | ตั้งค่าการแจ้งเตือน |
| `profile.manage` | แก้โปรไฟล์และรหัสนักศึกษา |

> ทำไมยังต้องมีตาราง `Permission` ทั้งที่มีแค่ 2 บทบาท — เพราะมันคือสิ่งที่ `requirePermission` ตรวจ
> **รายเส้นทาง** ถ้าเพิ่ม endpoint ฝั่ง admin ใหม่แล้วลืมใส่ guard เทสต์ `adminRoutes.test.js`
> จะจับได้ทันที ถ้ายุบเหลือ "เป็น admin หรือไม่" อย่างเดียว เทสต์ตัวนั้นจะหมดความหมาย

---

## ระบบตรวจสิทธิ์ตอนไหน

session เก็บแค่ `userId` อย่างเดียว ไม่มี "โหมด admin" — ทุกอย่างมาจากบทบาทที่ผูกกับ id นั้น

| Middleware | ทำอะไร | ตอบอะไรเมื่อไม่ผ่าน |
|---|---|---|
| `requireAuth` | login อยู่ไหม และบัญชียัง `active` ไหม พร้อมโหลดบทบาท/สิทธิ์ | `401` · `403 ACCOUNT_SUSPENDED` |
| `requireStudent` | ถือบทบาท `student` ไหม | `403 STUDENT_ONLY` |
| `requireAdmin` | ถือสิทธิ์ฝั่ง admin อย่างน้อยหนึ่งตัวไหม | `403 admin only` |
| `requirePermission(code)` | ถือสิทธิ์ตัวที่ endpoint นี้ต้องการไหม | `403 PERMISSION_DENIED` |

**บทบาทถูกอ่านจากฐานข้อมูลใหม่ทุก request** ไม่ได้ cache ไว้ใน session การให้หรือถอนบทบาทจึงมีผล
ตั้งแต่ request ถัดไป โดยที่เจ้าตัวไม่ต้อง logout

ข้อความ error ทั้งสี่แบบต่างกันโดยตั้งใจ เพราะหน้าเว็บต้องแยกให้ออกว่า "ยังไม่ได้ login" (เด้งไปหน้า login)
กับ "login แล้วแต่ไม่ใช่คนกลุ่มนี้" (ขึ้นข้อความ ไม่ใช่เด้ง)

### admin เข้าหน้านักศึกษาไม่ได้

เพราะ admin ไม่ถือบทบาท `student` เส้นทางฝั่งนักศึกษาจึงตอบ `403 STUDENT_ONLY`
และหน้าเว็บจะเด้งไป `/admin` ให้อัตโนมัติ ตรงกันข้าม นักศึกษาที่เปิด `/admin` จะได้ `403` แล้วเห็น
ข้อความว่าไม่มีสิทธิ์

ข้อยกเว้นเดียวคือ **`GET /api/me`** ที่ยังใช้ `requireAuth` ธรรมดา เพราะเป็นข้อมูลตัวตน ไม่ใช่ API
ของนักศึกษา และหน้าเว็บต้องเรียกมันเพื่อ*รู้ว่าตัวเองเป็น admin* ถ้า endpoint นี้ตอบ 403 ด้วย
จะแยกไม่ออกว่าผู้ใช้เป็น admin หรือโดนระงับบัญชี

---

## การกำหนดบทบาท

### นักศึกษา — อัตโนมัติ

ตอน login ผ่าน Google/Microsoft ครั้งแรก ระบบสร้างแถวใน `User_Account` แล้วให้บทบาท `student` ทันที
ไม่ต้องทำอะไรเพิ่ม

### ผู้ดูแล — ต้องกำหนดด้วยมือเสมอ

**ไม่มี endpoint ไหนแจกบทบาท `admin` ให้ได้** นี่คือสิ่งที่ทำให้ "ไม่มีการสมัครเป็นผู้ดูแลแบบสาธารณะ"
ยังเป็นจริงอยู่ แม้จะรวม login เหลือหน้าเดียวแล้วก็ตาม — ใครก็ login ได้ แต่ได้แค่บัญชีธรรมดา

ให้เจ้าตัว login เข้ามาหนึ่งครั้งก่อน แล้วรัน:

```sql
INSERT INTO User_Role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM User_Account u
JOIN Role r ON r.role_code = 'admin'
WHERE u.email = 'someone@example.edu'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), granted_at = CURRENT_TIMESTAMP;
```

`ON DUPLICATE KEY UPDATE` สำคัญ — ถ้าใช้ `INSERT IGNORE` คำสั่งจะเงียบ ๆ ไม่ทำอะไรเลย
เพราะคนนั้นถือบทบาท `student` อยู่แล้วและชน primary key

ถอนกลับเป็นนักศึกษาก็ใช้คำสั่งเดียวกัน เปลี่ยน `'admin'` เป็น `'student'`

### ตรวจว่าใครถืออะไร

```sql
SELECT u.email, r.role_code, p.permission_code
FROM User_Account u
JOIN User_Role ur       ON ur.user_id = u.user_id
JOIN Role r             ON r.role_id = ur.role_id
JOIN Role_Permission rp ON rp.role_id = ur.role_id
JOIN Permission p       ON p.permission_id = rp.permission_id
WHERE u.email = 'someone@example.edu';
```

---

## ข้อตรวจสอบความถูกต้อง

สี่ query นี้ต้องได้ **0 แถว** เสมอ ถ้าได้แถวออกมาแปลว่าข้อมูลเพี้ยน

```sql
-- 1. ต้องไม่มีบทบาทอื่นนอกจากสองตัวนี้
SELECT role_code FROM Role WHERE role_code NOT IN ('admin', 'student');

-- 2. ต้องไม่มีใครถือเกิน 1 บทบาท
SELECT user_id FROM User_Role GROUP BY user_id HAVING COUNT(*) > 1;

-- 3. ต้องไม่มีใครไม่มีบทบาทเลย — คนกลุ่มนี้จะใช้งานระบบไม่ได้เลยสักหน้า
SELECT u.user_id, u.email FROM User_Account u
LEFT JOIN User_Role ur ON ur.user_id = u.user_id
WHERE ur.user_id IS NULL;

-- 4. ต้องไม่มีใครเป็นทั้ง admin และ student
SELECT a.user_id
FROM User_Role a
JOIN Role ra ON ra.role_id = a.role_id AND ra.role_code = 'admin'
JOIN User_Role s ON s.user_id = a.user_id
JOIN Role rs ON rs.role_id = s.role_id AND rs.role_code = 'student';
```

ข้อ 3 สำคัญที่สุด — `requireStudent` ปฏิเสธบัญชีที่ไม่ถือ `student` ถ้ามีใครหลุดไปไม่มีบทบาทเลย
คนนั้นจะเข้าระบบไม่ได้ทั้งฝั่งนักศึกษาและฝั่งผู้ดูแล
