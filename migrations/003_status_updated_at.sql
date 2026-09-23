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
-- NULL means "never set by hand", which the Classroom sync checks before it may
-- overwrite status. Do not backfill — that hands every synced row back to the
-- platform.
-- =========================================================

ALTER TABLE Assignment_Detail
    ADD COLUMN status_updated_at DATETIME NULL AFTER status;
