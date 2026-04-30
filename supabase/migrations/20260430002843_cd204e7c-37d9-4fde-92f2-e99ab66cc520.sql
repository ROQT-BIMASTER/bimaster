
-- =========================================================
-- FASE 1: Estoque Unificado em 3 níveis (versão corrigida)
-- =========================================================

-- 1) bom_edges
CREATE TABLE IF NOT EXISTS public.bom_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa INTEGER NOT NULL,
  pai_cod INTEGER NOT NULL,
  filho_cod INTEGER NOT NULL,
  quantidade NUMERIC(18,6) NOT NULL CHECK (quantidade > 0),
  origem TEXT NOT NULL DEFAULT 'erp' CHECK (origem IN ('erp','manual')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa, pai_cod, filho_cod, origem)
);

CREATE INDEX IF NOT EXISTS idx_bom_edges_empresa_pai   ON public.bom_edges(empresa, pai_cod) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_bom_edges_empresa_filho ON public.bom_edges(empresa, filho_cod) WHERE ativo;

ALTER TABLE public.bom_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bom_edges_select_by_empresa"
ON public.bom_edges FOR SELECT TO authenticated
USING (
  empresa IN (SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = auth.uid())
);

CREATE POLICY "bom_edges_admin_all"
ON public.bom_edges FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_bom_edges_updated_at
BEFORE UPDATE ON public.bom_edges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) estoque_produto_nivel
CREATE TABLE IF NOT EXISTS public.estoque_produto_nivel (
  cod_produto INTEGER NOT NULL PRIMARY KEY,
  nivel SMALLINT NOT NULL CHECK (nivel BETWEEN 1 AND 3),
  produto_raiz INTEGER,
  eh_folha BOOLEAN NOT NULL DEFAULT false,
  eh_raiz  BOOLEAN NOT NULL DEFAULT false,
  recalculado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epn_nivel ON public.estoque_produto_nivel(nivel);
CREATE INDEX IF NOT EXISTS idx_epn_raiz  ON public.estoque_produto_nivel(produto_raiz);

ALTER TABLE public.estoque_produto_nivel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "epn_select_authenticated"
ON public.estoque_produto_nivel FOR SELECT TO authenticated USING (true);

CREATE POLICY "epn_admin_all"
ON public.estoque_produto_nivel FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


-- 3) Função: sincronizar_bom_edges_from_erp
CREATE OR REPLACE FUNCTION public.sincronizar_bom_edges_from_erp()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM public.bom_edges be
  WHERE be.origem = 'erp'
    AND NOT EXISTS (
      SELECT 1 FROM public.erp_composicao_produto c
      WHERE c.empresa_compo = be.empresa
        AND c.produto_compo = be.pai_cod
        AND c.materia_compo = be.filho_cod
    );

  INSERT INTO public.bom_edges (empresa, pai_cod, filho_cod, quantidade, origem, ativo)
  SELECT c.empresa_compo, c.produto_compo, c.materia_compo, c.quantidade_compo, 'erp', true
  FROM public.erp_composicao_produto c
  WHERE c.quantidade_compo > 0
  ON CONFLICT (empresa, pai_cod, filho_cod, origem) DO UPDATE
    SET quantidade = EXCLUDED.quantidade, ativo = true, updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- 4) Função: recalcular_estoque_niveis (com WITH RECURSIVE)
CREATE OR REPLACE FUNCTION public.recalcular_estoque_niveis()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  RETURN v_count;
END;
$$;


-- 5) View: vw_bom_path
CREATE OR REPLACE VIEW public.vw_bom_path
WITH (security_invoker = true) AS
WITH RECURSIVE path AS (
  SELECT
    e.empresa,
    e.pai_cod   AS raiz_cod,
    e.filho_cod AS proximo_cod,
    e.quantidade::NUMERIC AS fator_acumulado,
    1 AS profundidade,
    ARRAY[e.pai_cod, e.filho_cod] AS caminho
  FROM public.bom_edges e
  WHERE e.ativo
    AND NOT EXISTS (
      SELECT 1 FROM public.bom_edges p
      WHERE p.ativo AND p.empresa = e.empresa AND p.filho_cod = e.pai_cod
    )

  UNION ALL

  SELECT
    p.empresa, p.raiz_cod, e.filho_cod,
    p.fator_acumulado * e.quantidade,
    p.profundidade + 1,
    p.caminho || e.filho_cod
  FROM path p
  JOIN public.bom_edges e ON e.empresa = p.empresa AND e.pai_cod = p.proximo_cod AND e.ativo
  WHERE p.profundidade < 5 AND NOT (e.filho_cod = ANY(p.caminho))
)
SELECT empresa, raiz_cod, proximo_cod AS folha_cod, fator_acumulado, profundidade, caminho
FROM path;


-- 6) View: vw_estoque_unificado
CREATE OR REPLACE VIEW public.vw_estoque_unificado
WITH (security_invoker = true) AS
WITH estoque AS (
  SELECT
    e.empresa_par AS empresa,
    e.cod_produto,
    SUM(COALESCE(e.saldo, 0))       AS saldo_total,
    SUM(COALESCE(e.custo_total, 0)) AS custo_total
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa, es.cod_produto, es.saldo_total, es.custo_total,
         n.nivel, COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
  FROM estoque es
  LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
)
SELECT
  c.empresa,
  c.produto_raiz,
  SUM(CASE WHEN c.nivel = 1 THEN c.saldo_total ELSE 0 END) AS saldo_em_caixas,
  SUM(CASE WHEN c.nivel = 2 THEN c.saldo_total ELSE 0 END) AS saldo_em_displays,
  SUM(CASE WHEN c.nivel = 3 THEN c.saldo_total ELSE 0 END) AS saldo_em_unidades,
  SUM(c.saldo_total * COALESCE((
    SELECT MAX(p.fator_acumulado)
    FROM public.vw_bom_path p
    WHERE p.empresa = c.empresa AND p.raiz_cod = c.produto_raiz AND p.folha_cod = c.cod_produto
  ),
  CASE WHEN c.cod_produto = c.produto_raiz THEN
    (SELECT MAX(p2.fator_acumulado) FROM public.vw_bom_path p2
     WHERE p2.empresa = c.empresa AND p2.raiz_cod = c.produto_raiz)
  ELSE 1 END
  )) AS saldo_total_em_unidades,
  SUM(c.custo_total) AS custo_total,
  COUNT(DISTINCT c.cod_produto) AS skus_envolvidos
FROM classificado c
GROUP BY c.empresa, c.produto_raiz;


-- 7) View: vw_capacidade_montagem
CREATE OR REPLACE VIEW public.vw_capacidade_montagem
WITH (security_invoker = true) AS
WITH saldos AS (
  SELECT empresa_par AS empresa, cod_produto, SUM(COALESCE(saldo, 0)) AS saldo
  FROM public.erp_estoque_distribuidora
  WHERE cod_produto IS NOT NULL AND empresa_par IS NOT NULL
  GROUP BY empresa_par, cod_produto
),
edges_diretas AS (
  SELECT
    e.empresa, e.pai_cod AS raiz_cod, e.filho_cod,
    e.quantidade AS qtd_necessaria,
    COALESCE(s.saldo, 0) AS saldo_filho,
    FLOOR(COALESCE(s.saldo, 0) / NULLIF(e.quantidade, 0)) AS kits_possiveis
  FROM public.bom_edges e
  JOIN public.estoque_produto_nivel n ON n.cod_produto = e.pai_cod AND n.eh_raiz
  LEFT JOIN saldos s ON s.empresa = e.empresa AND s.cod_produto = e.filho_cod
  WHERE e.ativo
)
SELECT empresa, raiz_cod,
       MIN(kits_possiveis)::BIGINT AS caixas_remontaveis,
       COUNT(*) AS componentes_necessarios,
       COUNT(*) FILTER (WHERE saldo_filho < qtd_necessaria) AS componentes_em_falta
FROM edges_diretas
GROUP BY empresa, raiz_cod;


-- 8) Popular dados iniciais
SELECT public.sincronizar_bom_edges_from_erp();
SELECT public.recalcular_estoque_niveis();
