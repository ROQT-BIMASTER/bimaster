
ALTER TABLE erp_export_queue
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id);

ALTER TABLE erp_sync_log
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id);

ALTER TABLE erp_config
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id);
