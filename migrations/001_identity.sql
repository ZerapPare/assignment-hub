-- =========================================================
-- 001 — identity workflow (UR02, UR03)
--
-- init.sql only runs when MySQL creates its data directory, so an existing
-- database never picks up schema changes. Apply this once by hand:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/001_identity.sql
--
-- Safe to skip entirely on a database created from the current init.sql.
-- =========================================================

-- Universities are found-or-created by email domain on login, which needs
-- the domain to be unique.
ALTER TABLE University
    ADD CONSTRAINT uq_university_domain UNIQUE (email_domain);

-- A student id is unique within one university, not globally.
ALTER TABLE Student
    ADD CONSTRAINT uq_student_per_university UNIQUE (student_id, university_id);
