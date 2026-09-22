-- =========================================================
-- 011 — assignment duration estimate
--
-- Older database volumes were created before `time_estimate` was added to
-- init.sql. The assignments and scheduling APIs both read this field, so the
-- missing column makes an otherwise healthy database return ER_BAD_FIELD_ERROR.
-- Apply once to an existing database.
-- =========================================================

ALTER TABLE Assignment_Detail
    ADD COLUMN time_estimate INT NULL AFTER priority_score;
