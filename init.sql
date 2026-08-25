-- =========================================================
-- Assignment Hub Database Schema
-- Generated from Assignment_Hub_drawio.xml ER Diagram
-- =========================================================

DROP TABLE IF EXISTS Product_Event;
DROP TABLE IF EXISTS Admin_Audit_Log;
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS System_Error_Log;
DROP TABLE IF EXISTS System_Request_Metric_Hourly;
DROP TABLE IF EXISTS Notification_Lead_Time;
DROP TABLE IF EXISTS Notification_Setting;
DROP TABLE IF EXISTS Notification;
DROP TABLE IF EXISTS Schedule;
DROP TABLE IF EXISTS Assignment_Detail;
DROP TABLE IF EXISTS Assignment;
DROP TABLE IF EXISTS Course;
DROP TABLE IF EXISTS Student;
DROP TABLE IF EXISTS University;

-- =========================================================
-- TABLE: University
-- =========================================================
-- Rows are created on demand: the first student to log in from a domain
-- creates its University row (see findOrCreateUniversity in
-- backend/server.js), so supporting a new institution needs no code change.
-- The unique key is what makes that find-or-create safe.
CREATE TABLE University (
    university_id   INT AUTO_INCREMENT PRIMARY KEY,
    university_name VARCHAR(255) NOT NULL,
    email_domain    VARCHAR(100) NOT NULL,
    CONSTRAINT uq_university_domain UNIQUE (email_domain)
);

-- =========================================================
-- TABLE: Student
-- (gg_token / ms_token composite attributes split into their
--  access/refresh sub-fields)
-- =========================================================
CREATE TABLE Student (
    user_id           INT AUTO_INCREMENT PRIMARY KEY,
    student_id        VARCHAR(50),
    student_name      VARCHAR(255) NOT NULL,
    university_email  VARCHAR(255) NOT NULL UNIQUE,
    university_id     INT,
    gg_access_token   TEXT,
    gg_refresh_token  TEXT,
    ms_access_token   TEXT,
    ms_refresh_token  TEXT,
    role              VARCHAR(20) NOT NULL DEFAULT 'student',
    account_status    VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at     DATETIME NULL,
    last_seen_at      DATETIME NULL,
    CONSTRAINT fk_student_university
        FOREIGN KEY (university_id) REFERENCES University(university_id),
    -- A student id must be unique within its own university, but the same
    -- number may exist at a different one. MySQL allows repeated NULLs in a
    -- unique key, so students whose id isn't known yet coexist fine.
    CONSTRAINT uq_student_per_university UNIQUE (student_id, university_id),
    INDEX idx_student_account_status (account_status),
    INDEX idx_student_created_at (created_at),
    INDEX idx_student_last_seen_at (last_seen_at),
    INDEX idx_student_university_id (university_id)
);

-- =========================================================
-- TABLE: Admin
-- =========================================================
-- Admin identities are provisioned manually. OAuth tokens are intentionally
-- not stored because the Admin console does not call provider APIs.
CREATE TABLE Admin (
    admin_id      INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(255) NULL,
    microsoft_tenant_id VARCHAR(36) NULL,
    microsoft_object_id VARCHAR(36) NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    CONSTRAINT uq_admin_microsoft_identity UNIQUE (microsoft_tenant_id, microsoft_object_id)
);

-- =========================================================
-- TABLE: Product_Event
-- =========================================================
-- A privacy-conscious event stream for meaningful product actions. Metadata
-- contains aggregate values only; OAuth credentials and coursework content are
-- never written here.
CREATE TABLE Product_Event (
    event_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    event_name    VARCHAR(100) NOT NULL,
    feature_name  VARCHAR(80) NOT NULL,
    event_result  VARCHAR(20) NULL,
    metadata      JSON NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_event_student
        FOREIGN KEY (user_id) REFERENCES Student(user_id) ON DELETE CASCADE,
    INDEX idx_product_event_created (created_at),
    INDEX idx_product_event_feature_created (feature_name, created_at),
    INDEX idx_product_event_name_created (event_name, created_at),
    INDEX idx_product_event_user_created (user_id, created_at)
);

-- =========================================================
-- TABLE: Course
-- =========================================================
CREATE TABLE Course (
    course_id           INT AUTO_INCREMENT PRIMARY KEY,
    course_name         VARCHAR(255) NOT NULL,
    external_course_id  VARCHAR(100),
    platform_source     VARCHAR(50),  -- e.g. 'Google Classroom', 'Microsoft Teams'
    student_id          INT NOT NULL,
    CONSTRAINT fk_course_student
        FOREIGN KEY (student_id) REFERENCES Student(user_id)
);

-- =========================================================
-- TABLE: Assignment
-- =========================================================
CREATE TABLE Assignment (
    assignment_id           INT AUTO_INCREMENT PRIMARY KEY,
    external_assignment_id  VARCHAR(100),
    title                   VARCHAR(255) NOT NULL,
    -- 'homework' | 'project' | 'quiz' | 'exam' | 'reading' | 'other'.
    -- Only set on manually added work; synced coursework leaves it NULL.
    task_type               VARCHAR(50),
    origin_link             VARCHAR(500),
    course_id               INT NOT NULL,
    CONSTRAINT fk_assignment_course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
);

-- =========================================================
-- TABLE: Assignment_Detail (1:1 weak entity of Assignment via "Act")
-- =========================================================
CREATE TABLE Assignment_Detail (
    assignment_id   INT PRIMARY KEY,
    description     TEXT,
    due_date        DATETIME,
    -- 'not_started' | 'in_progress' | 'submitted' | 'completed'. The student
    -- owns this (UC-5); Classroom only seeds it while status_updated_at is NULL.
    status          VARCHAR(50),
    -- Set only when the student changes status by hand. NULL therefore means
    -- "the platform still owns this row's status" — see backend/src/routes/classroom.js.
    status_updated_at DATETIME,
    priority_score  DECIMAL(5,2),
    CONSTRAINT fk_detail_assignment
        FOREIGN KEY (assignment_id) REFERENCES Assignment(assignment_id)
);

-- =========================================================
-- TABLE: Schedule (1:1 with Assignment_Detail)
-- =========================================================
CREATE TABLE Schedule (
    schedule_id     INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id   INT NOT NULL UNIQUE,
    start_time      DATETIME,
    end_time        DATETIME,
    time_estimate   INT,  -- minutes; derived attribute in diagram
    CONSTRAINT fk_schedule_detail
        FOREIGN KEY (assignment_id) REFERENCES Assignment_Detail(assignment_id)
);

-- =========================================================
-- TABLE: Notification (m side of Assignment_Detail 1—m Notification)
-- =========================================================
CREATE TABLE Notification (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id    INT NOT NULL,
    trigger_type     VARCHAR(50),  -- derived attribute in diagram
    sent_at          DATETIME,
    is_sent          BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_notification_detail
        FOREIGN KEY (assignment_id) REFERENCES Assignment_Detail(assignment_id)
);

-- =========================================================
-- TABLE: Notification_Setting (1:1 with Student)
--
-- The student's own reminder preferences. No row means "never saved
-- settings" — the API answers with defaults rather than seeding one.
-- =========================================================
CREATE TABLE Notification_Setting (
    user_id             INT PRIMARY KEY,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    daily_repeat        BOOLEAN NOT NULL DEFAULT FALSE,
    daily_repeat_time   TIME NULL,
    -- Last value typed under "+ กำหนดเอง", kept so the hint line can offer it
    -- again. Set here does NOT mean selected — Notification_Lead_Time does.
    last_custom_minutes INT NULL,
    CONSTRAINT fk_notification_setting_student
        FOREIGN KEY (user_id) REFERENCES Student(user_id)
);

-- =========================================================
-- TABLE: Notification_Lead_Time (m side of Notification_Setting 1—m)
--
-- One row per selected lead time, in minutes, so presets (60, 180, 1440,
-- 4320) and custom values share one representation and compare directly
-- against Assignment_Detail.due_date.
-- =========================================================
CREATE TABLE Notification_Lead_Time (
    user_id  INT NOT NULL,
    minutes  INT NOT NULL,
    PRIMARY KEY (user_id, minutes),
    CONSTRAINT fk_lead_time_setting
        FOREIGN KEY (user_id) REFERENCES Notification_Setting(user_id)
);

-- =========================================================
-- TABLE: System_Error_Log
-- =========================================================
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
    CONSTRAINT fk_error_log_student
        FOREIGN KEY (user_id) REFERENCES Student(user_id) ON DELETE SET NULL,
    INDEX idx_error_log_occurred_at (occurred_at),
    INDEX idx_error_log_source_occurred_at (source, occurred_at),
    INDEX idx_error_log_status_occurred_at (status_code, occurred_at),
    INDEX idx_error_log_user_occurred_at (user_id, occurred_at),
    INDEX idx_error_log_request_id (request_id)
);

-- =========================================================
-- TABLE: Admin_Audit_Log
-- =========================================================
CREATE TABLE Admin_Audit_Log (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NULL,
    target_id VARCHAR(100) NULL,
    detail JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_log_admin
        FOREIGN KEY (admin_user_id) REFERENCES Admin(admin_id),
    INDEX idx_audit_log_admin_created_at (admin_user_id, created_at),
    INDEX idx_audit_log_target_created_at (target_type, target_id, created_at)
);

-- =========================================================
-- TABLE: System_Request_Metric_Hourly
-- =========================================================
CREATE TABLE System_Request_Metric_Hourly (
    bucket_start DATETIME PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    avg_response_ms DECIMAL(10,2) NULL,
    p95_response_ms DECIMAL(10,2) NULL
);

-- =========================================================
-- No sample data — tables start empty. Universities you actually
-- support (for matching students by email domain) still need at
-- least one row here, e.g.:
--
-- INSERT INTO University (university_name, email_domain) VALUES
-- ('Your University', 'youruni.ac.th');
-- =========================================================