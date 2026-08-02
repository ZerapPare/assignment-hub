-- =========================================================
-- Assignment Hub Database Schema
-- Generated from Assignment_Hub_drawio.xml ER Diagram
-- =========================================================

DROP TABLE IF EXISTS Notification;
DROP TABLE IF EXISTS Schedule;
DROP TABLE IF EXISTS Assignment_Detail;
DROP TABLE IF EXISTS Assignment;
DROP TABLE IF EXISTS Course;
DROP TABLE IF EXISTS Student;
DROP TABLE IF EXISTS University;

-- =========================================================
-- TABLE: University
-- =========================================================
-- Rows are created on demand: the first student to log in from a domain
-- creates its University row (see findOrCreateUniversity in
-- backend/server.js), so supporting a new institution needs no code change.
-- The unique key is what makes that find-or-create safe.
CREATE TABLE University (
    university_id   INT AUTO_INCREMENT PRIMARY KEY,
    university_name VARCHAR(255) NOT NULL,
    email_domain    VARCHAR(100) NOT NULL,
    CONSTRAINT uq_university_domain UNIQUE (email_domain)
);

-- =========================================================
-- TABLE: Student
-- (gg_token / ms_token composite attributes split into their
--  access/refresh sub-fields)
-- =========================================================
CREATE TABLE Student (
    user_id           INT AUTO_INCREMENT PRIMARY KEY,
    student_id        VARCHAR(50),
    student_name      VARCHAR(255) NOT NULL,
    university_email  VARCHAR(255) NOT NULL UNIQUE,
    university_id     INT,
    gg_access_token   TEXT,
    gg_refresh_token  TEXT,
    ms_access_token   TEXT,
    ms_refresh_token  TEXT,
    CONSTRAINT fk_student_university
        FOREIGN KEY (university_id) REFERENCES University(university_id),
    -- A student id must be unique within its own university, but the same
    -- number may exist at a different one. MySQL allows repeated NULLs in a
    -- unique key, so students whose id isn't known yet coexist fine.
    CONSTRAINT uq_student_per_university UNIQUE (student_id, university_id)
);

-- =========================================================
-- TABLE: Course
-- =========================================================
CREATE TABLE Course (
    course_id           INT AUTO_INCREMENT PRIMARY KEY,
    course_name         VARCHAR(255) NOT NULL,
    external_course_id  VARCHAR(100),
    platform_source     VARCHAR(50),  -- e.g. 'Google Classroom', 'Microsoft Teams'
    student_id          INT NOT NULL,
    CONSTRAINT fk_course_student
        FOREIGN KEY (student_id) REFERENCES Student(user_id)
);

-- =========================================================
-- TABLE: Assignment
-- =========================================================
CREATE TABLE Assignment (
    assignment_id           INT AUTO_INCREMENT PRIMARY KEY,
    external_assignment_id  VARCHAR(100),
    title                   VARCHAR(255) NOT NULL,
    -- 'homework' | 'project' | 'quiz' | 'exam' | 'reading' | 'other'.
    -- Only set on manually added work; synced coursework leaves it NULL.
    task_type               VARCHAR(50),
    origin_link             VARCHAR(500),
    course_id               INT NOT NULL,
    CONSTRAINT fk_assignment_course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
);

-- =========================================================
-- TABLE: Assignment_Detail (1:1 weak entity of Assignment via "Act")
-- =========================================================
CREATE TABLE Assignment_Detail (
    assignment_id   INT PRIMARY KEY,
    description     TEXT,
    due_date        DATETIME,
    -- 'not_started' | 'in_progress' | 'submitted' | 'completed'. The student
    -- owns this (UC-5); Classroom only seeds it while status_updated_at is NULL.
    status          VARCHAR(50),
    -- Set only when the student changes status by hand. NULL therefore means
    -- "the platform still owns this row's status" — see backend/src/routes/classroom.js.
    status_updated_at DATETIME,
    priority_score  DECIMAL(5,2),
    CONSTRAINT fk_detail_assignment
        FOREIGN KEY (assignment_id) REFERENCES Assignment(assignment_id)
);

-- =========================================================
-- TABLE: Schedule (1:1 with Assignment_Detail)
-- =========================================================
CREATE TABLE Schedule (
    schedule_id     INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id   INT NOT NULL UNIQUE,
    start_time      DATETIME,
    end_time        DATETIME,
    time_estimate   INT,  -- minutes; derived attribute in diagram
    CONSTRAINT fk_schedule_detail
        FOREIGN KEY (assignment_id) REFERENCES Assignment_Detail(assignment_id)
);

-- =========================================================
-- TABLE: Notification (m side of Assignment_Detail 1—m Notification)
-- =========================================================
CREATE TABLE Notification (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id    INT NOT NULL,
    trigger_type     VARCHAR(50),  -- derived attribute in diagram
    sent_at          DATETIME,
    is_sent          BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_notification_detail
        FOREIGN KEY (assignment_id) REFERENCES Assignment_Detail(assignment_id)
);

-- =========================================================
-- No sample data — tables start empty. Universities you actually
-- support (for matching students by email domain) still need at
-- least one row here, e.g.:
--
-- INSERT INTO University (university_name, email_domain) VALUES
-- ('Your University', 'youruni.ac.th');
-- =========================================================