-- 1. Tabela de cache materializado
CREATE TABLE IF NOT EXISTS public.estoque_unificado_cache (
  empresa integer NOT NULL,
  produto_raiz integer NOT NULL,
  saldo_em_caixas numeric NOT NULL DEFAULT 0,
  saldo_em_displays numeric NOT NULL DEFAULT 0,
  saldo_em_unidades numeric NOT NULL DEFAULT 0,
  saldo_total_em_unidades numeric NOT NULL DEFAULT 0,
  custo_total numeric NOT NULL DEFAULT 0,
  skus_envolvidos integer NOT NULL DEFAULT 0,
  fator_cx_para_un numeric,
  fator_bx_para_un numeric,
  ean_raiz text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa, produto_raiz)
);

CREATE INDEX IF NOT EXISTS idx_euc_empresa ON public.estoque_unificado_cache(empresa);
CREATE INDEX IF NOT EXISTS idx_euc_total_un ON public.estoque_unificado_cache(saldo_total_em_unidades DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_euc_custo ON public.estoque_unificado_cache(custo_total DESC NULLS LAST);

ALTER TABLE public.estoque_unificado_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read estoque_unificado_cache" ON public.estoque_unificado_cache;
CREATE POLICY "Auth can read estoque_unificado_cache"
  ON public.estoque_unificado_cache
  FOR SELECT TO authenticated
  USING (true);

-- 2. Função de refresh
CREATE OR REPLACE FUNCTION public.refresh_estoque_unificado_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  TRUNCATE public.estoque_unificado_cache;

  WITH estoque AS (
    SELECT e.empresa_par AS empresa,
           e.cod_produto,
           sum(COALESCE(e.saldo, 0)) AS saldo_total,
           sum(COALESCE(e.custo_total, 0)) AS custo_total
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
    GROUP BY e.empresa_par, e.cod_produto
  ),
  classificado AS (
    SELECT es.empresa, es.cod_produto, es.saldo_total, es.custo_total,
           n.nivel,
           COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
    FROM estoque es
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
  ),
  agg AS (
    SELECT c.empresa,
           c.produto_raiz,
           sum(CASE WHEN c.nivel = 1 THEN c.saldo_total ELSE 0 END) AS saldo_em_caixas,
           sum(CASE WHEN c.nivel = 2 THEN c.saldo_total ELSE 0 END) AS saldo_em_displays,
           sum(CASE WHEN c.nivel = 3 THEN c.saldo_total ELSE 0 END) AS saldo_em_unidades,
           COALESCE(sum(c.saldo_total * COALESCE((
             SELECT max(p.fator_acumulado)
             FROM public.vw_bom_path p
             WHERE p.raiz_cod = c.produto_raiz AND p.folha_cod = c.cod_produto
           ), 1)), 0) AS saldo_total_em_unidades,
           sum(c.custo_total) AS custo_total,
           count(DISTINCT c.cod_produto)::int AS skus_envolvidos
    FROM classificado c
    GROUP BY c.empresa, c.produto_raiz
  ),
  fatores AS (
    SELECT a.empresa,
           a.produto_raiz,
           (SELECT max(p.fator_acumulado)
              FROM public.vw_bom_path p
              JOIN public.estoque_produto_nivel nf ON nf.cod_produto = p.folha_cod
             WHERE p.raiz_cod = a.produto_raiz AND nf.nivel = 3) AS fator_cx_para_un,
           (SELECT max(p.fator_acumulado)
              FROM public.vw_bom_path p
              JOIN public.estoque_produto_nivel n2 ON n2.cod_produto = ANY (p.caminho)
              JOIN public.estoque_produto_nivel nf ON nf.cod_produto = p.folha_cod
             WHERE p.raiz_cod = a.produto_raiz AND n2.nivel = 2 AND nf.nivel = 3) AS fator_bx_para_un
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
$$;

-- 3. Encadear no recalcular_estoque_niveis
CREATE OR REPLACE FUNCTION public.recalcular_estoque_niveis()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_count INTEGER;
BEGIN
  TRUNCATE public.estoque_produto_nivel;

  WITH RECURSIVE
  todos_skus AS (
    SELECT DISTINCT cod_produto FROM public.erp_estoque_distribuidora WHERE cod_produto IS NOT NULL
    UNION
    SELECT DISTINCT pai_cod   FROM public.bom_edges WHERE ativo
    UNION
    SELECT DISTINCT filho_cod FROM public.bom_edges WHERE ativo
  ),
  paes  AS (SELECT DISTINCT pai_cod   AS cod FROM public.bom_edges WHERE ativo),
  filhos AS (SELECT DISTINCT filho_cod AS cod FROM public.bom_edges WHERE ativo),
  raizes AS (
    SELECT p.cod FROM paes p
    LEFT JOIN filhos f ON f.cod = p.cod WHERE f.cod IS NULL
  ),
  folhas AS (
    SELECT f.cod FROM filhos f
    LEFT JOIN paes p ON p.cod = f.cod WHERE p.cod IS NULL
  ),
  rec AS (
    SELECT r.cod AS raiz, r.cod AS atual, 1 AS profundidade, ARRAY[r.cod] AS caminho
    FROM raizes r
    UNION ALL
    SELECT r.raiz, e.filho_cod, r.profundidade + 1, r.caminho || e.filho_cod
    FROM rec r
    JOIN public.bom_edges e ON e.pai_cod = r.atual AND e.ativo
    WHERE r.profundidade < 5 AND NOT (e.filho_cod = ANY(r.caminho))
  ),
  prof_max AS (SELECT atual AS cod, MAX(profundidade) AS prof FROM rec GROUP BY atual),
  raiz_de AS (
    SELECT atual AS cod, raiz,
           ROW_NUMBER() OVER (PARTITION BY atual ORDER BY COUNT(*) DESC, raiz) AS rn
    FROM rec GROUP BY atual, raiz
  )
  INSERT INTO public.estoque_produto_nivel (cod_produto, nivel, produto_raiz, eh_folha, eh_raiz, recalculado_em)
  SELECT
    s.cod_produto,
    CASE
      WHEN pm.prof IS NULL THEN 3
      WHEN pm.prof >= 3 THEN 3
      WHEN pm.prof = 2 THEN 2
      ELSE 1
    END,
    rd.raiz,
    (s.cod_produto IN (SELECT cod FROM folhas)) OR (pm.prof IS NULL),
    (s.cod_produto IN (SELECT cod FROM raizes)),
    now()
  FROM todos_skus s
  LEFT JOIN prof_max pm ON pm.cod = s.cod_produto
  LEFT JOIN raiz_de rd  ON rd.cod = s.cod_produto AND rd.rn = 1;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Atualiza o cache materializado do estoque unificado
  PERFORM public.refresh_estoque_unificado_cache();

  RETURN v_count;
END;
$function$;

-- 4. Substituir a view pela leitura do cache
DROP VIEW IF EXISTS public.vw_estoque_unificado;
CREATE VIEW public.vw_estoque_unificado
WITH (security_invoker = on) AS
SELECT empresa, produto_raiz,
       saldo_em_caixas, saldo_em_displays, saldo_em_unidades,
       saldo_total_em_unidades, custo_total, skus_envolvidos,
       fator_cx_para_un, fator_bx_para_un, ean_raiz
FROM public.estoque_unificado_cache;

-- 5. Popular agora
SELECT public.refresh_estoque_unificado_cache();