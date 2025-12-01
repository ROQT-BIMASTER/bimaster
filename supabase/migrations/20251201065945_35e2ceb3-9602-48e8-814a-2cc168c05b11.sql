-- Tabela para armazenar transações financeiras importadas do n8n
CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem VARCHAR(50) NOT NULL DEFAULT 'n8n', -- n8n, manual, api, etc
  origem_id VARCHAR(255), -- ID externo da transação
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  
  -- Classificação manual ou automática
  conta_id UUID REFERENCES public.trade_chart_of_accounts(id),
  departamento_id UUID REFERENCES public.departamentos(id),
  classificado_automaticamente BOOLEAN DEFAULT true,
  confianca_classificacao DECIMAL(3,2), -- 0.00 a 1.00
  
  -- Metadados
  dados_originais JSONB, -- JSON completo da origem
  observacoes TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Índices para performance
  CONSTRAINT unique_origem_transacao UNIQUE (origem, origem_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON public.transacoes_financeiras(data_transacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_departamento ON public.transacoes_financeiras(departamento_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_conta ON public.transacoes_financeiras(conta_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON public.transacoes_financeiras(tipo);

-- View materializada para análise por departamento
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_analise_departamentos AS
SELECT 
  d.id as departamento_id,
  d.nome as departamento_nome,
  DATE_TRUNC('month', tf.data_transacao) as periodo_mes,
  tf.tipo,
  COUNT(*) as total_transacoes,
  SUM(tf.valor) as valor_total,
  AVG(tf.valor) as valor_medio,
  AVG(tf.confianca_classificacao) as confianca_media,
  COUNT(CASE WHEN tf.classificado_automaticamente = true THEN 1 END) as classificacoes_automaticas,
  COUNT(CASE WHEN tf.classificado_automaticamente = false THEN 1 END) as classificacoes_manuais
FROM public.transacoes_financeiras tf
JOIN public.departamentos d ON d.id = tf.departamento_id
GROUP BY d.id, d.nome, DATE_TRUNC('month', tf.data_transacao), tf.tipo;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_analise_dept_periodo 
ON public.mv_analise_departamentos(departamento_id, periodo_mes, tipo);

-- Função para refresh da view
CREATE OR REPLACE FUNCTION public.refresh_analise_departamentos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analise_departamentos;
END;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_transacoes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_transacoes_updated_at
  BEFORE UPDATE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transacoes_updated_at();

-- RLS Policies
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e Supervisor veem todas transações"
  ON public.transacoes_financeiras
  FOR SELECT
  USING (
    public.is_admin_or_supervisor(auth.uid())
  );

CREATE POLICY "Admin pode inserir transações"
  ON public.transacoes_financeiras
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin pode atualizar transações"
  ON public.transacoes_financeiras
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin pode deletar transações"
  ON public.transacoes_financeiras
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
  );