-- Tabla de bitcora de eventos sensibles (E3 de INFORME-F4.1)
-- Recomendacin para F5: tabla audit_log para eventos sensibles.
-- Integracin completa con el modelo EF en F6.
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     character varying(64) NOT NULL,
    business_id character varying(64),
    event       character varying(64) NOT NULL,
    meta        jsonb DEFAULT '{}',
    created_at  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IX_audit_log_user_id ON audit_log (user_id);
CREATE INDEX IX_audit_log_business_id ON audit_log (business_id);
CREATE INDEX IX_audit_log_created_at ON audit_log (created_at);
CREATE INDEX IX_audit_log_business_event ON audit_log (business_id, event);
