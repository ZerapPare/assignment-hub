-- =========================================================
-- 006 — product/business analytics events
--
-- Apply after migrations 001–005:
--
--   docker compose exec -T db mysql -uroot -proot123 assignment_hub \
--     < migrations/006_product_analytics.sql
-- =========================================================

CREATE TABLE Product_Event (
    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    feature_name VARCHAR(80) NOT NULL,
    event_result VARCHAR(20) NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_event_student
        FOREIGN KEY (user_id)
        REFERENCES Student(user_id)
        ON DELETE CASCADE,

    INDEX idx_product_event_created (created_at),
    INDEX idx_product_event_feature_created (feature_name, created_at),
    INDEX idx_product_event_name_created (event_name, created_at),
    INDEX idx_product_event_user_created (user_id, created_at)
);
