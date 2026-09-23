-- =========================================================
-- 014 — two roles: `admin` and `student`
--
-- Renames `super_admin` to `admin` and drops `support_admin` and
-- `analytics_viewer`, neither of which anyone held. init.sql and 012_rbac.sql
-- now seed only the two, so this brings an existing database in line.
--
-- Written as a rename rather than a seed-and-delete so role_id stays stable:
-- every User_Role and Role_Permission row follows the rename without being
-- touched. The move-then-delete below is only for a database that somehow ended
-- up with both codes at once.
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/014_rename_admin_role.sql
-- =========================================================

SET NAMES utf8mb4;

-- 1. Rename in place, but only when `admin` is not already taken. The derived
--    table is required: MySQL rejects a subquery on the target of an UPDATE.
UPDATE Role
   SET role_code = 'admin',
       role_name = 'ผู้ดูแลระบบ'
 WHERE role_code = 'super_admin'
   AND NOT EXISTS (SELECT 1 FROM (SELECT role_code FROM Role) r WHERE r.role_code = 'admin');

-- 2. Make sure both roles exist, whichever path step 1 took.
INSERT INTO Role (role_code, role_name, description, is_system) VALUES
    ('admin',   'ผู้ดูแลระบบ', 'สิทธิ์ทั้งหมดของ admin console', TRUE),
    ('student', 'นักศึกษา',    'สิทธิ์ผู้ใช้งานทั่วไป',          TRUE)
ON DUPLICATE KEY UPDATE
    role_name   = VALUES(role_name),
    description = VALUES(description),
    is_system   = VALUES(is_system);

-- 3. Move anyone still holding a retired role onto `admin`. UPDATE IGNORE
--    skips a user who already holds it rather than failing on the primary key.
UPDATE IGNORE User_Role ur
  JOIN Role retired ON retired.role_id = ur.role_id
                   AND retired.role_code IN ('super_admin', 'support_admin', 'analytics_viewer')
  JOIN Role target  ON target.role_code = 'admin'
   SET ur.role_id = target.role_id;

-- 4. Drop the retired roles. Role_Permission follows via ON DELETE CASCADE;
--    fk_user_role_role has no ON DELETE on purpose, so a grant step 3 missed
--    makes this fail loudly instead of orphaning somebody.
DELETE FROM Role WHERE role_code IN ('super_admin', 'support_admin', 'analytics_viewer');

-- 5. `admin` keeps exactly the seven console permissions, `student` the four.
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
