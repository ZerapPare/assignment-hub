-- 015 — notification preferences and delivery (UC-6, UC-8, FR-07, UR12).
-- Merged from the old 004/009/015, and at 015 because Notification_Setting
-- needs User_Account from the fold in 012 and announcements need 006.
-- trigger_type: lead:<minutes>:<due date> | daily:<YYYY-MM-DD> | ann:new.
-- Every step is guarded, so re-running migrate.sh is a no-op.

SET NAMES utf8mb4;

-- 1. Preferences. Lead times get a table, not a CSV column: several per student.

CREATE TABLE IF NOT EXISTS Notification_Setting (
    user_id             INT PRIMARY KEY,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    daily_repeat        BOOLEAN NOT NULL DEFAULT FALSE,
    daily_repeat_time   TIME NULL,
    announcement_notify BOOLEAN NOT NULL DEFAULT TRUE,
    -- Last custom value typed, for the hint line. Set here != selected.
    last_custom_minutes INT NULL,
    CONSTRAINT fk_notification_setting_student
        FOREIGN KEY (user_id) REFERENCES User_Account(user_id)
);

-- Minutes, so presets and custom values compare directly against due_date.
CREATE TABLE IF NOT EXISTS Notification_Lead_Time (
    user_id  INT NOT NULL,
    minutes  INT NOT NULL,
    PRIMARY KEY (user_id, minutes),
    CONSTRAINT fk_lead_time_setting
        FOREIGN KEY (user_id) REFERENCES Notification_Setting(user_id)
);

-- 2. Everything else, guarded step by step.

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

    -- 2a. Preferences on a table that predates them.

    SELECT COUNT(*) INTO has_notify_column
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification_Setting' AND COLUMN_NAME = 'announcement_notify';

    IF has_notify_column = 0 THEN
        ALTER TABLE Notification_Setting
            ADD COLUMN announcement_notify BOOLEAN NOT NULL DEFAULT TRUE AFTER daily_repeat_time;
    END IF;

    -- 2b. Delivery bookkeeping.

    SELECT COUNT(*) INTO has_attempt_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification' AND COLUMN_NAME = 'attempt_count';

    IF has_attempt_count = 0 THEN
        -- NOT NULL first: NULLs never collide, so one would slip past the unique key.
        ALTER TABLE Notification
            MODIFY COLUMN trigger_type VARCHAR(50) NOT NULL;

        ALTER TABLE Notification
            ADD COLUMN attempt_count   INT NOT NULL DEFAULT 0,
            ADD COLUMN next_attempt_at DATETIME NULL,
            ADD CONSTRAINT uq_notification_trigger UNIQUE (assignment_id, trigger_type);
    END IF;

    -- Separately guarded: init.sql creates this index with the table.
    SELECT COUNT(*) INTO has_retry_index
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification' AND INDEX_NAME = 'idx_notification_retry';

    IF has_retry_index = 0 THEN
        -- The retry sweep looks up by (next_attempt_at, is_sent).
        CREATE INDEX idx_notification_retry ON Notification (next_attempt_at, is_sent);
    END IF;

    -- 2c. Announcements.

    SELECT COUNT(*) INTO has_created_at
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Announcement' AND COLUMN_NAME = 'created_at';

    IF has_created_at = 0 THEN
        -- A NULL would slip past the unique index, as with trigger_type above.
        UPDATE Announcement
           SET external_announcement_id = CONCAT('legacy-', announcement_id)
         WHERE external_announcement_id IS NULL;

        -- Overlapping syncs used to double-insert; the unique key would reject those.
        DELETE a FROM Announcement a
          JOIN Announcement b
            ON a.course_id                = b.course_id
           AND a.external_announcement_id = b.external_announcement_id
           AND a.announcement_id          > b.announcement_id;

        -- DATETIME like posted_at: the sender compares both against one NOW().
        ALTER TABLE Announcement
            MODIFY COLUMN external_announcement_id VARCHAR(100) NOT NULL,
            ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER posted_at,
            ADD CONSTRAINT uq_announcement_external UNIQUE (course_id, external_announcement_id);

        -- The ALTER stamps old rows as "brand new" — age them back, or one pass
        -- mails the student's entire announcement history.
        UPDATE Announcement SET created_at = posted_at WHERE posted_at IS NOT NULL;
    END IF;

    -- uq_announcement_external leads with course_id, so this index is redundant.
    -- Guarded: whether it exists at all depends on how the database was built.
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
        -- Counterpart to uq_notification_trigger, and the index InnoDB needs
        -- on the referencing side of the new foreign key.
        ALTER TABLE Notification
            ADD CONSTRAINT uq_notification_announcement UNIQUE (announcement_id, trigger_type),
            ADD CONSTRAINT fk_notification_announcement
                FOREIGN KEY (announcement_id) REFERENCES Announcement(announcement_id)
                ON DELETE CASCADE,
            -- Exactly one target: a row with neither would claim nothing.
            ADD CONSTRAINT chk_notification_target
                CHECK ((assignment_id IS NULL) <> (announcement_id IS NULL));
    END IF;
END //

DELIMITER ;

CALL migrate_015_notifications();
DROP PROCEDURE migrate_015_notifications;
