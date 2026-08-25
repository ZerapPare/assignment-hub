-- =========================================================
-- 008 — immutable Microsoft administrator identities
--
-- Apply only to databases where 007_admin_identity.sql was already applied
-- before the Microsoft identity columns were added.
-- =========================================================

ALTER TABLE Admin
    ADD COLUMN microsoft_tenant_id VARCHAR(36) NULL,
    ADD COLUMN microsoft_object_id VARCHAR(36) NULL,
    ADD CONSTRAINT uq_admin_microsoft_identity
        UNIQUE (microsoft_tenant_id, microsoft_object_id);
