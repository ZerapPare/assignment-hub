-- =========================================================
-- 013 — fold Student and Admin into one User_Account table
--
-- Migration 012 introduced User_Account as a supertype with Student and Admin
-- hanging off it. With roles and permissions now carrying every access-control
-- decision, the split no longer earns its keep: nothing needs to know which
-- kind of row a user is in order to decide what they may do. One table, one
-- user_id, and User_Role answers everything.
--
-- This also unblocks a single login page. While Student and Admin were separate
-- tables, requireAuth looked a user up in Student and an administrator simply
-- was not there, so the two had to log in through different flows holding
-- different session shapes.
--
-- Strategy: RENAME Student TO User_Account rather than copying rows across.
-- MySQL rewrites incoming foreign keys on a rename, so the six tables that
-- reference Student(user_id) follow along untouched and no student id moves.
-- Administrators are then inserted at the ids migration 012 already issued
-- them, which keeps their existing User_Role grants valid.
--
-- Column renames: student_name -> full_name, university_email -> email, and
-- role -> user_type. The first two now hold administrators too, and `role`
-- would read as if it were the RBAC role, which it is not — User_Role is.
--
-- Wrapped in a procedure so the whole thing is conditional and re-running
-- migrate.sh over an already-migrated database does nothing.
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/013_single_user_table.sql
-- =========================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS migrate_013_single_user_table;

DELIMITER //

CREATE PROCEDURE migrate_013_single_user_table()
BEGIN
    DECLARE student_exists INT;

    SELECT COUNT(*) INTO student_exists
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Student';

    -- Already folded in. Nothing to do.
    IF student_exists = 0 THEN
        SELECT 'Student table already folded into User_Account — skipping' AS note;
    ELSE

    -- 1. Park the administrator rows, with the user_id migration 012 gave them.
    --    A temporary table would vanish between statements in some clients, so
    --    use a real one and drop it at the end.
    DROP TABLE IF EXISTS Migration_013_Admin_Backup;
    CREATE TABLE Migration_013_Admin_Backup AS
    SELECT admin_id, user_id, email, display_name,
           microsoft_tenant_id, microsoft_object_id,
           is_active, created_at, last_login_at
    FROM Admin;

    -- 2. Release every foreign key that points at the 012 User_Account, so it
    --    can be dropped and the name freed for the renamed Student table.
    ALTER TABLE User_Role DROP FOREIGN KEY fk_user_role_user;
    ALTER TABLE User_Role DROP FOREIGN KEY fk_user_role_granted_by;
    ALTER TABLE Student   DROP FOREIGN KEY fk_student_user_account;
    ALTER TABLE Admin     DROP FOREIGN KEY fk_admin_user_account;

    DROP TABLE User_Account;

    -- 3. Student becomes the one user table. The six foreign keys that
    --    reference it are rewritten by MySQL as part of the rename.
    RENAME TABLE Student TO User_Account;

    -- 4. Reshape it to describe any user, not only a student.
    ALTER TABLE User_Account
        RENAME COLUMN student_name     TO full_name,
        RENAME COLUMN university_email TO email,
        CHANGE COLUMN role user_type VARCHAR(20) NOT NULL DEFAULT 'student',
        ADD COLUMN microsoft_tenant_id VARCHAR(36) NULL AFTER ms_refresh_token,
        ADD COLUMN microsoft_object_id VARCHAR(36) NULL AFTER microsoft_tenant_id,
        ADD CONSTRAINT uq_user_microsoft_identity
            UNIQUE (microsoft_tenant_id, microsoft_object_id),
        RENAME INDEX university_email          TO uq_user_email,
        RENAME INDEX uq_student_per_university TO uq_user_per_university,
        RENAME INDEX idx_student_account_status TO idx_user_account_status,
        RENAME INDEX idx_student_created_at     TO idx_user_created_at,
        RENAME INDEX idx_student_last_seen_at   TO idx_user_last_seen_at,
        RENAME INDEX idx_student_university_id  TO idx_user_university_id,
        ADD INDEX idx_user_type (user_type);

    ALTER TABLE User_Account DROP FOREIGN KEY fk_student_university;
    ALTER TABLE User_Account
        ADD CONSTRAINT fk_user_account_university
            FOREIGN KEY (university_id) REFERENCES University(university_id);

    -- 5. Bring the administrators in at their existing ids, so the User_Role
    --    rows migration 012 created still point at the right person.
    --    is_active collapses into account_status: both answered the same
    --    question, and requireAdmin checked one while requireAuth checked the
    --    other.
    INSERT INTO User_Account
        (user_id, full_name, email, user_type,
         microsoft_tenant_id, microsoft_object_id,
         account_status, created_at, last_login_at)
    SELECT b.user_id,
           COALESCE(b.display_name, b.email),
           b.email,
           'admin',
           b.microsoft_tenant_id,
           b.microsoft_object_id,
           IF(b.is_active = 1, 'active', 'suspended'),
           b.created_at,
           b.last_login_at
    FROM Migration_013_Admin_Backup b
    WHERE b.user_id IS NOT NULL;

    -- Keep the sequence clear of everything just inserted.
    SET @next_user_id = (SELECT IFNULL(MAX(user_id), 0) + 1 FROM User_Account);
    SET @bump_sql = CONCAT('ALTER TABLE User_Account AUTO_INCREMENT = ', @next_user_id);
    PREPARE bump_stmt FROM @bump_sql;
    EXECUTE bump_stmt;
    DEALLOCATE PREPARE bump_stmt;

    -- 6. Point the role assignments back at the surviving table.
    ALTER TABLE User_Role
        ADD CONSTRAINT fk_user_role_user
            FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_user_role_granted_by
            FOREIGN KEY (granted_by_user_id) REFERENCES User_Account(user_id) ON DELETE SET NULL;

    -- 7. The audit log recorded admin_id. Translate those to user_id before
    --    the Admin table goes, or every historical row loses its actor.
    ALTER TABLE Admin_Audit_Log DROP FOREIGN KEY fk_audit_log_admin;

    UPDATE Admin_Audit_Log l
    JOIN Migration_013_Admin_Backup b ON b.admin_id = l.admin_user_id
       SET l.admin_user_id = b.user_id
     WHERE b.user_id IS NOT NULL;

    ALTER TABLE Admin_Audit_Log
        ADD CONSTRAINT fk_audit_log_admin
            FOREIGN KEY (admin_user_id) REFERENCES User_Account(user_id);

    -- 8. Done with both.
    DROP TABLE Admin;
    DROP TABLE Migration_013_Admin_Backup;

    END IF;
END //

DELIMITER ;

CALL migrate_013_single_user_table();
DROP PROCEDURE migrate_013_single_user_table;
