-- =========================================================
-- 007 — separate administrator identities
--
-- Apply after migrations 001–006:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/007_admin_identity.sql
-- =========================================================

CREATE TABLE Admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NULL,
    microsoft_tenant_id VARCHAR(36) NULL,
    microsoft_object_id VARCHAR(36) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    CONSTRAINT uq_admin_microsoft_identity UNIQUE (microsoft_tenant_id, microsoft_object_id)
);

-- Preserve legacy administrators created by migration 005. Keeping the same numeric
-- id lets existing Admin_Audit_Log rows continue to identify their actor after the
-- Student role is retired from the administrator login path.
INSERT INTO Admin (admin_id, email, display_name, is_active, created_at, last_login_at)
SELECT user_id, university_email, student_name,
       account_status = 'active', created_at, last_login_at
FROM Student
WHERE role = 'admin'
ON DUPLICATE KEY UPDATE
    display_name = COALESCE(Admin.display_name, VALUES(display_name)),
    is_active = VALUES(is_active);

-- Migration 005 originally linked audit rows to Student.role='admin'. Admin
-- sessions now use Admin.admin_id. Remove only that legacy foreign key: when this
-- script is run after the latest init.sql, the existing FK already points to Admin
-- and must be preserved.
SET @drop_legacy_admin_fk = (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Admin_Audit_Log'
      AND CONSTRAINT_NAME = 'fk_audit_log_admin'
      AND UNIQUE_CONSTRAINT_TABLE_NAME = 'Student'
);
SET @drop_legacy_admin_fk_sql = IF(
    @drop_legacy_admin_fk > 0,
    'ALTER TABLE Admin_Audit_Log DROP FOREIGN KEY fk_audit_log_admin',
    'SELECT 1'
);
PREPARE drop_legacy_admin_fk_stmt FROM @drop_legacy_admin_fk_sql;
EXECUTE drop_legacy_admin_fk_stmt;
DEALLOCATE PREPARE drop_legacy_admin_fk_stmt;

-- Provision administrators manually. Never expose a public registration API.
-- Google: INSERT INTO Admin (email, display_name)
--        VALUES ('admin@example.com', 'Assignment Hub Admin');
-- Microsoft additionally requires the trusted tenant and Entra user object IDs;
-- see 008_admin_microsoft_identity.sql and the project setup guide.
