-- =========================================================
-- 015 — notification preferences and delivery (UC-6, UC-8, FR-07, UR12)
--
-- Was three migrations: 004 (preferences), 009 (delivery bookkeeping) and 015
-- (announcements). They all shape the same three tables, so they are one file.
--
-- It sits at 015 rather than 004 because of what it now depends on:
-- Notification_Setting points at User_Account, which only exists after the fold
-- in 012, and the announcement half needs the Announcement table from 006.
--
-- trigger_type says which reminder a Notification row is:
--
--   lead:<minutes>:<due date>   advance reminder, e.g. lead:1440:2026-09-20 23:59
--   daily:<YYYY-MM-DD>          daily repeat for that date
--   ann:new                     a new Classroom announcement
--
-- The due date is in the key so moving a deadline re-arms the reminder. An
-- announcement needs no such key: which one it is lives in announcement_id.
--
-- attempt_count / next_attempt_at back the retry ladder. A row reads as:
--
--   claimed / sending    sent_at NULL, is_sent FALSE, attempt_count 0
--   retrying             sent_at NULL, is_sent FALSE, attempt_count 1-2
--   sent                 sent_at set,  is_sent TRUE
--   failed for good      sent_at set,  is_sent FALSE
--
-- readFailures() in routes/notifications.js counts only the last, so the banner
-- stays quiet while retries are in flight.
--
-- Every step is guarded, so re-running migrate.sh is a no-op:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/015_notifications.sql
-- =========================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------
-- 1. Preferences
--
-- Lead times get their own table, not a CSV column: a student may pick several,
-- and the sender JOINs on them to find which assignments are due.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS Notification_Setting (
    user_id             INT PRIMARY KEY,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    daily_repeat        BOOLEAN NOT NULL DEFAULT FALSE,
    daily_repeat_time   TIME NULL,
    announcement_notify BOOLEAN NOT NULL DEFAULT TRUE,
    -- The last value typed under "+ กำหนดเอง", kept so the hint line can offer
    -- it again. Set here does NOT mean selected — Notification_Lead_Time does.
    last_custom_minutes INT NULL,
    CONSTRAINT fk_notification_setting_student
        FOREIGN KEY (user_id) REFERENCES User_Account(user_id)
);

-- One row per selected lead time, in minutes so presets and custom values share
-- one representation and compare directly against due_date.
CREATE TABLE IF NOT EXISTS Notification_Lead_Time (
    user_id  INT NOT NULL,
    minutes  INT NOT NULL,
    PRIMARY KEY (user_id, minutes),
    CONSTRAINT fk_lead_time_setting
        FOREIGN KEY (user_id) REFERENCES Notification_Setting(user_id)
);

-- ---------------------------------------------------------
-- 2. Everything else, guarded step by step
-- ---------------------------------------------------------

DROP PROCEDURE IF EXISTS migrate_015_notifications;

DELIMITER //

CREATE PROCEDURE migrate_015_notifications()
BEGIN
    DECLARE has_notify_column   INT;
    DECLARE has_attempt_count   INT;
    DECLARE has_retry_index     INT;
    DECLARE has_created_at      INT;
    DECLARE has_course_index    INT;
    DECLARE has_announcement_id INT;
    DECLARE has_ann_unique      INT;

    -- ---------- 2a. Preferences on a table that predates them ----------

    SELECT COUNT(*) INTO has_notify_column
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification_Setting' AND COLUMN_NAME = 'announcement_notify';

    IF has_notify_column = 0 THEN
        ALTER TABLE Notification_Setting
            ADD COLUMN announcement_notify BOOLEAN NOT NULL DEFAULT TRUE AFTER daily_repeat_time;
    END IF;

    -- ---------- 2b. Delivery bookkeeping ----------

    SELECT COUNT(*) INTO has_attempt_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification' AND COLUMN_NAME = 'attempt_count';

    IF has_attempt_count = 0 THEN
        -- The table is empty at this point, so this cannot fail on existing
        -- NULLs. It matters because NULLs never collide, so a NULL trigger_type
        -- would slip past the unique index below — exactly the duplicate that
        -- index exists to prevent.
        ALTER TABLE Notification
            MODIFY COLUMN trigger_type VARCHAR(50) NOT NULL;

        ALTER TABLE Notification
            ADD COLUMN attempt_count   INT NOT NULL DEFAULT 0,
            ADD COLUMN next_attempt_at DATETIME NULL,
            ADD CONSTRAINT uq_notification_trigger UNIQUE (assignment_id, trigger_type);
    END IF;

    -- Separately guarded: init.sql creates the index with the table, so a fresh
    -- database reaches here with the columns present and the index already made.
    SELECT COUNT(*) INTO has_retry_index
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification' AND INDEX_NAME = 'idx_notification_retry';

    IF has_retry_index = 0 THEN
        -- The retry sweep looks up by (next_attempt_at, is_sent) — a full scan
        -- without this.
        CREATE INDEX idx_notification_retry ON Notification (next_attempt_at, is_sent);
    END IF;

    -- ---------- 2c. Announcements ----------

    SELECT COUNT(*) INTO has_created_at
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Announcement' AND COLUMN_NAME = 'created_at';

    IF has_created_at = 0 THEN
        -- The sync always writes ann.id, but a NULL would slip past the unique
        -- index for the same reason trigger_type had to become NOT NULL above.
        UPDATE Announcement
           SET external_announcement_id = CONCAT('legacy-', announcement_id)
         WHERE external_announcement_id IS NULL;

        -- The old sync inserted a duplicate whenever two passes overlapped, so
        -- an existing database may hold pairs the unique key would reject.
        DELETE a FROM Announcement a
          JOIN Announcement b
            ON a.course_id                = b.course_id
           AND a.external_announcement_id = b.external_announcement_id
           AND a.announcement_id          > b.announcement_id;

        -- DATETIME, not TIMESTAMP: posted_at and every other clock column here
        -- is DATETIME, and the sender compares both against the same NOW().
        ALTER TABLE Announcement
            MODIFY COLUMN external_announcement_id VARCHAR(100) NOT NULL,
            ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER posted_at,
            ADD CONSTRAINT uq_announcement_external UNIQUE (course_id, external_announcement_id);

        -- The ALTER stamps every historical row with the moment this ran, which
        -- reads as "brand new" — one pass would mail the student's entire
        -- announcement history. Age them back to when they were posted.
        UPDATE Announcement SET created_at = posted_at WHERE posted_at IS NOT NULL;
    END IF;

    -- uq_announcement_external leads with course_id, so fk_announcement_course
    -- can use it and its own index is redundant. Whether that index exists at
    -- all depends on how the database was built — MySQL only auto-creates one
    -- when nothing else covers the column — so this is guarded separately.
    SELECT COUNT(*) INTO has_course_index
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Announcement' AND INDEX_NAME = 'fk_announcement_course';

    IF has_course_index > 0 THEN
        ALTER TABLE Announcement DROP INDEX fk_announcement_course;
    END IF;

    SELECT COUNT(*) INTO has_announcement_id
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification' AND COLUMN_NAME = 'announcement_id';

    IF has_announcement_id = 0 THEN
        ALTER TABLE Notification
            MODIFY COLUMN assignment_id INT NULL,
            ADD COLUMN announcement_id INT NULL AFTER assignment_id;
    END IF;

    SELECT COUNT(*) INTO has_ann_unique
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification'
      AND CONSTRAINT_NAME = 'uq_notification_announcement';

    IF has_ann_unique = 0 THEN
        -- uq_notification_trigger already covers the assignment kind and still
        -- backs fk_notification_detail, so it stays as it is. This is its
        -- counterpart, and it doubles as the index InnoDB requires on the
        -- referencing side of the new foreign key.
        ALTER TABLE Notification
            ADD CONSTRAINT uq_notification_announcement UNIQUE (announcement_id, trigger_type),
            ADD CONSTRAINT fk_notification_announcement
                FOREIGN KEY (announcement_id) REFERENCES Announcement(announcement_id)
                ON DELETE CASCADE,
            -- Exactly one target. Without this a row with neither would satisfy
            -- both unique keys as a NULL pair and claim nothing.
            ADD CONSTRAINT chk_notification_target
                CHECK ((assignment_id IS NULL) <> (announcement_id IS NULL));
    END IF;
END //

DELIMITER ;

CALL migrate_015_notifications();
DROP PROCEDURE migrate_015_notifications;
