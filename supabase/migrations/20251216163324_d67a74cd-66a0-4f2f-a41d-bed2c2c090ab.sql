-- Corrigir view para usar SECURITY INVOKER (padrão seguro)
DROP VIEW IF EXISTS public.vw_clientes_cobranca;

CREATE VIEW public.vw_clientes_cobranca 
WITH (security_invoker = true)
AS
SELECT 
  c.id as cliente_id,
  c.codigo as cliente_codigo,
  c.nome as cliente_nome,
  c.cnpj,
  c.email,
  c.telefone,
  c.celular,
  c.endereco,
  c.cidade,
  c.uf,
  c.limite_credito,
  c.status_bloqueio,
  c.rota,
  pf.score_atual,
  pf.score_classificacao,
  pf.dme,
  pf.pontualidade_percentual,
  pf.comportamento_pagamento,
  COALESCE(titulos.total_titulos, 0) as total_titulos_abertos,
  COALESCE(titulos.valor_total_aberto, 0) as valor_total_aberto,
  COALESCE(titulos.maior_atraso, 0) as maior_atraso_dias,
  COALESCE(titulos.titulo_mais_antigo, CURRENT_DATE) as vencimento_mais_antigo
FROM public.clientes c
LEFT JOIN public.clientes_perfil_credito pf ON pf.cliente_codigo = c.codigo
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as total_titulos,
    SUM(valor_aberto) as valor_total_aberto,
    MAX(dias_atraso) as maior_atraso,
    MIN(data_vencimento) as titulo_mais_antigo
  FROM public.contas_receber cr
  WHERE cr.cliente_codigo = c.codigo
    AND cr.status IN ('vencido', 'pendente')
    AND cr.valor_aberto > 0
) titulos ON true;