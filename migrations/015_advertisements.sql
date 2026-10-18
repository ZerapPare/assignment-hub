CREATE TABLE IF NOT EXISTS Advertisement (
    advertisement_id INT AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(160) NOT NULL,
    link_url         VARCHAR(2048) NOT NULL,
    image_filename   VARCHAR(80) NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_by       INT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_advertisement_creator
        FOREIGN KEY (created_by) REFERENCES User_Account(user_id) ON DELETE SET NULL,
    INDEX idx_advertisement_active (is_active)
);
