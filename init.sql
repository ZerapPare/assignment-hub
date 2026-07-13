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
CREATE TABLE University (
    university_id   INT AUTO_INCREMENT PRIMARY KEY,
    university_name VARCHAR(255) NOT NULL,
    email_domain    VARCHAR(100) NOT NULL
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
        FOREIGN KEY (university_id) REFERENCES University(university_id)
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
    status          VARCHAR(50),        -- derived attribute in diagram
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
-- SAMPLE DATA
-- =========================================================

INSERT INTO University (university_name, email_domain) VALUES
('Chulalongkorn University', 'chula.ac.th'),
('Thammasat University', 'tu.ac.th');

INSERT INTO Student (student_id, student_name, university_email, university_id, gg_access_token, gg_refresh_token, ms_access_token, ms_refresh_token) VALUES
('6410001', 'Napat Suwannachot', 'napat.s@chula.ac.th', 1, 'gg_access_tok_abc123', 'gg_refresh_tok_abc123', 'ms_access_tok_abc123', 'ms_refresh_tok_abc123'),
('6410002', 'Pim Charoensuk',    'pim.c@tu.ac.th',      2, 'gg_access_tok_def456', 'gg_refresh_tok_def456', NULL, NULL);

INSERT INTO Course (course_name, external_course_id, platform_source, student_id) VALUES
('Database Systems',        'gc-DB2026-101', 'Google Classroom',   1),
('Software Engineering',    'ms-SE2026-202', 'Microsoft Teams',    1),
('Data Structures & Algo',  'gc-DSA2026-303','Google Classroom',   2);

INSERT INTO Assignment (external_assignment_id, title, origin_link, course_id) VALUES
('gc-a-9001', 'ER Diagram Design',       'https://classroom.google.com/c/1/a/9001', 1),
('gc-a-9002', 'SQL Normalization Quiz',  'https://classroom.google.com/c/1/a/9002', 1),
('ms-a-7001', 'Sprint Planning Report',  'https://teams.microsoft.com/2/a/7001',    2),
('gc-a-5001', 'Binary Tree Homework',    'https://classroom.google.com/c/3/a/5001', 3);

INSERT INTO Assignment_Detail (assignment_id, description, due_date, status, priority_score) VALUES
(1, 'Design an ER diagram for the Assignment Hub project.', '2026-07-20 23:59:00', 'in_progress', 8.5),
(2, 'Complete the online quiz covering normal forms.',       '2026-07-18 15:00:00', 'not_started', 6.0),
(3, 'Write a report summarizing sprint 3 progress.',          '2026-07-25 23:59:00', 'not_started', 7.2),
(4, 'Implement and analyze binary tree operations.',           '2026-07-22 23:59:00', 'completed',   5.0);

INSERT INTO Schedule (assignment_id, start_time, end_time, time_estimate) VALUES
(1, '2026-07-14 09:00:00', '2026-07-14 12:00:00', 180),
(2, '2026-07-17 19:00:00', '2026-07-17 20:30:00', 90),
(3, '2026-07-23 13:00:00', '2026-07-23 17:00:00', 240),
(4, '2026-07-20 10:00:00', '2026-07-20 13:00:00', 180);

INSERT INTO Notification (assignment_id, trigger_type, sent_at, is_sent) VALUES
(1, 'due_soon',   '2026-07-19 09:00:00', FALSE),
(1, 'reminder',   '2026-07-13 09:00:00', TRUE),
(2, 'due_soon',   '2026-07-17 15:00:00', TRUE),
(3, 'reminder',   '2026-07-22 09:00:00', FALSE),
(4, 'completed',  '2026-07-20 13:05:00', TRUE);