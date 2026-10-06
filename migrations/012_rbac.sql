-- 012 — RBAC on one user table. Merged from the old 012/013/014.
-- User_Account ──< User_Role >── Role ──< Role_Permission >── Permission
-- Apply after 001–011. Mirrored in init.sql; rbacSchema.test.js keeps them in step.

-- Thai names below; without this the client stores latin1 mojibake.
SET NAMES utf8mb4;

-- 1. One user table. In a procedure so a rerun is a no-op.

DROP PROCEDURE IF EXISTS migrate_012_fold_user_tables;
DROP PROCEDURE IF EXISTS migrate_012_drop_fk;

DELIMITER //

CREATE PROCEDURE migrate_012_fold_user_tables()
BEGIN
    DECLARE has_student      INT;
    DECLARE has_user_account INT;
    DECLARE has_user_role    INT;

    SELECT COUNT(*) INTO has_student
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Student';

    -- Nothing to fold: fresh from init.sql, or already done.
    IF has_student = 0 THEN
        SELECT 'Student already folded into User_Account — skipping' AS note;
    ELSE

    SELECT COUNT(*) INTO has_user_account
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User_Account';

    -- Ran the old 012 and stopped: drop its supertype so the rename can take the name.
    IF has_user_account > 0 THEN
        SELECT COUNT(*) INTO has_user_role
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User_Role';

        IF has_user_role > 0 THEN
            CALL migrate_012_drop_fk('User_Role', 'fk_user_role_user');
            CALL migrate_012_drop_fk('User_Role', 'fk_user_role_granted_by');
        END IF;
        CALL migrate_012_drop_fk('Student', 'fk_student_user_account');
        CALL migrate_012_drop_fk('Admin',   'fk_admin_user_account');

        DROP TABLE User_Account;
    END IF;

    -- MySQL rewrites the six incoming foreign keys as part of the rename.
    RENAME TABLE Student TO User_Account;

    -- `role` renamed: it would read as the RBAC role, which User_Role owns.
    ALTER TABLE User_Account
        RENAME COLUMN student_name     TO full_name,
        RENAME COLUMN university_email TO email,
        CHANGE COLUMN role user_type VARCHAR(20) NOT NULL DEFAULT 'student',
        ADD COLUMN microsoft_tenant_id VARCHAR(36) NULL AFTER ms_refresh_token,
        ADD COLUMN microsoft_object_id VARCHAR(36) NULL AFTER microsoft_tenant_id,
        ADD CONSTRAINT uq_user_microsoft_identity
            UNIQUE (microsoft_tenant_id, microsoft_object_id),
        RENAME INDEX university_email           TO uq_user_email,
        RENAME INDEX uq_student_per_university  TO uq_user_per_university,
        RENAME INDEX idx_student_account_status TO idx_user_account_status,
        RENAME INDEX idx_student_created_at     TO idx_user_created_at,
        RENAME INDEX idx_student_last_seen_at   TO idx_user_last_seen_at,
        RENAME INDEX idx_student_university_id  TO idx_user_university_id,
        ADD INDEX idx_user_type (user_type);

    ALTER TABLE User_Account DROP FOREIGN KEY fk_student_university;
    ALTER TABLE User_Account
        ADD CONSTRAINT fk_user_account_university
            FOREIGN KEY (university_id) REFERENCES University(university_id);

    -- Fresh ids above the student range; is_active collapses into account_status.
    -- Plain INSERT: a shared address must fail loudly, not lose someone's access.
    INSERT INTO User_Account
        (full_name, email, user_type,
         microsoft_tenant_id, microsoft_object_id,
         account_status, created_at, last_login_at)
    SELECT COALESCE(a.display_name, a.email),
           a.email,
           'admin',
           a.microsoft_tenant_id,
           a.microsoft_object_id,
           IF(a.is_active = 1, 'active', 'suspended'),
           a.created_at,
           a.last_login_at
    FROM Admin a;

    -- Remap admin_id to user_id before Admin goes, or every row loses its actor.
    ALTER TABLE Admin_Audit_Log DROP FOREIGN KEY fk_audit_log_admin;

    UPDATE Admin_Audit_Log l
      JOIN Admin a        ON a.admin_id = l.admin_user_id
      JOIN User_Account u ON u.email = a.email AND u.user_type = 'admin'
       SET l.admin_user_id = u.user_id;

    ALTER TABLE Admin_Audit_Log
        ADD CONSTRAINT fk_audit_log_admin
            FOREIGN KEY (admin_user_id) REFERENCES User_Account(user_id);

    DROP TABLE Admin;

    END IF;
END //

-- Dropping an absent foreign key is an error, and the states here differ.
CREATE PROCEDURE migrate_012_drop_fk(IN tbl VARCHAR(64), IN fk VARCHAR(64))
BEGIN
    DECLARE present INT;

    SELECT COUNT(*) INTO present
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = tbl AND CONSTRAINT_NAME = fk;

    IF present > 0 THEN
        SET @drop_sql = CONCAT('ALTER TABLE ', tbl, ' DROP FOREIGN KEY ', fk);
        PREPARE drop_stmt FROM @drop_sql;
        EXECUTE drop_stmt;
        DEALLOCATE PREPARE drop_stmt;
    END IF;
END //

DELIMITER ;

CALL migrate_012_fold_user_tables();
DROP PROCEDURE migrate_012_fold_user_tables;
DROP PROCEDURE migrate_012_drop_fk;

-- 007_admin_identity recreates Admin on a fresh database. Nothing reads it.
DROP TABLE IF EXISTS Admin;

-- 2. RBAC tables. After the fold, so User_Role points at the surviving table.

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
    -- No ON DELETE: a role still assigned must not be silently deletable.
    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id) REFERENCES Role(role_id),
    CONSTRAINT fk_user_role_granted_by
        FOREIGN KEY (granted_by_user_id) REFERENCES User_Account(user_id) ON DELETE SET NULL,
    INDEX idx_user_role_role (role_id)
);

-- Admin ids changed in the fold, so old grants point at nobody. Step 5 re-grants.
DELETE ur FROM User_Role ur
LEFT JOIN User_Account u ON u.user_id = ur.user_id
WHERE u.user_id IS NULL;

UPDATE User_Role ur
LEFT JOIN User_Account u ON u.user_id = ur.granted_by_user_id
   SET ur.granted_by_user_id = NULL
 WHERE ur.granted_by_user_id IS NOT NULL AND u.user_id IS NULL;

-- CREATE TABLE IF NOT EXISTS will not re-add these to a table that survived.
SET @has_user_fk = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'User_Role' AND CONSTRAINT_NAME = 'fk_user_role_user'
);
SET @readd_fk_sql = IF(
    @has_user_fk = 0,
    'ALTER TABLE User_Role
        ADD CONSTRAINT fk_user_role_user
            FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_user_role_granted_by
            FOREIGN KEY (granted_by_user_id) REFERENCES User_Account(user_id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE readd_fk_stmt FROM @readd_fk_sql;
EXECUTE readd_fk_stmt;
DEALLOCATE PREPARE readd_fk_stmt;

-- 3. Retired role codes. Before the seed, or `admin` would already be taken.
-- A rename keeps role_id stable, so every grant follows untouched.
-- The derived table is required: MySQL rejects a subquery on an UPDATE target.
UPDATE Role
   SET role_code = 'admin'
 WHERE role_code = 'super_admin'
   AND NOT EXISTS (SELECT 1 FROM (SELECT role_code FROM Role) r WHERE r.role_code = 'admin');

-- 4. Reference data. admin holds exactly what requireAdmin granted before RBAC.

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

-- UPDATE IGNORE skips someone who already holds `admin`.
UPDATE IGNORE User_Role ur
  JOIN Role old ON old.role_id = ur.role_id
  JOIN Role new ON new.role_code = 'admin'
   SET ur.role_id = new.role_id
 WHERE old.role_code IN ('super_admin', 'support_admin', 'analytics_viewer');

-- Fails loudly on a grant the step above missed. Role_Permission cascades.
DELETE FROM Role WHERE role_code IN ('super_admin', 'support_admin', 'analytics_viewer');

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

-- 5. Grant roles — migration only; init.sql has no rows to grant to.
-- Reads user_type, so it works whether this run folded or found it done.
-- Suspended accounts included: reinstating one must not leave it roleless.

INSERT IGNORE INTO User_Role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM User_Account u
JOIN Role r ON r.role_code = 'admin'
WHERE u.user_type = 'admin';

INSERT IGNORE INTO User_Role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM User_Account u
JOIN Role r ON r.role_code = 'student'
WHERE u.user_type = 'student';
