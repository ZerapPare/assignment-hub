-- 002 — manual task type (UR06, A5.1).
ALTER TABLE Assignment
    ADD COLUMN task_type VARCHAR(50) NULL AFTER title;
