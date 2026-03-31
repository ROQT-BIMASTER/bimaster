
-- vw_clientes_cobranca — recreate as security_invoker with original definition
DROP VIEW IF EXISTS public.vw_clientes_cobranca;
CREATE VIEW public.vw_clientes_cobranca
WITH (security_invoker = true) AS
SELECT c.id AS cliente_id,
  c.codigo AS cliente_codigo,
  c.nome AS cliente_nome,
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
  COALESCE(titulos.total_titulos, 0::bigint) AS total_titulos_abertos,
  COALESCE(titulos.valor_total_aberto, 0::numeric) AS valor_total_aberto,
  COALESCE(titulos.maior_atraso, 0) AS maior_atraso_dias,
  COALESCE(titulos.titulo_mais_antigo, CURRENT_DATE) AS vencimento_mais_antigo
FROM clientes c
LEFT JOIN clientes_perfil_credito pf ON pf.cliente_codigo::text = c.codigo::text
LEFT JOIN LATERAL (
  SELECT count(*) AS total_titulos,
    sum(cr.valor_aberto) AS valor_total_aberto,
    max(cr.dias_atraso) AS maior_atraso,
    min(cr.data_vencimento) AS titulo_mais_antigo
  FROM contas_receber cr
  WHERE cr.cliente_codigo = c.codigo::text
    AND cr.status = ANY (ARRAY['vencido','pendente'])
    AND cr.valor_aberto > 0::numeric
) titulos ON true;
