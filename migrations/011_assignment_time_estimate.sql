-- 011 — assignment duration estimate. Volumes predating it return
-- ER_BAD_FIELD_ERROR from the assignments and scheduling APIs.
ALTER TABLE Assignment_Detail
    ADD COLUMN time_estimate INT NULL AFTER priority_score;
