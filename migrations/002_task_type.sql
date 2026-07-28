-- =========================================================
-- 002 — manual task type (UR06, A5.1)
--
-- Apply once by hand on an existing database:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/002_task_type.sql
--
-- Safe to skip entirely on a database created from the current init.sql.
-- =========================================================

ALTER TABLE Assignment
    ADD COLUMN task_type VARCHAR(50) NULL AFTER title;
