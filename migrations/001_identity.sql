-- 001 — identity workflow (UR02, UR03).
-- Universities are found-or-created by email domain, so it must be unique.
ALTER TABLE University
    ADD CONSTRAINT uq_university_domain UNIQUE (email_domain);

-- A student id is unique within one university, not globally.
ALTER TABLE Student
    ADD CONSTRAINT uq_student_per_university UNIQUE (student_id, university_id);
