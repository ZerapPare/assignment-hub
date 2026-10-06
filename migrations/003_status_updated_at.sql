-- 003 — student-owned task status (UC-5, A3.3, UR12).
-- NULL means "never set by hand", which the sync checks before overwriting
-- status. Do not backfill: that hands every synced row back to the platform.
ALTER TABLE Assignment_Detail
    ADD COLUMN status_updated_at DATETIME NULL AFTER status;
