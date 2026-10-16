ALTER TABLE Assignment_Detail
    ADD COLUMN dashboard_hidden BOOLEAN NOT NULL DEFAULT FALSE AFTER status_updated_at;
