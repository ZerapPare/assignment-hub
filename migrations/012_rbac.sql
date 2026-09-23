-- =========================================================
-- 012 — role-based access control (User–Role–Permission)
--
-- Replaces the binary admin/student split with real RBAC. Before this, one
-- requireAdmin guard covered the whole console.
--
--   User_Account ──< User_Role >── Role ──< Role_Permission >── Permission
--        │
--        ├── Student   (subtype: OAuth tokens, student_id, account_status)
--        └── Admin     (subtype: microsoft identity, is_active)
--
-- Student and Admin stay as subtypes: six tables reference Student(user_id) and
-- Admin_Audit_Log references Admin(admin_id), so keeping both primary keys
-- means none of those references move.
--
-- The two are separate AUTO_INCREMENT sequences that already overlap — id 1 is
-- two different people — so students keep their user_id and administrators get
-- fresh ids above the student range.
--
-- Step order matters: the subtype foreign keys go on last, because adding them
-- before the backfill would fail against rows with no User_Account row yet.
-- Everything but the backfill is duplicated in init.sql;
-- test/rbacSchema.test.js keeps the two in step.
--
-- Apply after migrations 001–011:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/012_rbac.sql
-- =========================================================

-- The role and permission names below are Thai. Without this the mysql client
-- reads these UTF-8 bytes as latin1 and stores mojibake, and it also picks the
-- charset of string literals inside CHECK constraints.
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
    -- No ON DELETE on purpose: a role still assigned to somebody must not be
    -- silently deletable.
    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id) REFERENCES Role(role_id),
    CONSTRAINT fk_user_role_granted_by
        FOREIGN KEY (granted_by_user_id) REFERENCES User_Account(user_id) ON DELETE SET NULL,
    INDEX idx_user_role_role (role_id)
);

-- ---------------------------------------------------------
-- 2. Admin gains its link column
--
-- Guarded with information_schema so re-running migrate.sh is a no-op instead
-- of an error. Nullable because the table already holds rows; step 4 fills them.
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
-- admin holds exactly the seven capabilities the single requireAdmin
-- guard granted before RBAC — no more, no less.
-- ---------------------------------------------------------

INSERT INTO Role (role_code, role_name, description, is_system) VALUES
    ('admin',   'ผู้ดูแลระบบ', 'สิทธิ์ทั้งหมดของ admin console', TRUE),
    ('student', 'นักศึกษา',    'สิทธิ์ผู้ใช้งานทั่วไป',          TRUE)
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
    ('admin', 'dashboard.view'),
    ('admin', 'user.read'),
    ('admin', 'user.suspend'),
    ('admin', 'error_log.read'),
    ('admin', 'system.health.read'),
    ('admin', 'business.analytics.read'),
    ('admin', 'audit_log.read'),
    ('student', 'assignment.manage'),
    ('student', 'schedule.manage'),
    ('student', 'notification.manage'),
    ('student', 'profile.manage')
);

-- ---------------------------------------------------------
-- 4. Backfill — migration only.
--
-- init.sql skips to step 5: a fresh database has no rows to migrate. Structure
-- and reference data belong to initdb; moving existing data belongs here.
-- ---------------------------------------------------------

-- Students keep their user_id, so the six foreign keys to Student(user_id) never
-- move. INSERT IGNORE guards a student and an administrator sharing an email;
-- step 5 then fails loudly on any row it skipped, which is the right outcome.
INSERT IGNORE INTO User_Account (user_id, email, display_name, user_type, created_at)
SELECT s.user_id, s.university_email, s.student_name, 'student', s.created_at
FROM Student s;

-- Push the sequence past the student range before issuing administrator ids.
-- ALTER TABLE ... AUTO_INCREMENT only raises the counter, so re-running is safe.
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
-- Last, because before step 4 there are Student rows with no User_Account row
-- and the constraint would be rejected. On a fresh database both are empty.
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

-- Every existing administrator keeps the access they had before RBAC.
-- Deactivated ones are included: requireAdmin already rejects them on
-- is_active, and re-activating one must not leave them with no role.
INSERT IGNORE INTO User_Role (user_id, role_id)
SELECT a.user_id, r.role_id
FROM Admin a
JOIN Role r ON r.role_code = 'admin'
WHERE a.user_id IS NOT NULL;

INSERT IGNORE INTO User_Role (user_id, role_id)
SELECT s.user_id, r.role_id
FROM Student s
JOIN Role r ON r.role_code = 'student'
WHERE s.role = 'student';
