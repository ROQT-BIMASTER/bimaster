-- Remover a view com SECURITY DEFINER e torná-la uma view normal
DROP VIEW IF EXISTS public.vw_analise_departamentos_completa;

-- Recriar como view normal (sem SECURITY DEFINER)
CREATE VIEW public.vw_analise_departamentos_completa AS
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

-- Revogar acesso público à view para segurança
REVOKE ALL ON public.vw_analise_departamentos_completa FROM anon, authenticated;

-- A função get_analise_departamentos_completa já tem SECURITY DEFINER e search_path corretos
-- Não precisa de alteração