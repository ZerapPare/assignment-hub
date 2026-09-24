-- =========================================================
-- 015 — notifications for new Classroom announcements
--
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS migrate_015_announcement_notifications;

DELIMITER //

CREATE PROCEDURE migrate_015_announcement_notifications()
BEGIN
    DECLARE has_created_at      INT;
    DECLARE has_course_index    INT;
    DECLARE has_announcement_id INT;
    DECLARE has_ann_unique      INT;
    DECLARE has_notify_column   INT;

    -- ---------- 1. Announcement ----------

    SELECT COUNT(*) INTO has_created_at
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Announcement' AND COLUMN_NAME = 'created_at';

    IF has_created_at = 0 THEN
        -- The sync always writes ann.id, but a NULL would slip past the unique
        -- index for the same reason 009 had to make trigger_type NOT NULL.
        UPDATE Announcement
           SET external_announcement_id = CONCAT('legacy-', announcement_id)
         WHERE external_announcement_id IS NULL;

        -- Today's sync inserts a duplicate whenever two passes overlap, so an
        -- existing database may hold pairs the unique key would reject.
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

    -- ---------- 2. Notification ----------

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

    -- ---------- 3. Notification_Setting ----------

    SELECT COUNT(*) INTO has_notify_column
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notification_Setting' AND COLUMN_NAME = 'announcement_notify';

    IF has_notify_column = 0 THEN
        ALTER TABLE Notification_Setting
            ADD COLUMN announcement_notify BOOLEAN NOT NULL DEFAULT TRUE AFTER daily_repeat_time;
    END IF;
END //

DELIMITER ;

CALL migrate_015_announcement_notifications();
DROP PROCEDURE migrate_015_announcement_notifications;
