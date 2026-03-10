
ALTER TABLE china_produto_submissoes
  ADD COLUMN IF NOT EXISTS arte_final_url text,
  ADD COLUMN IF NOT EXISTS arte_final_path text,
  ADD COLUMN IF NOT EXISTS arte_final_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS ean_caixa_master text;

ALTER TABLE china_ordens_compra
  ADD COLUMN IF NOT EXISTS ean_caixa_master text;
