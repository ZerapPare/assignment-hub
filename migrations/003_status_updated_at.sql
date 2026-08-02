-- =========================================================
-- 003 — student-owned task status (UC-5, A3.3, UR12)
--
-- Apply once by hand on an existing database:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/003_status_updated_at.sql
--
-- Safe to skip entirely on a database created from the current init.sql.
--
-- NULL means "the student has never set this status by hand", which is what
-- the Classroom sync checks before it is allowed to overwrite status. Do not
-- backfill it — that would hand every synced row back to the platform.
-- =========================================================

ALTER TABLE Assignment_Detail
    ADD COLUMN status_updated_at DATETIME NULL AFTER status;
