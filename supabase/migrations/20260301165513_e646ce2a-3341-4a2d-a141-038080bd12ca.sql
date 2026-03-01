
-- Adicionar solicitante nos requisitos
ALTER TABLE fabrica_revisao_requisitos 
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS criado_por_nome text;

-- Vincular evidências ao requisito que atenderam
ALTER TABLE fabrica_custo_evidencias 
  ADD COLUMN IF NOT EXISTS requisito_id uuid REFERENCES fabrica_revisao_requisitos(id);

-- Index para buscar evidências por requisito
CREATE INDEX IF NOT EXISTS idx_evidencias_requisito_id ON fabrica_custo_evidencias(requisito_id);
