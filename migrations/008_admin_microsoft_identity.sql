-- 008 — immutable Microsoft administrator identities.
-- Only for databases that applied 007 before these columns existed.
ALTER TABLE Admin
    ADD COLUMN microsoft_tenant_id VARCHAR(36) NULL,
    ADD COLUMN microsoft_object_id VARCHAR(36) NULL,
    ADD CONSTRAINT uq_admin_microsoft_identity
        UNIQUE (microsoft_tenant_id, microsoft_object_id);
