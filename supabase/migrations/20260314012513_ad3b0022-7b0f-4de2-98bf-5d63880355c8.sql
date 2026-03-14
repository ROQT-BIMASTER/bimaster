
ALTER TABLE china_doc_revisoes 
  ADD COLUMN IF NOT EXISTS acao_tipo TEXT,
  ADD COLUMN IF NOT EXISTS acao_por_nome TEXT;
