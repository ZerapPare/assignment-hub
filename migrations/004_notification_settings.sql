-- =========================================================
-- 004 — notification preferences (UC-6, UR12)
--
-- Apply once by hand on an existing database:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/004_notification_settings.sql
--
-- Safe to skip entirely on a database created from the current init.sql.
--
-- Lead times get their own table, not a CSV column: a student may pick several,
-- and the sender JOINs on them to find which assignments are due.
-- =========================================================

CREATE TABLE Notification_Setting (
    user_id             INT PRIMARY KEY,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    daily_repeat        BOOLEAN NOT NULL DEFAULT FALSE,
    daily_repeat_time   TIME NULL,
    -- The last value typed under "+ กำหนดเอง", kept so the hint line can offer
    -- it again. Set here does NOT mean selected — Notification_Lead_Time does.
    last_custom_minutes INT NULL,
    CONSTRAINT fk_notification_setting_student
        FOREIGN KEY (user_id) REFERENCES Student(user_id)
);

-- One row per selected lead time, in minutes so presets and custom values share
-- one representation and compare directly against due_date.
CREATE TABLE Notification_Lead_Time (
    user_id  INT NOT NULL,
    minutes  INT NOT NULL,
    PRIMARY KEY (user_id, minutes),
    CONSTRAINT fk_lead_time_setting
        FOREIGN KEY (user_id) REFERENCES Notification_Setting(user_id)
);
