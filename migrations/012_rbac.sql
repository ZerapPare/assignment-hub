-- =========================================================
-- 012 — role-based access control (User–Role–Permission)
--
-- Replaces the binary admin/student split with a real RBAC model. Before this,
-- every administrator could do everything any administrator could do: one
-- requireAdmin guard covered the whole console.
--
-- Shape:
--   User_Account ──< User_Role >── Role ──< Role_Permission >── Permission
--        │
--        ├── Student   (subtype: OAuth tokens, student_id, account_status)
--        └── Admin     (subtype: microsoft identity, is_active)
--
-- Student and Admin stay as subtype tables rather than being folded into
-- User_Account, because six tables carry a foreign key to Student(user_id) and
-- Admin_Audit_Log carries one to Admin(admin_id). Keeping both primary keys
-- untouched means none of those references have to move.
--
-- Note that Student.user_id and Admin.admin_id are separate AUTO_INCREMENT
-- sequences and already overlap — id 1 exists in both and is two different
-- people. Students therefore keep their existing user_id in User_Account, and
-- administrators are issued fresh ids above the student range.
--
-- Step order matters here: the subtype foreign keys go on last, because adding
-- them before the backfill would fail against rows that have no User_Account
-- row yet. Everything except the backfill is duplicated verbatim in init.sql,
-- which needs no backfill because a fresh database has no rows to migrate.
-- test/rbacSchema.test.js enforces that the two files stay in step.
--
-- Apply after migrations 001–011:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/012_rbac.sql
-- =========================================================

-- The role and permission names below are Thai. Without this the mysql client
-- reads these UTF-8 bytes as latin1 and stores double-encoded mojibake — and it
-- also decides the character set of the string literals inside CHECK
-- constraints, so the same file produces subtly different schema depending on
-- how it is fed in.
SET NAMES utf8mb4;

-- ---------------------------------------------------------
-- 1. RBAC core
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS User_Account (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    display_name  VARCHAR(255) NULL,
    user_type     VARCHAR(20)  NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_account_email UNIQUE (email),
    CONSTRAINT ck_user_account_type  CHECK (user_type IN ('student', 'admin')),
    INDEX idx_user_account_type (user_type)
);

CREATE TABLE IF NOT EXISTS Role (
    role_id     INT AUTO_INCREMENT PRIMARY KEY,
    role_code   VARCHAR(50)  NOT NULL,
    role_name   VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_role_code UNIQUE (role_code)
);

CREATE TABLE IF NOT EXISTS Permission (
    permission_id   INT AUTO_INCREMENT PRIMARY KEY,
    permission_code VARCHAR(80)  NOT NULL,
    permission_name VARCHAR(120) NOT NULL,
    resource        VARCHAR(50)  NOT NULL,
    action          VARCHAR(50)  NOT NULL,
    description     VARCHAR(255) NULL,
    CONSTRAINT uq_permission_code            UNIQUE (permission_code),
    CONSTRAINT uq_permission_resource_action UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS Role_Permission (
    role_id       INT NOT NULL,
    permission_id INT NOT NULL,
    granted_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permission_role
        FOREIGN KEY (role_id) REFERENCES Role(role_id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permission_permission
        FOREIGN KEY (permission_id) REFERENCES Permission(permission_id) ON DELETE CASCADE,
    INDEX idx_role_permission_permission (permission_id)
);

CREATE TABLE IF NOT EXISTS User_Role (
    user_id            INT NOT NULL,
    role_id            INT NOT NULL,
    granted_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by_user_id INT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE CASCADE,
    -- No ON DELETE here on purpose: a role that is still assigned to somebody
    -- must not be silently deletable.
    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id) REFERENCES Role(role_id),
    CONSTRAINT fk_user_role_granted_by
        FOREIGN KEY (granted_by_user_id) REFERENCES User_Account(user_id) ON DELETE SET NULL,
    INDEX idx_user_role_role (role_id)
);

-- ---------------------------------------------------------
-- 2. Admin gains its link column
--
-- Guarded with information_schema lookups so re-running migrate.sh over an
-- already-migrated database is a no-op instead of an error. Nullable because
-- this runs against a table that already holds rows; step 4 fills every one.
-- ---------------------------------------------------------

SET @has_admin_user_column = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Admin'
      AND COLUMN_NAME = 'user_id'
);
SET @admin_user_column_sql = IF(
    @has_admin_user_column = 0,
    'ALTER TABLE Admin ADD COLUMN user_id INT NULL AFTER admin_id, ADD CONSTRAINT uq_admin_user_account UNIQUE (user_id)',
    'SELECT 1'
);
PREPARE admin_user_column_stmt FROM @admin_user_column_sql;
EXECUTE admin_user_column_stmt;
DEALLOCATE PREPARE admin_user_column_stmt;

-- ---------------------------------------------------------
-- 3. Reference data
--
-- super_admin holds exactly the seven capabilities the single requireAdmin
-- guard grants today, so an administrator backfilled onto it can do precisely
-- what every administrator can do now — no more, no less.
-- ---------------------------------------------------------

INSERT INTO Role (role_code, role_name, description, is_system) VALUES
    ('super_admin',      'ผู้ดูแลระบบสูงสุด',     'สิทธิ์ทั้งหมดของ admin console',        TRUE),
    ('support_admin',    'ผู้ดูแลผู้ใช้งาน',      'ดูและระงับบัญชีผู้ใช้',                 FALSE),
    ('analytics_viewer', 'ผู้ดูข้อมูลเชิงธุรกิจ', 'ดูภาพรวมและ business analytics อย่างเดียว', FALSE),
    ('student',          'นักศึกษา',              'สิทธิ์ผู้ใช้งานทั่วไป',                 TRUE)
ON DUPLICATE KEY UPDATE
    role_name   = VALUES(role_name),
    description = VALUES(description),
    is_system   = VALUES(is_system);

INSERT INTO Permission (permission_code, permission_name, resource, action, description) VALUES
    ('dashboard.view',          'ดูแดชบอร์ดผู้ดูแล',     'dashboard',          'view',    'GET /api/admin/dashboard'),
    ('user.read',               'ดูข้อมูลผู้ใช้',        'user',               'read',    'GET /api/admin/users[/:id]'),
    ('user.suspend',            'ระงับ/ปลดระงับผู้ใช้',  'user',               'suspend', 'PATCH /api/admin/users/:id/status'),
    ('error_log.read',          'ดูบันทึกข้อผิดพลาด',    'error_log',          'read',    'GET /api/admin/errors[/:id]'),
    ('system.health.read',      'ดูสถานะระบบ',           'system_health',      'read',    'GET /api/admin/system/health'),
    ('business.analytics.read', 'ดู business analytics', 'business_analytics', 'read',    'GET /api/admin/business/*'),
    ('audit_log.read',          'ดูประวัติผู้ดูแล',      'audit_log',          'read',    'recent_audit_actions ใน user detail'),
    ('assignment.manage',       'จัดการงานของตนเอง',     'assignment',         'manage',  'student scope'),
    ('schedule.manage',         'จัดการตารางของตนเอง',   'schedule',           'manage',  'student scope'),
    ('notification.manage',     'จัดการการแจ้งเตือน',    'notification',       'manage',  'student scope'),
    ('profile.manage',          'จัดการโปรไฟล์ของตนเอง', 'profile',            'manage',  'student scope')
ON DUPLICATE KEY UPDATE
    permission_name = VALUES(permission_name),
    description     = VALUES(description);

INSERT IGNORE INTO Role_Permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM Role r
CROSS JOIN Permission p
WHERE (r.role_code, p.permission_code) IN (
    ('super_admin', 'dashboard.view'),
    ('super_admin', 'user.read'),
    ('super_admin', 'user.suspend'),
    ('super_admin', 'error_log.read'),
    ('super_admin', 'system.health.read'),
    ('super_admin', 'business.analytics.read'),
    ('super_admin', 'audit_log.read'),
    ('support_admin', 'dashboard.view'),
    ('support_admin', 'user.read'),
    ('support_admin', 'user.suspend'),
    ('analytics_viewer', 'dashboard.view'),
    ('analytics_viewer', 'business.analytics.read'),
    ('student', 'assignment.manage'),
    ('student', 'schedule.manage'),
    ('student', 'notification.manage'),
    ('student', 'profile.manage')
);

-- ---------------------------------------------------------
-- 4. Backfill — migration only.
--
-- init.sql stops after step 3 and then jumps to step 5: a freshly initialised
-- database has no Student or Admin rows to migrate. Structure and reference
-- data belong to initdb; moving existing data belongs here.
-- ---------------------------------------------------------

-- Students keep their existing user_id, so the six foreign keys pointing at
-- Student(user_id) never have to move. INSERT IGNORE rather than plain INSERT
-- guards the case of a student and an administrator sharing an email address;
-- step 5 then fails loudly on any row it skipped, which is the right outcome.
INSERT IGNORE INTO User_Account (user_id, email, display_name, user_type, created_at)
SELECT s.user_id, s.university_email, s.student_name, 'student', s.created_at
FROM Student s;

-- Push the sequence past the student range before issuing administrator ids.
-- ALTER TABLE ... AUTO_INCREMENT only ever raises the counter, so re-running
-- this is safe.
SET @next_user_id = (SELECT IFNULL(MAX(user_id), 0) + 1 FROM User_Account);
SET @bump_sql = CONCAT('ALTER TABLE User_Account AUTO_INCREMENT = ', @next_user_id);
PREPARE bump_stmt FROM @bump_sql;
EXECUTE bump_stmt;
DEALLOCATE PREPARE bump_stmt;

-- Administrators get fresh ids. admin_id itself is untouched, so sessions and
-- Admin_Audit_Log keep working unchanged.
INSERT INTO User_Account (email, display_name, user_type, created_at)
SELECT a.email, a.display_name, 'admin', a.created_at
FROM Admin a
WHERE a.user_id IS NULL;

UPDATE Admin a
JOIN User_Account u ON u.email = a.email AND u.user_type = 'admin'
   SET a.user_id = u.user_id
 WHERE a.user_id IS NULL;

-- ---------------------------------------------------------
-- 5. Subtype foreign keys
--
-- Last, because until step 4 has run there are Student rows with no matching
-- User_Account row and the constraint would be rejected. On a fresh database
-- both tables are empty and these succeed immediately.
-- ---------------------------------------------------------

SET @has_student_user_fk = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Student'
      AND CONSTRAINT_NAME = 'fk_student_user_account'
);
SET @student_user_fk_sql = IF(
    @has_student_user_fk = 0,
    'ALTER TABLE Student ADD CONSTRAINT fk_student_user_account FOREIGN KEY (user_id) REFERENCES User_Account(user_id)',
    'SELECT 1'
);
PREPARE student_user_fk_stmt FROM @student_user_fk_sql;
EXECUTE student_user_fk_stmt;
DEALLOCATE PREPARE student_user_fk_stmt;

SET @has_admin_user_fk = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Admin'
      AND CONSTRAINT_NAME = 'fk_admin_user_account'
);
SET @admin_user_fk_sql = IF(
    @has_admin_user_fk = 0,
    'ALTER TABLE Admin ADD CONSTRAINT fk_admin_user_account FOREIGN KEY (user_id) REFERENCES User_Account(user_id)',
    'SELECT 1'
);
PREPARE admin_user_fk_stmt FROM @admin_user_fk_sql;
EXECUTE admin_user_fk_stmt;
DEALLOCATE PREPARE admin_user_fk_stmt;

-- ---------------------------------------------------------
-- 6. Grant roles — migration only
-- ---------------------------------------------------------

-- Every existing administrator keeps exactly the access they had before RBAC.
-- Deactivated administrators are included too: requireAdmin already rejects
-- them on is_active, and re-activating one later must not silently leave them
-- with no role at all.
INSERT IGNORE INTO User_Role (user_id, role_id)
SELECT a.user_id, r.role_id
FROM Admin a
JOIN Role r ON r.role_code = 'super_admin'
WHERE a.user_id IS NOT NULL;

INSERT IGNORE INTO User_Role (user_id, role_id)
SELECT s.user_id, r.role_id
FROM Student s
JOIN Role r ON r.role_code = 'student'
WHERE s.role = 'student';
