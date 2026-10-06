-- =========================================================
-- 010 — per-student scheduling preferences
-- =========================================================

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
        FOREIGN KEY (user_id) REFERENCES Student(user_id) ON DELETE CASCADE
);