-- =========================================================
-- 005 — admin monitoring, account status, and audit history
--
-- Apply once on an existing database after migrations 001–004:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/005_admin_monitoring.sql
-- =========================================================

ALTER TABLE Student
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student',
    ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN last_login_at DATETIME NULL,
    ADD COLUMN last_seen_at DATETIME NULL,
    ADD INDEX idx_student_account_status (account_status),
    ADD INDEX idx_student_created_at (created_at),
    ADD INDEX idx_student_last_seen_at (last_seen_at),
    ADD INDEX idx_student_university_id (university_id);

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

CREATE TABLE Admin_Audit_Log (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NULL,
    target_id VARCHAR(100) NULL,
    detail JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_log_admin
        FOREIGN KEY (admin_user_id) REFERENCES Student(user_id),
    INDEX idx_audit_log_admin_created_at (admin_user_id, created_at),
    INDEX idx_audit_log_target_created_at (target_type, target_id, created_at)
);

-- Metrics are aggregated in the application and flushed periodically, rather
-- than inserting one row per request.
CREATE TABLE System_Request_Metric_Hourly (
    bucket_start DATETIME PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    avg_response_ms DECIMAL(10,2) NULL,
    p95_response_ms DECIMAL(10,2) NULL
);

-- Administrator identities are migrated to the separate Admin table by 007_admin_identity.sql.
-- Do not promote a Student row for new administrators; provision an Admin row instead.
