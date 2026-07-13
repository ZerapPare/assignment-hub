CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  provider ENUM('google','microsoft')
);

CREATE TABLE assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(200),
  subject VARCHAR(100),
  platform ENUM('google','teams','manual'),
  deadline DATETIME,
  estimated_hours FLOAT,
  status ENUM('not_started','in_progress','complete','submitted') DEFAULT 'not_started',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notification_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  remind_before_hours INT DEFAULT 72,
  daily_reminder_enabled BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO users (name, email, provider) VALUES
('Somchai', 'somchai@gmail.com', 'google'),
('Malee', 'malee@outlook.com', 'microsoft');

INSERT INTO assignments (user_id, title, subject, platform, deadline, estimated_hours, status) VALUES
(1, 'Lab 3 Database', 'Digital Innovation', 'google', '2026-07-20 23:59:00', 2, 'not_started'),
(1, 'Essay Chapter 2', 'English', 'teams', '2026-07-18 23:59:00', 3, 'in_progress'),
(2, 'Presentation Slides', 'Digital Innovation', 'manual', '2026-07-22 12:00:00', 4, 'not_started');

INSERT INTO notification_settings (user_id, remind_before_hours, daily_reminder_enabled) VALUES
(1, 72, TRUE),
(2, 24, FALSE);