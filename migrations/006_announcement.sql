-- =========================================================
-- Migration: Create Announcement Table
-- =========================================================

CREATE TABLE IF NOT EXISTS Announcement (
    announcement_id           INT AUTO_INCREMENT PRIMARY KEY,
    external_announcement_id  VARCHAR(100),
    title                     VARCHAR(255),
    text_content              TEXT NOT NULL,
    creator_name              VARCHAR(255),
    creator_email             VARCHAR(255),
    origin_link               VARCHAR(500),
    posted_at                 DATETIME,
    course_id                 INT NOT NULL,
    CONSTRAINT fk_announcement_course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
        ON DELETE CASCADE
);