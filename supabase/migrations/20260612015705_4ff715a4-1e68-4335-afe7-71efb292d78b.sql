DROP VIEW IF EXISTS public.vw_estoque_unificado_skus;
DROP VIEW IF EXISTS public.vw_composicao_qtd_zero_alerta;

-- 1) View de alertas: composições do ERP com quantidade ausente
CREATE VIEW public.vw_composicao_qtd_zero_alerta
WITH (security_invoker = true)
AS
SELECT
  c.empresa_compo AS empresa,
  c.produto_compo AS pai_cod,
  pp.nome_prod    AS pai_nome,
  c.materia_compo AS filho_cod,
  pf.nome_prod    AS filho_nome,
  COALESCE(c.quantidade_compo, 0) AS quantidade_atual,
  c.sincronizado_em
FROM public.erp_composicao_produto c
LEFT JOIN LATERAL (
  SELECT MAX(e.nome_prod) AS nome_prod
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto = c.produto_compo
) pp ON true
LEFT JOIN LATERAL (
  SELECT MAX(e.nome_prod) AS nome_prod
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto = c.materia_compo
) pf ON true
WHERE COALESCE(c.quantidade_compo, 0) <= 0;

GRANT SELECT ON public.vw_composicao_qtd_zero_alerta TO authenticated;
GRANT SELECT ON public.vw_composicao_qtd_zero_alerta TO service_role;


-- 2) View detalhada por SKU — agora a partir de erp_composicao_produto
CREATE VIEW public.vw_estoque_unificado_skus
WITH (security_invoker = true)
AS
WITH RECURSIVE fator_desc AS (
  SELECT DISTINCT c.materia_compo AS sku, 1::numeric AS fator
  FROM public.erp_composicao_produto c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.erp_composicao_produto c2
    WHERE c2.produto_compo = c.materia_compo
  )
  UNION ALL
  SELECT c.produto_compo,
         (GREATEST(COALESCE(c.quantidade_compo, 1), 1) * fd.fator)::numeric
  FROM public.erp_composicao_produto c
  JOIN fator_desc fd ON fd.sku = c.materia_compo
),
fator_por_sku AS (
  SELECT sku, MAX(fator)::numeric AS fator_un
  FROM fator_desc
  GROUP BY sku
),
estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         MAX(e.nome_prod) AS nome_prod,
         MAX(e.abrev_par) AS abrev_par,
         SUM(COALESCE(e.saldo, 0)) AS saldo,
         SUM(COALESCE(e.custo_total, 0)) AS custo_total
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa, es.cod_produto, es.nome_prod, es.abrev_par,
         es.saldo, es.custo_total,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
  FROM estoque es
  LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
),
pai_de AS (
  SELECT DISTINCT ON (c.materia_compo)
         c.materia_compo AS filho_cod,
         c.produto_compo AS pai_cod,
         GREATEST(COALESCE(c.quantidade_compo, 1), 1) AS quantidade
  FROM public.erp_composicao_produto c
  ORDER BY c.materia_compo, c.sincronizado_em DESC NULLS LAST
)
SELECT c.empresa,
       c.produto_raiz,
       c.cod_produto,
       c.nome_prod,
       c.abrev_par,
       fp.codigo_barras_ean,
       c.nivel,
       pd.pai_cod,
       pd.quantidade AS fator_pai_para_filho,
       COALESCE(fps.fator_un, 1)::numeric AS fator_un_acumulado,
       c.saldo,
       c.custo_total,
       (c.saldo * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_un
FROM classificado c
LEFT JOIN fator_por_sku fps ON fps.sku = c.cod_produto
LEFT JOIN pai_de pd ON pd.filho_cod = c.cod_produto
LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = c.cod_produto::text;

GRANT SELECT ON public.vw_estoque_unificado_skus TO authenticated;
GRANT SELECT ON public.vw_estoque_unificado_skus TO service_role;


-- 3) Refresh do cache — mesma fonte/regra
CREATE OR REPLACE FUNCTION public.refresh_estoque_unificado_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  TRUNCATE public.estoque_unificado_cache;

  WITH RECURSIVE fator_desc AS (
    SELECT DISTINCT c.materia_compo AS sku, 1::numeric AS fator
    FROM public.erp_composicao_produto c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.erp_composicao_produto c2
      WHERE c2.produto_compo = c.materia_compo
    )
    UNION ALL
    SELECT c.produto_compo,
           (GREATEST(COALESCE(c.quantidade_compo, 1), 1) * fd.fator)::numeric
    FROM public.erp_composicao_produto c
    JOIN fator_desc fd ON fd.sku = c.materia_compo
  ),
  fator_por_sku AS (
    SELECT sku, MAX(fator)::numeric AS fator_un
    FROM fator_desc
    GROUP BY sku
  ),
  estoque AS (
    SELECT e.empresa_par AS empresa,
           e.cod_produto,
           SUM(COALESCE(e.saldo, 0)) AS saldo_total,
           SUM(COALESCE(e.custo_total, 0)) AS custo_total
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
    GROUP BY e.empresa_par, e.cod_produto
  ),
  classificado AS (
    SELECT es.empresa, es.cod_produto, es.saldo_total, es.custo_total,
           n.nivel,
           COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz,
           COALESCE(fps.fator_un, 1)::numeric AS fator_un
    FROM estoque es
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
    LEFT JOIN fator_por_sku fps ON fps.sku = es.cod_produto
  ),
  agg AS (
    SELECT c.empresa,
           c.produto_raiz,
           SUM(CASE WHEN c.nivel = 1 THEN c.saldo_total ELSE 0 END) AS saldo_em_caixas,
           SUM(CASE WHEN c.nivel = 2 THEN c.saldo_total ELSE 0 END) AS saldo_em_displays,
           SUM(CASE WHEN c.nivel = 3 THEN c.saldo_total ELSE 0 END) AS saldo_em_unidades,
           COALESCE(SUM(c.saldo_total * c.fator_un), 0) AS saldo_total_em_unidades,
           SUM(c.custo_total) AS custo_total,
           COUNT(DISTINCT c.cod_produto)::int AS skus_envolvidos
    FROM classificado c
    GROUP BY c.empresa, c.produto_raiz
  ),
  fatores AS (
    SELECT a.empresa,
           a.produto_raiz,
           COALESCE((SELECT fps.fator_un FROM fator_por_sku fps WHERE fps.sku = a.produto_raiz), 1) AS fator_cx_para_un,
           COALESCE((
             SELECT MAX(fps2.fator_un)
             FROM public.erp_composicao_produto c
             JOIN fator_por_sku fps2 ON fps2.sku = c.materia_compo
             WHERE c.produto_compo = a.produto_raiz
           ), 1) AS fator_bx_para_un
    FROM agg a
  )
  INSERT INTO public.estoque_unificado_cache (
    empresa, produto_raiz,
    saldo_em_caixas, saldo_em_displays, saldo_em_unidades,
    saldo_total_em_unidades, custo_total, skus_envolvidos,
    fator_cx_para_un, fator_bx_para_un, ean_raiz, atualizado_em
  )
  SELECT a.empresa, a.produto_raiz,
         a.saldo_em_caixas, a.saldo_em_displays, a.saldo_em_unidades,
         a.saldo_total_em_unidades, a.custo_total, a.skus_envolvidos,
         f.fator_cx_para_un, f.fator_bx_para_un,
         fp.codigo_barras_ean,
         now()
  FROM agg a
  LEFT JOIN fatores f ON f.empresa = a.empresa AND f.produto_raiz = a.produto_raiz
  LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = a.produto_raiz::text;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;


-- 4) Cores: alinha o tratamento de qtd=0/NULL com fator=1
CREATE OR REPLACE FUNCTION public.rpc_estoque_cores(
  p_empresas integer[] DEFAULT NULL,
  p_linhas text[] DEFAULT NULL,
  p_campanha_ids uuid[] DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_apenas_com_saldo boolean DEFAULT false,
  p_com_pedido_pendente boolean DEFAULT false,
  p_curva_fisica text[] DEFAULT NULL,
  p_curva_monetaria text[] DEFAULT NULL,
  p_incluir_potencial boolean DEFAULT true,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_order_by text DEFAULT 'saldo_total_disponivel',
  p_order_dir text DEFAULT 'desc'
)
RETURNS TABLE (
  id text, empresa_par integer, abrev_par text, cod_produto integer,
  cod_fabricante text, nome_prod text, nome_linha text, unidade_medida text,
  saldo numeric, pedido_pendente numeric, custo_unitario numeric,
  custo_total numeric, valor_venda numeric, curva_fisica text, curva_monetaria text,
  data_ultima_compra date, validade date, lote text, localizacao text,
  estoque_endereco numeric, estoque_bloqueado_produto numeric,
  estoque_bloqueado_endereco numeric, sincronizado_em timestamptz,
  saldo_proprio numeric, saldo_potencial_desmontagem numeric,
  saldo_total_disponivel numeric, tem_composicao_pai boolean,
  detalhe_desmontagem jsonb, total_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_empresas integer[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_is_admin := has_role(v_user, 'admin'::app_role) OR has_role(v_user, 'gerente'::app_role);
  IF v_is_admin THEN
    SELECT array_agg(DISTINCT e.empresa_par) INTO v_empresas
    FROM erp_estoque_distribuidora e WHERE e.empresa_par IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT ue.empresa_id) INTO v_empresas
    FROM user_empresas ue WHERE ue.user_id = v_user;
  END IF;
  IF v_empresas IS NULL THEN v_empresas := ARRAY[]::integer[]; END IF;
  IF p_empresas IS NOT NULL AND array_length(p_empresas, 1) > 0 THEN
    v_empresas := ARRAY(SELECT unnest(v_empresas) INTERSECT SELECT unnest(p_empresas));
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  folhas AS (
    SELECT DISTINCT c.materia_compo AS cod_folha
    FROM erp_composicao_produto c
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_composicao_produto c2 WHERE c2.produto_compo = c.materia_compo
    )
  ),
  caminhos AS (
    SELECT
      c.materia_compo AS cod_folha,
      c.produto_compo AS cod_ancestor,
      GREATEST(COALESCE(c.quantidade_compo, 1), 1)::numeric AS fator,
      1 AS depth,
      ARRAY[c.materia_compo, c.produto_compo]::integer[] AS visited
    FROM erp_composicao_produto c
    JOIN folhas f ON f.cod_folha = c.materia_compo
    UNION ALL
    SELECT p.cod_folha, c.produto_compo,
           p.fator * GREATEST(COALESCE(c.quantidade_compo, 1), 1)::numeric,
           p.depth + 1, p.visited || c.produto_compo
    FROM caminhos p
    JOIN erp_composicao_produto c ON c.materia_compo = p.cod_ancestor
    WHERE p.depth < 5 AND NOT (c.produto_compo = ANY(p.visited))
  ),
  saldo_folha AS (
    SELECT e.id::text AS id, e.empresa_par, e.abrev_par, e.cod_produto,
      e.cod_fabricante, e.nome_prod, e.nome_linha, e.unidade_medida,
      e.saldo, e.pedido_pendente, e.custo_unitario, e.custo_total, e.valor_venda,
      e.curva_fisica, e.curva_monetaria, e.data_ultima_compra, e.validade,
      e.lote, e.localizacao, e.estoque_endereco,
      e.estoque_bloqueado_produto, e.estoque_bloqueado_endereco, e.sincronizado_em
    FROM erp_estoque_distribuidora e
    JOIN folhas f ON f.cod_folha = e.cod_produto
    WHERE e.empresa_par = ANY(v_empresas)
  ),
  potencial AS (
    SELECT ep.empresa_par, cam.cod_folha AS cod_produto,
      SUM(COALESCE(ep.saldo, 0) * cam.fator) AS saldo_potencial,
      jsonb_agg(
        jsonb_build_object(
          'cod_pai', ep.cod_produto, 'nome_pai', ep.nome_prod,
          'saldo_pai', ep.saldo, 'fator', cam.fator,
          'contribuicao', COALESCE(ep.saldo, 0) * cam.fator
        ) ORDER BY (COALESCE(ep.saldo, 0) * cam.fator) DESC
      ) FILTER (WHERE COALESCE(ep.saldo,0) > 0) AS detalhe
    FROM caminhos cam
    JOIN erp_estoque_distribuidora ep
      ON ep.cod_produto = cam.cod_ancestor AND ep.empresa_par = ANY(v_empresas)
    GROUP BY ep.empresa_par, cam.cod_folha
  ),
  base AS (
    SELECT COALESCE(sf.id, 'virt-'||po.empresa_par||'-'||po.cod_produto) AS id,
      COALESCE(sf.empresa_par, po.empresa_par) AS empresa_par,
      sf.abrev_par, COALESCE(sf.cod_produto, po.cod_produto) AS cod_produto,
      sf.cod_fabricante, sf.nome_prod, sf.nome_linha, sf.unidade_medida,
      COALESCE(sf.saldo, 0) AS saldo_proprio_v,
      COALESCE(po.saldo_potencial, 0) AS saldo_potencial_v,
      sf.pedido_pendente, sf.custo_unitario, sf.custo_total, sf.valor_venda,
      sf.curva_fisica, sf.curva_monetaria, sf.data_ultima_compra, sf.validade,
      sf.lote, sf.localizacao, sf.estoque_endereco,
      sf.estoque_bloqueado_produto, sf.estoque_bloqueado_endereco, sf.sincronizado_em,
      (po.cod_produto IS NOT NULL) AS tem_pai, po.detalhe
    FROM saldo_folha sf
    FULL OUTER JOIN potencial po
      ON po.empresa_par = sf.empresa_par AND po.cod_produto = sf.cod_produto
  ),
  filtrado AS (
    SELECT * FROM base b
    WHERE (p_linhas IS NULL OR b.nome_linha = ANY(p_linhas))
      AND (p_curva_fisica IS NULL OR b.curva_fisica = ANY(p_curva_fisica))
      AND (p_curva_monetaria IS NULL OR b.curva_monetaria = ANY(p_curva_monetaria))
      AND (NOT p_com_pedido_pendente OR COALESCE(b.pedido_pendente,0) > 0)
      AND (p_busca IS NULL OR p_busca = ''
        OR b.nome_prod ILIKE '%'||p_busca||'%'
        OR b.cod_fabricante ILIKE '%'||p_busca||'%'
        OR b.cod_produto::text = p_busca)
      AND (p_campanha_ids IS NULL OR EXISTS (
          SELECT 1 FROM estoque_etiqueta_produtos ep
          WHERE ep.cod_produto = b.cod_produto AND ep.etiqueta_id = ANY(p_campanha_ids)
        ))
  ),
  calc AS (
    SELECT f.*,
      CASE WHEN p_incluir_potencial THEN f.saldo_proprio_v + f.saldo_potencial_v
           ELSE f.saldo_proprio_v END AS saldo_final
    FROM filtrado f
    WHERE NOT p_apenas_com_saldo
       OR (CASE WHEN p_incluir_potencial THEN f.saldo_proprio_v + f.saldo_potencial_v
                ELSE f.saldo_proprio_v END) > 0
  ),
  counted AS (SELECT c.*, COUNT(*) OVER () AS _total FROM calc c)
  SELECT c.id, c.empresa_par, c.abrev_par, c.cod_produto, c.cod_fabricante,
    c.nome_prod, c.nome_linha, c.unidade_medida, c.saldo_final AS saldo,
    c.pedido_pendente, c.custo_unitario, c.custo_total, c.valor_venda,
    c.curva_fisica, c.curva_monetaria, c.data_ultima_compra, c.validade,
    c.lote, c.localizacao, c.estoque_endereco,
    c.estoque_bloqueado_produto, c.estoque_bloqueado_endereco, c.sincronizado_em,
    c.saldo_proprio_v AS saldo_proprio,
    c.saldo_potencial_v AS saldo_potencial_desmontagem,
    (c.saldo_proprio_v + c.saldo_potencial_v) AS saldo_total_disponivel,
    c.tem_pai AS tem_composicao_pai, c.detalhe AS detalhe_desmontagem,
    c._total AS total_count
  FROM counted c
  ORDER BY
    CASE WHEN p_order_by = 'nome_prod' AND p_order_dir = 'asc'  THEN c.nome_prod END ASC,
    CASE WHEN p_order_by = 'nome_prod' AND p_order_dir = 'desc' THEN c.nome_prod END DESC,
    CASE WHEN p_order_by = 'empresa_par' AND p_order_dir = 'asc'  THEN c.empresa_par END ASC,
    CASE WHEN p_order_by = 'empresa_par' AND p_order_dir = 'desc' THEN c.empresa_par END DESC,
    CASE WHEN p_order_by = 'saldo' AND p_order_dir = 'asc'  THEN c.saldo_final END ASC,
    CASE WHEN p_order_by = 'saldo' AND p_order_dir = 'desc' THEN c.saldo_final END DESC,
    CASE WHEN p_order_by = 'saldo_total_disponivel' AND p_order_dir = 'asc'  THEN (c.saldo_proprio_v + c.saldo_potencial_v) END ASC,
    CASE WHEN p_order_by = 'saldo_total_disponivel' AND p_order_dir = 'desc' THEN (c.saldo_proprio_v + c.saldo_potencial_v) END DESC,
    CASE WHEN p_order_by = 'saldo_potencial_desmontagem' AND p_order_dir = 'desc' THEN c.saldo_potencial_v END DESC,
    CASE WHEN p_order_by = 'pedido_pendente' AND p_order_dir = 'desc' THEN c.pedido_pendente END DESC,
    CASE WHEN p_order_by = 'custo_total' AND p_order_dir = 'desc' THEN c.custo_total END DESC,
    CASE WHEN p_order_by = 'custo_total' AND p_order_dir = 'asc'  THEN c.custo_total END ASC
  LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0);
END
$$;


-- 5) Reprocessa o cache agora
SELECT public.refresh_estoque_unificado_cache();