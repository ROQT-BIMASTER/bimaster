
-- 1) Adicionar coluna nome_raiz no cache
ALTER TABLE public.estoque_unificado_cache
  ADD COLUMN IF NOT EXISTS nome_raiz TEXT;

-- 2) Reescrever refresh_estoque_unificado_cache para popular nome_raiz
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
           SUM(COALESCE(e.saldo, 0))                     AS saldo_total,
           SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado_total,
           SUM(COALESCE(e.pedido_pendente, 0))           AS pendente_total,
           SUM(COALESCE(e.custo_total, 0))               AS custo_total
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
    GROUP BY e.empresa_par, e.cod_produto
  ),
  classificado AS (
    SELECT es.empresa, es.cod_produto,
           es.saldo_total,
           es.bloqueado_total,
           es.pendente_total,
           GREATEST(es.saldo_total - es.bloqueado_total, 0) AS disponivel_total,
           es.custo_total,
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
           COALESCE(SUM(c.saldo_total      * c.fator_un), 0) AS saldo_total_em_unidades,
           COALESCE(SUM(c.bloqueado_total  * c.fator_un), 0) AS bloqueado_total_em_unidades,
           COALESCE(SUM(c.disponivel_total * c.fator_un), 0) AS disponivel_total_em_unidades,
           COALESCE(SUM(c.pendente_total   * c.fator_un), 0) AS pendente_total_em_unidades,
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
  ),
  -- Nome derivado da BOM: para cada (empresa, produto_raiz) sem nome próprio
  -- em erp_estoque_distribuidora, pega a folha de maior profundidade (SKU
  -- unitário) e, em caso de empate, o maior nome.
  nome_folha AS (
    SELECT DISTINCT ON (bp.empresa, bp.raiz_cod)
           bp.empresa,
           bp.raiz_cod AS produto_raiz,
           regexp_replace(e.nome_prod, '^(BX|CX|DP|DSP|MASTER|KIT)\s+', '', 'i') AS nome
    FROM public.vw_bom_path bp
    JOIN public.erp_estoque_distribuidora e
      ON e.cod_produto = bp.folha_cod
     AND e.empresa_par = bp.empresa
    WHERE e.nome_prod IS NOT NULL AND btrim(e.nome_prod) <> ''
    ORDER BY bp.empresa, bp.raiz_cod, bp.profundidade DESC, length(e.nome_prod) DESC
  ),
  -- Fallback global: alguma filial tem o nome do raiz cadastrado?
  nome_raiz_direto AS (
    SELECT cod_produto AS produto_raiz, MAX(nome_prod) AS nome
    FROM public.erp_estoque_distribuidora
    WHERE nome_prod IS NOT NULL AND btrim(nome_prod) <> ''
    GROUP BY cod_produto
  ),
  -- Fallback global por BOM (qualquer empresa): cobre raízes cujo cadastro
  -- da folha está somente em outra filial.
  nome_folha_global AS (
    SELECT DISTINCT ON (bp.raiz_cod)
           bp.raiz_cod AS produto_raiz,
           regexp_replace(e.nome_prod, '^(BX|CX|DP|DSP|MASTER|KIT)\s+', '', 'i') AS nome
    FROM public.vw_bom_path bp
    JOIN public.erp_estoque_distribuidora e ON e.cod_produto = bp.folha_cod
    WHERE e.nome_prod IS NOT NULL AND btrim(e.nome_prod) <> ''
    ORDER BY bp.raiz_cod, bp.profundidade DESC, length(e.nome_prod) DESC
  ),
  -- Último fallback: nome_comercial em fabrica_produtos
  nome_fabrica AS (
    SELECT (codigo_erp)::text AS chave, MAX(COALESCE(nome_comercial, nome)) AS nome
    FROM public.fabrica_produtos
    WHERE COALESCE(nome_comercial, nome) IS NOT NULL
    GROUP BY codigo_erp
  )
  INSERT INTO public.estoque_unificado_cache (
    empresa, produto_raiz,
    saldo_em_caixas, saldo_em_displays, saldo_em_unidades,
    saldo_total_em_unidades,
    bloqueado_total_em_unidades, disponivel_total_em_unidades, pendente_total_em_unidades,
    custo_total, skus_envolvidos,
    fator_cx_para_un, fator_bx_para_un, ean_raiz, nome_raiz, atualizado_em
  )
  SELECT a.empresa, a.produto_raiz,
         a.saldo_em_caixas, a.saldo_em_displays, a.saldo_em_unidades,
         a.saldo_total_em_unidades,
         a.bloqueado_total_em_unidades, a.disponivel_total_em_unidades, a.pendente_total_em_unidades,
         a.custo_total, a.skus_envolvidos,
         f.fator_cx_para_un, f.fator_bx_para_un,
         fp.codigo_barras_ean,
         COALESCE(
           nrd.nome,                              -- 1) raiz cadastrado direto no ERP
           nf.nome,                               -- 2) folha mais profunda na mesma empresa
           ng.nome,                               -- 3) folha mais profunda em qualquer empresa
           nfc.nome                               -- 4) fabrica_produtos.nome_comercial
         ) AS nome_raiz,
         now()
  FROM agg a
  LEFT JOIN fatores f
    ON f.empresa = a.empresa AND f.produto_raiz = a.produto_raiz
  LEFT JOIN public.fabrica_produtos fp
    ON fp.codigo::text = a.produto_raiz::text
  LEFT JOIN nome_raiz_direto nrd
    ON nrd.produto_raiz = a.produto_raiz
  LEFT JOIN nome_folha nf
    ON nf.empresa = a.empresa AND nf.produto_raiz = a.produto_raiz
  LEFT JOIN nome_folha_global ng
    ON ng.produto_raiz = a.produto_raiz
  LEFT JOIN nome_fabrica nfc
    ON nfc.chave = a.produto_raiz::text;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- 3) Recriar vw_estoque_unificado expondo nome_raiz
DROP VIEW IF EXISTS public.vw_estoque_unificado;
CREATE VIEW public.vw_estoque_unificado
WITH (security_invoker = true)
AS
SELECT
  empresa,
  produto_raiz,
  saldo_em_caixas,
  saldo_em_displays,
  saldo_em_unidades,
  saldo_total_em_unidades,
  bloqueado_total_em_unidades,
  disponivel_total_em_unidades,
  pendente_total_em_unidades,
  custo_total,
  skus_envolvidos,
  fator_cx_para_un,
  fator_bx_para_un,
  ean_raiz,
  nome_raiz
FROM public.estoque_unificado_cache;

GRANT SELECT ON public.vw_estoque_unificado TO authenticated;
GRANT SELECT ON public.vw_estoque_unificado TO service_role;

-- 4) View de auditoria: raízes sem nome resolvido após backfill
DROP VIEW IF EXISTS public.vw_estoque_raiz_sem_nome;
CREATE VIEW public.vw_estoque_raiz_sem_nome
WITH (security_invoker = true)
AS
SELECT empresa,
       produto_raiz,
       saldo_total_em_unidades AS unidades_totais,
       custo_total,
       atualizado_em
FROM public.estoque_unificado_cache
WHERE (nome_raiz IS NULL OR btrim(nome_raiz) = '')
  AND COALESCE(saldo_total_em_unidades, 0) > 0
ORDER BY saldo_total_em_unidades DESC;

GRANT SELECT ON public.vw_estoque_raiz_sem_nome TO authenticated;
GRANT SELECT ON public.vw_estoque_raiz_sem_nome TO service_role;

-- 5) Backfill imediato
SELECT public.refresh_estoque_unificado_cache();
