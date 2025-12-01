-- Adicionar campo departamento_id em contas_pagar
ALTER TABLE public.contas_pagar 
ADD COLUMN IF NOT EXISTS departamento_id UUID REFERENCES public.departamentos(id),
ADD COLUMN IF NOT EXISTS classificado_automaticamente BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confianca_classificacao DECIMAL(3,2);

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_contas_pagar_departamento ON public.contas_pagar(departamento_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_vencimento ON public.contas_pagar(data_vencimento);

-- Criar view unificada para análise de departamentos (incluindo contas a pagar)
CREATE OR REPLACE VIEW public.vw_analise_departamentos_completa AS
SELECT 
  d.id as departamento_id,
  d.nome as departamento_nome,
  'despesa' as tipo,
  DATE_TRUNC('month', cp.data_vencimento) as periodo_mes,
  SUM(cp.valor_original) as valor_total,
  COUNT(*) as total_transacoes,
  SUM(CASE WHEN cp.classificado_automaticamente THEN 1 ELSE 0 END) as classificacoes_automaticas,
  SUM(CASE WHEN NOT cp.classificado_automaticamente THEN 1 ELSE 0 END) as classificacoes_manuais
FROM public.contas_pagar cp
JOIN public.departamentos d ON cp.departamento_id = d.id
WHERE cp.departamento_id IS NOT NULL
GROUP BY d.id, d.nome, DATE_TRUNC('month', cp.data_vencimento)

UNION ALL

SELECT 
  d.id as departamento_id,
  d.nome as departamento_nome,
  tf.tipo,
  DATE_TRUNC('month', tf.data_transacao) as periodo_mes,
  SUM(tf.valor) as valor_total,
  COUNT(*) as total_transacoes,
  SUM(CASE WHEN tf.classificado_automaticamente THEN 1 ELSE 0 END) as classificacoes_automaticas,
  SUM(CASE WHEN NOT tf.classificado_automaticamente THEN 1 ELSE 0 END) as classificacoes_manuais
FROM public.transacoes_financeiras tf
JOIN public.departamentos d ON tf.departamento_id = d.id
WHERE tf.departamento_id IS NOT NULL
GROUP BY d.id, d.nome, tf.tipo, DATE_TRUNC('month', tf.data_transacao);

-- Criar função RPC segura para buscar análise completa
CREATE OR REPLACE FUNCTION public.get_analise_departamentos_completa(
  p_periodo_inicio DATE,
  p_periodo_fim DATE,
  p_departamento_id UUID DEFAULT NULL
)
RETURNS TABLE (
  departamento_id UUID,
  departamento_nome TEXT,
  tipo TEXT,
  periodo_mes TIMESTAMP WITH TIME ZONE,
  valor_total NUMERIC,
  total_transacoes BIGINT,
  classificacoes_automaticas BIGINT,
  classificacoes_manuais BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.departamento_id,
    v.departamento_nome,
    v.tipo,
    v.periodo_mes,
    v.valor_total,
    v.total_transacoes,
    v.classificacoes_automaticas,
    v.classificacoes_manuais
  FROM public.vw_analise_departamentos_completa v
  WHERE v.periodo_mes >= p_periodo_inicio
    AND v.periodo_mes <= p_periodo_fim
    AND (p_departamento_id IS NULL OR v.departamento_id = p_departamento_id)
  ORDER BY v.periodo_mes DESC, v.departamento_nome;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_analise_departamentos_completa TO authenticated;