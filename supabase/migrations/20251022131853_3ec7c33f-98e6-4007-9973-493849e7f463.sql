-- Adicionar campos de produto na auditoria
ALTER TABLE public.gondola_audits 
ADD COLUMN IF NOT EXISTS produto_ean VARCHAR(50),
ADD COLUMN IF NOT EXISTS produto_descricao TEXT,
ADD COLUMN IF NOT EXISTS estoque_loja INTEGER;

-- Atualizar estrutura de concorrentes_detalhes para incluir produto e preço
COMMENT ON COLUMN public.gondola_audits.concorrentes_detalhes IS 'Estrutura: [{"nome": "...", "quantidade_frentes": 0, "produto_nome": "...", "preco_praticado": 0.00}]';

-- Criar tabela para análises IA de auditorias competitivas
CREATE TABLE IF NOT EXISTS public.gondola_competitive_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.gondola_audits(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  recommendations JSONB,
  competitive_score NUMERIC(5,2),
  price_competitiveness VARCHAR(50),
  shelf_share_impact VARCHAR(50),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.gondola_competitive_analysis ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários podem criar análises"
  ON public.gondola_competitive_analysis
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuários podem ver próprias análises"
  ON public.gondola_competitive_analysis
  FOR SELECT
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores gerenciam análises"
  ON public.gondola_competitive_analysis
  FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_competitive_analysis_audit ON public.gondola_competitive_analysis(audit_id);
CREATE INDEX IF NOT EXISTS idx_competitive_analysis_created ON public.gondola_competitive_analysis(created_at DESC);