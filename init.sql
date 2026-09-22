USE assignment_hub;

-- The seed data below contains Thai text. Without this the mysql client reads
-- these UTF-8 bytes as latin1 and stores double-encoded mojibake — and it also
-- decides the character set of the string literals inside CHECK constraints,
-- so the same file produces subtly different schema depending on how it is fed
-- in. Declaring it here keeps the result identical for docker-entrypoint,
-- migrate.sh and a manual pipe alike.
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Product_Event;
DROP TABLE IF EXISTS Admin_Audit_Log;
DROP TABLE IF EXISTS Role_Permission;
DROP TABLE IF EXISTS User_Role;
DROP TABLE IF EXISTS Permission;
DROP TABLE IF EXISTS Role;
DROP TABLE IF EXISTS User_Account;
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS System_Error_Log;
DROP TABLE IF EXISTS System_Request_Metric_Hourly;
DROP TABLE IF EXISTS Notification_Lead_Time;
DROP TABLE IF EXISTS Notification_Setting;
DROP TABLE IF EXISTS Notification;
DROP TABLE IF EXISTS User_Settings;
DROP TABLE IF EXISTS Schedule;
DROP TABLE IF EXISTS Assignment_Detail;
DROP TABLE IF EXISTS Assignment;
DROP TABLE IF EXISTS Course;
DROP TABLE IF EXISTS Student;
DROP TABLE IF EXISTS University;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- สร้างตารางทั้งหมด
-- =========================================================

CREATE TABLE University (
    university_id   INT AUTO_INCREMENT PRIMARY KEY,
    university_name VARCHAR(255) NOT NULL,
    email_domain    VARCHAR(100) NOT NULL,
    CONSTRAINT uq_university_domain UNIQUE (email_domain)
);

-- One table for everybody. There is no separate administrator table: what an
-- account may do is decided entirely by the roles attached to its user_id, so
-- the only thing that ever distinguished the two was which columns they filled
-- in. user_type says which kind of account this is for the metrics queries that
-- count students; it is not an access-control field — User_Role is.
--
-- student_id is the number the university issues, not a key: it is NULL for
-- administrators and unique only within a university.
CREATE TABLE User_Account (
    user_id           INT AUTO_INCREMENT PRIMARY KEY,
    student_id        VARCHAR(50),
    full_name         VARCHAR(255) NOT NULL,
    email             VARCHAR(255) NOT NULL,
    university_id     INT,
    gg_access_token   TEXT,
    gg_refresh_token  TEXT,
    ms_access_token   TEXT,
    ms_refresh_token  TEXT,
    -- Immutable Entra identifiers, matched instead of an address for accounts
    -- that sign in through a trusted Microsoft tenant.
    microsoft_tenant_id VARCHAR(36) NULL,
    microsoft_object_id VARCHAR(36) NULL,
    user_type         VARCHAR(20) NOT NULL DEFAULT 'student',
    account_status    VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at     DATETIME NULL,
    last_seen_at      DATETIME NULL,
    CONSTRAINT fk_user_account_university FOREIGN KEY (university_id) REFERENCES University(university_id),
    CONSTRAINT uq_user_email UNIQUE (email),
    CONSTRAINT uq_user_per_university UNIQUE (student_id, university_id),
    CONSTRAINT uq_user_microsoft_identity UNIQUE (microsoft_tenant_id, microsoft_object_id),
    INDEX idx_user_account_status (account_status),
    INDEX idx_user_created_at (created_at),
    INDEX idx_user_last_seen_at (last_seen_at),
    INDEX idx_user_university_id (university_id),
    INDEX idx_user_type (user_type)
);

CREATE TABLE IF NOT EXISTS Schedule_Setting (
    user_id       INT PRIMARY KEY,
    work_start    TIME NOT NULL DEFAULT '08:00:00',
    work_end      TIME NOT NULL DEFAULT '18:00:00',
    lunch_start   TIME NOT NULL DEFAULT '12:00:00',
    lunch_end     TIME NOT NULL DEFAULT '13:00:00',
    slot_step_min INT NOT NULL DEFAULT 15,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP 
                  ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_schedule_setting_student
        FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE CASCADE
);

-- =========================================================
-- RBAC — User–Role–Permission
--
--   User_Account ──< User_Role >── Role ──< Role_Permission >── Permission
--
-- Every access decision in the application is this join. There is no second
-- identity table and no "admin mode" on the session: an account can reach the
-- admin console exactly when it holds an administrative permission, which is
-- also why one login page serves everyone.
--
-- These tables and their seed rows are duplicated in migrations/012_rbac.sql
-- for databases that already exist. Keep the two in step —
-- test/rbacSchema.test.js fails if they drift.
-- =========================================================

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

-- Reference data.
--
-- super_admin holds exactly the seven capabilities the single requireAdmin
-- guard granted before RBAC, so an administrator on that role can do precisely
-- what every administrator could do — no more, no less.

INSERT INTO Role (role_code, role_name, description, is_system) VALUES
    ('super_admin',      'ผู้ดูแลระบบสูงสุด',     'สิทธิ์ทั้งหมดของ admin console',        TRUE),
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
    ('student', 'assignment.manage'),
    ('student', 'schedule.manage'),
    ('student', 'notification.manage'),
    ('student', 'profile.manage')
);

CREATE TABLE Product_Event (
    event_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    event_name    VARCHAR(100) NOT NULL,
    feature_name  VARCHAR(80) NOT NULL,
    event_result  VARCHAR(20) NULL,
    metadata      JSON NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_event_student FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE CASCADE,
    INDEX idx_product_event_created (created_at),
    INDEX idx_product_event_feature_created (feature_name, created_at),
    INDEX idx_product_event_name_created (event_name, created_at),
    INDEX idx_product_event_user_created (user_id, created_at)
);

CREATE TABLE Course (
    course_id           INT AUTO_INCREMENT PRIMARY KEY,
    course_name         VARCHAR(255) NOT NULL,
    external_course_id  VARCHAR(100),
    platform_source     VARCHAR(50),
    student_id          INT NOT NULL,
    CONSTRAINT fk_course_student FOREIGN KEY (student_id) REFERENCES User_Account(user_id)
);

CREATE TABLE IF NOT EXISTS Announcement (
    announcement_id           INT AUTO_INCREMENT PRIMARY KEY,
    external_announcement_id  VARCHAR(100),
    title                     VARCHAR(255),
    text_content              TEXT NOT NULL,
    creator_name              VARCHAR(255),
    creator_email             VARCHAR(255),
    origin_link               VARCHAR(500),
    posted_at                 DATETIME,
    course_id                 INT NOT NULL,
    CONSTRAINT fk_announcement_course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
        ON DELETE CASCADE
);

CREATE TABLE Assignment (
    assignment_id           INT AUTO_INCREMENT PRIMARY KEY,
    external_assignment_id  VARCHAR(100),
    title                   VARCHAR(255) NOT NULL,
    task_type               VARCHAR(50),
    origin_link             VARCHAR(500),
    course_id               INT NOT NULL,
    CONSTRAINT fk_assignment_course FOREIGN KEY (course_id) REFERENCES Course(course_id)
);

CREATE TABLE Assignment_Detail (
    assignment_id     INT PRIMARY KEY,
    description       TEXT,
    due_date          DATETIME,
    status            VARCHAR(50),
    status_updated_at DATETIME,
    priority_score    DECIMAL(5,2),
    time_estimate     INT,
    max_points        FLOAT DEFAULT NULL,
    assigned_grade    FLOAT DEFAULT NULL,
    CONSTRAINT fk_detail_assignment
      FOREIGN KEY (assignment_id) REFERENCES Assignment(assignment_id)
);

CREATE TABLE Schedule (
    schedule_id     INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id   INT NOT NULL UNIQUE,
    start_time      DATETIME,
    end_time        DATETIME,
    time_estimate   INT,
	segments        JSON NULL,
    CONSTRAINT fk_schedule_detail FOREIGN KEY (assignment_id) REFERENCES Assignment_Detail(assignment_id)
);

CREATE TABLE Notification (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id    INT NOT NULL,
    -- Which reminder this row is: 'lead:<minutes>:<due date>' for an advance
    -- reminder, 'daily:<YYYY-MM-DD>' for a daily repeat. The due date is part
    -- of the key so moving a deadline re-arms the reminder instead of staying
    -- quiet — see backend/src/services/notificationSender.js.
    trigger_type     VARCHAR(50) NOT NULL,
    sent_at          DATETIME,
    is_sent          BOOLEAN DEFAULT FALSE,
    -- Retry ladder. sent_at stays NULL while attempts remain, so the settings
    -- banner only counts a send that failed for good.
    attempt_count    INT NOT NULL DEFAULT 0,
    next_attempt_at  DATETIME NULL,
    CONSTRAINT fk_notification_detail
        FOREIGN KEY (assignment_id) REFERENCES Assignment_Detail(assignment_id),
    -- The claiming INSERT relies on this to decide who sends; without it every
    -- pass would mail the same reminder again.
    CONSTRAINT uq_notification_trigger UNIQUE (assignment_id, trigger_type),
    INDEX idx_notification_retry (next_attempt_at, is_sent)
);

CREATE TABLE Notification_Setting (
    user_id             INT PRIMARY KEY,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    daily_repeat        BOOLEAN NOT NULL DEFAULT FALSE,
    daily_repeat_time   TIME NULL,
    last_custom_minutes INT NULL,
    CONSTRAINT fk_notification_setting_student FOREIGN KEY (user_id) REFERENCES User_Account(user_id)
);

CREATE TABLE Notification_Lead_Time (
    user_id  INT NOT NULL,
    minutes  INT NOT NULL,
    PRIMARY KEY (user_id, minutes),
    CONSTRAINT fk_lead_time_setting FOREIGN KEY (user_id) REFERENCES Notification_Setting(user_id)
);

CREATE TABLE System_Error_Log (
    error_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(20) NOT NULL DEFAULT 'error',
    source VARCHAR(100) NOT NULL,
    method VARCHAR(10) NULL,
    path VARCHAR(255) NULL,
    status_code INT NULL,
    error_code VARCHAR(100) NULL,
    message TEXT NOT NULL,
    user_id INT NULL,
    request_id VARCHAR(64) NULL,
    metadata JSON NULL,
    CONSTRAINT fk_error_log_student FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE SET NULL,
    INDEX idx_error_log_occurred_at (occurred_at),
    INDEX idx_error_log_source_occurred_at (source, occurred_at),
    INDEX idx_error_log_status_occurred_at (status_code, occurred_at),
    INDEX idx_error_log_user_occurred_at (user_id, occurred_at),
    INDEX idx_error_log_request_id (request_id)
);

CREATE TABLE Admin_Audit_Log (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NULL,
    target_id VARCHAR(100) NULL,
    detail JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_log_admin FOREIGN KEY (admin_user_id) REFERENCES User_Account(user_id),
    INDEX idx_audit_log_admin_created_at (admin_user_id, created_at),
    INDEX idx_audit_log_target_created_at (target_type, target_id, created_at)
);

CREATE TABLE System_Request_Metric_Hourly (
    bucket_start DATETIME PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    avg_response_ms DECIMAL(10,2) NULL,
    p95_response_ms DECIMAL(10,2) NULL
);

CREATE TABLE User_Settings (
    user_id INT PRIMARY KEY,
    lunch_start TIME NULL,
    lunch_end TIME NULL,
    working_hours_start TIME DEFAULT '08:00:00',
    working_hours_end TIME DEFAULT '18:00:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_settings_student FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE CASCADE
);

CREATE TABLE Working_Hours (
    user_id      INT NOT NULL,
    day_of_week  TINYINT NOT NULL COMMENT '0=Sun,1=Mon,...,6=Sat',
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    PRIMARY KEY (user_id, day_of_week),
    CONSTRAINT fk_working_hours_student
        FOREIGN KEY (user_id) REFERENCES User_Account(user_id) ON DELETE CASCADE
);