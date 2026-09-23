-- =========================================================
-- 011 — assignment duration estimate
--
-- Volumes created before `time_estimate` reached init.sql are missing it, and
-- both the assignments and scheduling APIs read the field — so an otherwise
-- healthy database returns ER_BAD_FIELD_ERROR. Apply once to an existing one.
-- =========================================================

ALTER TABLE Assignment_Detail
    ADD COLUMN time_estimate INT NULL AFTER priority_score;
