-- =========================================================
-- 009 — notification delivery (FR-07, UC-8)
--
-- Notification shipped with no unique key, so nothing would have stopped the
-- sender from mailing the same reminder on every pass. trigger_type says which
-- reminder a row is:
--
--   lead:<minutes>:<due date>   an advance reminder, e.g. lead:1440:2026-09-20 23:59
--   daily:<YYYY-MM-DD>          a daily repeat for that date
--
-- The due date is part of the key on purpose: moving a deadline has to re-arm
-- the reminder, not stay quiet because 'lead:1440' was already sent once.
--
-- attempt_count / next_attempt_at back the retry ladder. A row reads as:
--
--   claimed / sending    sent_at NULL, is_sent FALSE, attempt_count 0
--   retrying             sent_at NULL, is_sent FALSE, attempt_count 1-2
--   sent                 sent_at set,  is_sent TRUE
--   failed for good      sent_at set,  is_sent FALSE
--
-- Only the last of those is what readFailures() in routes/notifications.js
-- counts, so the settings banner stays quiet while retries are still in flight.
--
-- Apply once by hand on an existing database:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/009_notification_delivery.sql
--
-- Safe to skip entirely on a database created from the current init.sql.
-- =========================================================

-- Nothing has ever written this table, so it is empty and this cannot fail on
-- existing NULLs. It matters because a NULL trigger_type would slip past the
-- unique index below (NULLs never collide), which is exactly the duplicate the
-- index exists to prevent.
ALTER TABLE Notification
    MODIFY COLUMN trigger_type VARCHAR(50) NOT NULL;

ALTER TABLE Notification
    ADD COLUMN attempt_count   INT NOT NULL DEFAULT 0,
    ADD COLUMN next_attempt_at DATETIME NULL,
    ADD CONSTRAINT uq_notification_trigger UNIQUE (assignment_id, trigger_type);

-- The retry sweep looks up by (next_attempt_at, is_sent); without this it is a
-- full scan on every pass.
CREATE INDEX idx_notification_retry ON Notification (next_attempt_at, is_sent);
