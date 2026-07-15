
-- =====================================================================
-- ITEM 1 — Padronizar explosão de BOM em erp_composicao_produto
-- =====================================================================

-- View auxiliar: espelha erp_composicao_produto no formato bom_edges.
-- Ponto único para trocar a fonte da BOM no futuro.
CREATE OR REPLACE VIEW public.vw_bom_ativa AS
SELECT
  c.empresa_compo                                                    AS empresa,
  c.produto_compo                                                    AS pai_cod,
  c.materia_compo                                                    AS filho_cod,
  GREATEST(COALESCE(c.quantidade_compo, 1::numeric), 1::numeric)     AS quantidade,
  true                                                                AS ativo
FROM public.erp_composicao_produto c;

GRANT SELECT ON public.vw_bom_ativa TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- vw_estoque_unificado_skus — mesmo contrato de colunas do 20260608225218
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_estoque_unificado_skus AS
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
  SELECT sku, MAX(fator) AS fator_un FROM fator_desc GROUP BY sku
),
estoque AS (
  SELECT e.empresa_par                              AS empresa,
         e.cod_produto,
         MAX(e.nome_prod)                           AS nome_prod,
         MAX(e.abrev_par)                           AS abrev_par,
         SUM(COALESCE(e.saldo, 0))                  AS saldo,
         SUM(COALESCE(e.custo_total, 0))            AS custo_total,
         SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado,
         SUM(COALESCE(e.pedido_pendente, 0))        AS pendente
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa, es.cod_produto, es.nome_prod, es.abrev_par,
         es.saldo, es.custo_total, es.bloqueado, es.pendente,
         GREATEST(es.saldo - es.bloqueado, 0::numeric) AS disponivel,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
  FROM estoque es
  LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
),
pai_de AS (
  SELECT DISTINCT ON (c.materia_compo)
    c.materia_compo                                                AS filho_cod,
    c.produto_compo                                                AS pai_cod,
    GREATEST(COALESCE(c.quantidade_compo, 1::numeric), 1::numeric) AS quantidade
  FROM public.erp_composicao_produto c
  ORDER BY c.materia_compo, c.sincronizado_em DESC NULLS LAST
)
SELECT
  c.empresa,
  c.produto_raiz,
  c.cod_produto,
  c.nome_prod,
  c.abrev_par,
  fp.codigo_barras_ean,
  c.nivel,
  pd.pai_cod,
  pd.quantidade                                       AS fator_pai_para_filho,
  COALESCE(fps.fator_un, 1::numeric)                  AS fator_un_acumulado,
  c.saldo,
  c.bloqueado,
  c.pendente,
  c.disponivel,
  c.custo_total,
  c.saldo      * COALESCE(fps.fator_un, 1::numeric)   AS contribuicao_un,
  c.bloqueado  * COALESCE(fps.fator_un, 1::numeric)   AS contribuicao_bloqueado_un,
  c.disponivel * COALESCE(fps.fator_un, 1::numeric)   AS contribuicao_disponivel_un,
  c.pendente   * COALESCE(fps.fator_un, 1::numeric)   AS contribuicao_pendente_un
FROM classificado c
LEFT JOIN fator_por_sku fps ON fps.sku = c.cod_produto
LEFT JOIN pai_de pd         ON pd.filho_cod = c.cod_produto
LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = c.cod_produto::text;

GRANT SELECT ON public.vw_estoque_unificado_skus TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- vw_bom_path
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_bom_path AS
WITH RECURSIVE path AS (
  SELECT e.empresa,
         e.pai_cod                  AS raiz_cod,
         e.filho_cod                AS proximo_cod,
         e.quantidade::numeric      AS fator_acumulado,
         1                          AS profundidade,
         ARRAY[e.pai_cod, e.filho_cod] AS caminho
  FROM public.vw_bom_ativa e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vw_bom_ativa p
    WHERE p.empresa = e.empresa AND p.filho_cod = e.pai_cod
  )
  UNION ALL
  SELECT p.empresa, p.raiz_cod, e.filho_cod,
         p.fator_acumulado * e.quantidade,
         p.profundidade + 1,
         p.caminho || e.filho_cod
  FROM path p
  JOIN public.vw_bom_ativa e
    ON e.empresa = p.empresa AND e.pai_cod = p.proximo_cod
  WHERE p.profundidade < 5 AND NOT (e.filho_cod = ANY (p.caminho))
)
SELECT empresa, raiz_cod, proximo_cod AS folha_cod,
       fator_acumulado, profundidade, caminho
FROM path;

GRANT SELECT ON public.vw_bom_path TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- vw_capacidade_montagem
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_capacidade_montagem AS
WITH saldos AS (
  SELECT e.empresa_par                       AS empresa,
         e.cod_produto,
         SUM(COALESCE(e.saldo, 0::numeric))  AS saldo
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
edges_diretas AS (
  SELECT e.empresa,
         e.pai_cod                            AS raiz_cod,
         e.filho_cod,
         e.quantidade                         AS qtd_necessaria,
         COALESCE(s.saldo, 0::numeric)        AS saldo_filho,
         floor(COALESCE(s.saldo, 0::numeric) / NULLIF(e.quantidade, 0::numeric)) AS kits_possiveis
  FROM public.vw_bom_ativa e
  JOIN public.estoque_produto_nivel n
    ON n.cod_produto = e.pai_cod AND n.eh_raiz
  LEFT JOIN saldos s
    ON s.empresa = e.empresa AND s.cod_produto = e.filho_cod
)
SELECT empresa, raiz_cod,
       MIN(kits_possiveis)::bigint                                    AS caixas_remontaveis,
       COUNT(*)                                                        AS componentes_necessarios,
       COUNT(*) FILTER (WHERE saldo_filho < qtd_necessaria)            AS componentes_em_falta
FROM edges_diretas
GROUP BY empresa, raiz_cod;

GRANT SELECT ON public.vw_capacidade_montagem TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- recalcular_estoque_niveis — derivado de erp_composicao_produto
-- (mantém o botão "Recalcular níveis" na UI; sincronizar_bom_edges_from_erp
--  continua rodando, mas nada mais lê de bom_edges).
-- ---------------------------------------------------------------------
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
    SELECT DISTINCT produto_compo FROM public.erp_composicao_produto
    UNION
    SELECT DISTINCT materia_compo FROM public.erp_composicao_produto
  ),
  paes   AS (SELECT DISTINCT produto_compo AS cod FROM public.erp_composicao_produto),
  filhos AS (SELECT DISTINCT materia_compo AS cod FROM public.erp_composicao_produto),
  raizes AS (
    SELECT p.cod FROM paes p
    LEFT JOIN filhos f ON f.cod = p.cod
    WHERE f.cod IS NULL
  ),
  rec AS (
    SELECT r.cod AS raiz, r.cod AS atual, 1 AS profundidade, ARRAY[r.cod] AS caminho
    FROM raizes r
    UNION ALL
    SELECT r.raiz, c.materia_compo, r.profundidade + 1, r.caminho || c.materia_compo
    FROM rec r
    JOIN public.erp_composicao_produto c ON c.produto_compo = r.atual
    WHERE r.profundidade < 5 AND NOT (c.materia_compo = ANY(r.caminho))
  ),
  raiz_de AS (
    SELECT atual AS cod, raiz,
           ROW_NUMBER() OVER (PARTITION BY atual ORDER BY COUNT(*) DESC, raiz) AS rn
    FROM rec GROUP BY atual, raiz
  )
  INSERT INTO public.estoque_produto_nivel (cod_produto, nivel, produto_raiz, eh_folha, eh_raiz, recalculado_em)
  SELECT
    s.cod_produto,
    CASE
      WHEN s.cod_produto IN (SELECT cod FROM raizes) THEN 1
      WHEN s.cod_produto IN (SELECT cod FROM paes)   THEN 2
      ELSE 3
    END AS nivel,
    COALESCE((SELECT rd.raiz FROM raiz_de rd WHERE rd.cod = s.cod_produto AND rd.rn = 1), s.cod_produto) AS produto_raiz,
    (s.cod_produto NOT IN (SELECT cod FROM paes))   AS eh_folha,
    (s.cod_produto IN (SELECT cod FROM raizes))     AS eh_raiz,
    now()
  FROM todos_skus s;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ---------------------------------------------------------------------
-- estoque_unificado_bom_complemento — drill-down do cache unificado
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estoque_unificado_bom_complemento(p_empresa integer, p_raiz integer)
 RETURNS TABLE(empresa integer, produto_raiz integer, cod_produto integer, nome_prod text, abrev_par text, codigo_barras_ean text, nivel integer, pai_cod integer, fator_pai_para_filho numeric, fator_un_acumulado numeric, saldo numeric, bloqueado numeric, pendente numeric, disponivel numeric, custo_total numeric, contribuicao_un numeric, contribuicao_bloqueado_un numeric, contribuicao_disponivel_un numeric, contribuicao_pendente_un numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH RECURSIVE descendentes AS (
    SELECT c.produto_compo AS pai_cod,
           c.materia_compo AS cod_produto,
           GREATEST(COALESCE(c.quantidade_compo, 1), 1)::numeric AS fator_pai_para_filho,
           1 AS profundidade
    FROM public.erp_composicao_produto c
    WHERE c.produto_compo = p_raiz
    UNION ALL
    SELECT c.produto_compo, c.materia_compo,
           GREATEST(COALESCE(c.quantidade_compo, 1), 1)::numeric,
           d.profundidade + 1
    FROM public.erp_composicao_produto c
    JOIN descendentes d ON d.cod_produto = c.produto_compo
    WHERE d.profundidade < 6
  ),
  fator_desc AS (
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
  fator_por_sku AS (SELECT sku, MAX(fator) AS fator_un FROM fator_desc GROUP BY sku),
  desc_uniq AS (
    SELECT DISTINCT ON (cod_produto) cod_produto, pai_cod, fator_pai_para_filho
    FROM descendentes
    ORDER BY cod_produto, profundidade ASC
  ),
  nos_total AS (
    SELECT cod_produto, pai_cod, fator_pai_para_filho FROM desc_uniq
    UNION ALL
    SELECT p_raiz::int, NULL::int, NULL::numeric
    WHERE NOT EXISTS (SELECT 1 FROM desc_uniq d WHERE d.cod_produto = p_raiz)
  ),
  estoque_emp AS (
    SELECT e.cod_produto,
      SUM(COALESCE(e.saldo, 0))::numeric AS saldo,
      SUM(COALESCE(e.estoque_bloqueado_produto, 0) + COALESCE(e.estoque_bloqueado_endereco, 0))::numeric AS bloqueado,
      SUM(COALESCE(e.pedido_pendente, 0))::numeric AS pendente
    FROM public.erp_estoque_distribuidora e
    WHERE e.empresa_par = p_empresa AND e.cod_produto IS NOT NULL
    GROUP BY e.cod_produto
  ),
  nome_erp AS (
    SELECT cod_produto, MAX(NULLIF(btrim(nome_prod), '')) AS nome_prod
    FROM public.erp_estoque_distribuidora WHERE cod_produto IS NOT NULL GROUP BY cod_produto
  ),
  nome_fab AS (
    SELECT cod_produto, MAX(nome) AS nome
    FROM (
      SELECT NULLIF(fp.codigo, '')::int AS cod_produto,
             COALESCE(NULLIF(btrim(fp.nome_comercial),''),NULLIF(btrim(fp.nome),''),NULLIF(btrim(fp.descricao_curta),''),NULLIF(btrim(fp.descricao),'')) AS nome
      FROM public.fabrica_produtos fp WHERE fp.codigo ~ '^[0-9]+$'
      UNION ALL
      SELECT NULLIF(fp.codigo_erp,'')::int,
             COALESCE(NULLIF(btrim(fp.nome_comercial),''),NULLIF(btrim(fp.nome),''),NULLIF(btrim(fp.descricao_curta),''),NULLIF(btrim(fp.descricao),''))
      FROM public.fabrica_produtos fp WHERE fp.codigo_erp ~ '^[0-9]+$'
      UNION ALL
      SELECT NULLIF(fp.sku,'')::int,
             COALESCE(NULLIF(btrim(fp.nome_comercial),''),NULLIF(btrim(fp.nome),''),NULLIF(btrim(fp.descricao_curta),''),NULLIF(btrim(fp.descricao),''))
      FROM public.fabrica_produtos fp WHERE fp.sku ~ '^[0-9]+$'
    ) s WHERE cod_produto IS NOT NULL AND nome IS NOT NULL GROUP BY cod_produto
  ),
  nome_master AS (
    SELECT NULLIF(sku_master,'')::int AS cod_produto,
           MAX(COALESCE(NULLIF(btrim(nome),''),NULLIF(btrim(descricao),''))) AS nome
    FROM public.estoque_produtos_master WHERE sku_master ~ '^[0-9]+$' GROUP BY NULLIF(sku_master,'')::int
  ),
  nome_rr AS (
    SELECT NULLIF(rp.sku,'')::int AS cod_produto,
           MAX(NULLIF(btrim(rp.nome_comercial),'')) AS nome
    FROM public.rr_produtos rp WHERE rp.sku ~ '^[0-9]+$' GROUP BY NULLIF(rp.sku,'')::int
  ),
  base AS (
    SELECT d.cod_produto, d.pai_cod, d.fator_pai_para_filho,
      COALESCE(
        NULLIF(btrim(ne.nome_prod),''),
        NULLIF(btrim(nf.nome),''),
        NULLIF(btrim(nm.nome),''),
        NULLIF(btrim(nr.nome),'')
      ) AS nome_direto
    FROM nos_total d
    LEFT JOIN nome_erp ne     ON ne.cod_produto = d.cod_produto
    LEFT JOIN nome_fab nf     ON nf.cod_produto = d.cod_produto
    LEFT JOIN nome_master nm  ON nm.cod_produto = d.cod_produto
    LEFT JOIN nome_rr nr      ON nr.cod_produto = d.cod_produto
  ),
  com_inferencia AS (
    SELECT b.cod_produto, b.pai_cod, b.fator_pai_para_filho,
      COALESCE(
        b.nome_direto,
        CASE WHEN bp.nome_direto IS NOT NULL THEN
          regexp_replace(
            regexp_replace(bp.nome_direto, '^[[:space:]]*BX[[:space:]]+', '', 'i'),
            'BX([[:space:]]|$)', '\1', 'g'
          )
        END
      ) AS nome_prod
    FROM base b LEFT JOIN base bp ON bp.cod_produto = b.pai_cod
  )
  SELECT
    p_empresa::int, p_raiz::int, ci.cod_produto::int,
    ci.nome_prod::text, NULL::text, fp.codigo_barras_ean::text,
    COALESCE(n.nivel, CASE WHEN ci.cod_produto = p_raiz THEN 1 ELSE NULL END)::int,
    ci.pai_cod::int, ci.fator_pai_para_filho, COALESCE(fps.fator_un, 1::numeric),
    COALESCE(ee.saldo, 0)::numeric, COALESCE(ee.bloqueado, 0)::numeric, COALESCE(ee.pendente, 0)::numeric,
    GREATEST(COALESCE(ee.saldo, 0) - COALESCE(ee.bloqueado, 0), 0)::numeric, 0::numeric,
    (COALESCE(ee.saldo, 0) * COALESCE(fps.fator_un, 1))::numeric,
    (COALESCE(ee.bloqueado, 0) * COALESCE(fps.fator_un, 1))::numeric,
    (GREATEST(COALESCE(ee.saldo, 0) - COALESCE(ee.bloqueado, 0), 0) * COALESCE(fps.fator_un, 1))::numeric,
    (COALESCE(ee.pendente, 0) * COALESCE(fps.fator_un, 1))::numeric
  FROM com_inferencia ci
  LEFT JOIN public.estoque_produto_nivel n  ON n.cod_produto = ci.cod_produto
  LEFT JOIN fator_por_sku fps               ON fps.sku       = ci.cod_produto
  LEFT JOIN public.fabrica_produtos fp      ON fp.codigo::text = ci.cod_produto::text
  LEFT JOIN estoque_emp ee                  ON ee.cod_produto = ci.cod_produto;
$function$;

-- ---------------------------------------------------------------------
-- executar_desmontagem — troca fonte da BOM
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.executar_desmontagem(p_empresa integer, p_pai_cod integer, p_quantidade numeric, p_motivo text DEFAULT NULL::text, p_lote_origem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_saldo_atual NUMERIC;
  v_saldo_erp NUMERIC;
  v_filho RECORD;
  v_qtd_filho NUMERIC;
  v_total_eq NUMERIC := 0;
  v_movs JSONB := '[]'::jsonb;
  v_nivel_pai SMALLINT;
  v_raiz INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.erp_composicao_produto
    WHERE empresa_compo = p_empresa AND produto_compo = p_pai_cod
  ) THEN
    RAISE EXCEPTION 'Produto % não possui composição (BOM) ativa para empresa %', p_pai_cod, p_empresa;
  END IF;

  SELECT nivel, produto_raiz INTO v_nivel_pai, v_raiz
    FROM public.estoque_produto_nivel
   WHERE cod_produto = p_pai_cod LIMIT 1;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_saldo_atual
    FROM public.estoque_lote_interno
   WHERE empresa = p_empresa AND cod_produto = p_pai_cod
     AND (p_lote_origem IS NULL OR lote_origem IS NOT DISTINCT FROM p_lote_origem);

  IF v_saldo_atual = 0 THEN
    SELECT COALESCE(SUM(saldo), 0) INTO v_saldo_erp
      FROM public.erp_estoque_distribuidora
     WHERE empresa_par = p_empresa AND cod_produto = p_pai_cod;

    IF v_saldo_erp < p_quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente: disponível % (ERP), solicitado %', v_saldo_erp, p_quantidade;
    END IF;

    INSERT INTO public.estoque_lote_interno(empresa, cod_produto, nivel, lote_origem, raiz_cod, quantidade)
    VALUES (p_empresa, p_pai_cod, v_nivel_pai, p_lote_origem, v_raiz, v_saldo_erp)
    ON CONFLICT (empresa, cod_produto, COALESCE(lote_origem, '')) DO UPDATE
      SET quantidade = EXCLUDED.quantidade;
    v_saldo_atual := v_saldo_erp;
  END IF;

  IF v_saldo_atual < p_quantidade THEN
    RAISE EXCEPTION 'Saldo lógico insuficiente: disponível %, solicitado %', v_saldo_atual, p_quantidade;
  END IF;

  UPDATE public.estoque_lote_interno
     SET quantidade = quantidade - p_quantidade, updated_at = now()
   WHERE empresa = p_empresa AND cod_produto = p_pai_cod
     AND (p_lote_origem IS NULL OR lote_origem IS NOT DISTINCT FROM p_lote_origem);

  FOR v_filho IN
    SELECT materia_compo AS filho_cod,
           GREATEST(COALESCE(quantidade_compo, 1), 1)::numeric AS fator
      FROM public.erp_composicao_produto
     WHERE empresa_compo = p_empresa AND produto_compo = p_pai_cod
  LOOP
    v_qtd_filho := p_quantidade * v_filho.fator;
    v_total_eq := v_total_eq + v_qtd_filho;

    INSERT INTO public.estoque_lote_interno(empresa, cod_produto, lote_origem, raiz_cod, quantidade)
    VALUES (p_empresa, v_filho.filho_cod, COALESCE(p_lote_origem, p_pai_cod::text), COALESCE(v_raiz, p_pai_cod), v_qtd_filho)
    ON CONFLICT (empresa, cod_produto, COALESCE(lote_origem, '')) DO UPDATE
      SET quantidade = estoque_lote_interno.quantidade + EXCLUDED.quantidade,
          updated_at = now();

    INSERT INTO public.estoque_movimento(
      empresa, tipo, pai_cod, filho_cod, quantidade_pai, quantidade_filho,
      fator_bom, lote_origem, raiz_cod, motivo, unidades_equivalentes, executado_por
    ) VALUES (
      p_empresa, 'desmontagem', p_pai_cod, v_filho.filho_cod, p_quantidade, v_qtd_filho,
      v_filho.fator, p_lote_origem, v_raiz, p_motivo, v_qtd_filho, v_uid
    );

    v_movs := v_movs || jsonb_build_object(
      'filho_cod', v_filho.filho_cod, 'quantidade', v_qtd_filho, 'fator', v_filho.fator
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'pai_cod', p_pai_cod,
    'quantidade_desmontada', p_quantidade,
    'filhos_gerados', v_movs,
    'unidades_equivalentes_total', v_total_eq
  );
END;
$function$;

-- ---------------------------------------------------------------------
-- executar_remontagem
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.executar_remontagem(p_empresa integer, p_pai_cod integer, p_quantidade numeric, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_filho RECORD;
  v_necessario NUMERIC;
  v_disponivel NUMERIC;
  v_total_eq NUMERIC := 0;
  v_movs JSONB := '[]'::jsonb;
  v_raiz INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.erp_composicao_produto
    WHERE empresa_compo = p_empresa AND produto_compo = p_pai_cod
  ) THEN
    RAISE EXCEPTION 'Produto % não possui BOM para remontagem', p_pai_cod;
  END IF;

  SELECT produto_raiz INTO v_raiz FROM public.estoque_produto_nivel
   WHERE cod_produto = p_pai_cod LIMIT 1;

  FOR v_filho IN
    SELECT materia_compo AS filho_cod,
           GREATEST(COALESCE(quantidade_compo, 1), 1)::numeric AS fator
      FROM public.erp_composicao_produto
     WHERE empresa_compo = p_empresa AND produto_compo = p_pai_cod
  LOOP
    v_necessario := p_quantidade * v_filho.fator;
    SELECT COALESCE(SUM(quantidade), 0) INTO v_disponivel
      FROM public.estoque_lote_interno
     WHERE empresa = p_empresa AND cod_produto = v_filho.filho_cod;
    IF v_disponivel < v_necessario THEN
      RAISE EXCEPTION 'Componente % insuficiente: precisa %, disponível %',
        v_filho.filho_cod, v_necessario, v_disponivel;
    END IF;
  END LOOP;

  FOR v_filho IN
    SELECT materia_compo AS filho_cod,
           GREATEST(COALESCE(quantidade_compo, 1), 1)::numeric AS fator
      FROM public.erp_composicao_produto
     WHERE empresa_compo = p_empresa AND produto_compo = p_pai_cod
  LOOP
    v_necessario := p_quantidade * v_filho.fator;
    v_total_eq := v_total_eq + v_necessario;

    UPDATE public.estoque_lote_interno
       SET quantidade = GREATEST(0, quantidade - v_necessario), updated_at = now()
     WHERE id = (
       SELECT id FROM public.estoque_lote_interno
        WHERE empresa = p_empresa AND cod_produto = v_filho.filho_cod
          AND quantidade > 0
        ORDER BY updated_at ASC LIMIT 1
     );

    INSERT INTO public.estoque_movimento(
      empresa, tipo, pai_cod, filho_cod, quantidade_pai, quantidade_filho,
      fator_bom, raiz_cod, motivo, unidades_equivalentes, executado_por
    ) VALUES (
      p_empresa, 'remontagem', p_pai_cod, v_filho.filho_cod, p_quantidade, v_necessario,
      v_filho.fator, v_raiz, p_motivo, v_necessario, v_uid
    );

    v_movs := v_movs || jsonb_build_object(
      'filho_cod', v_filho.filho_cod, 'consumido', v_necessario, 'fator', v_filho.fator
    );
  END LOOP;

  INSERT INTO public.estoque_lote_interno(empresa, cod_produto, lote_origem, raiz_cod, quantidade)
  VALUES (p_empresa, p_pai_cod, NULL, COALESCE(v_raiz, p_pai_cod), p_quantidade)
  ON CONFLICT (empresa, cod_produto, COALESCE(lote_origem, '')) DO UPDATE
    SET quantidade = estoque_lote_interno.quantidade + EXCLUDED.quantidade,
        updated_at = now();

  RETURN jsonb_build_object(
    'ok', true, 'pai_cod', p_pai_cod,
    'quantidade_remontada', p_quantidade,
    'componentes_consumidos', v_movs,
    'unidades_equivalentes_total', v_total_eq
  );
END;
$function$;

-- ---------------------------------------------------------------------
-- estoque_validar_consolidado_erp — swap fonte da CTE de fator
-- (só a parte do fator; corpo original preservado no restante)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estoque_validar_consolidado_erp(p_produto_raizes integer[], p_empresas integer[] DEFAULT NULL::integer[])
 RETURNS TABLE(produto_raiz integer, cache_saldo_em_caixas numeric, cache_saldo_total_em_unidades numeric, cache_bloqueado_total_em_unidades numeric, cache_disponivel_total_em_unidades numeric, cache_custo_total numeric, erp_saldo_em_caixas numeric, erp_saldo_total_em_unidades numeric, erp_bloqueado_total_em_unidades numeric, erp_disponivel_total_em_unidades numeric, erp_custo_total numeric, delta_saldo_total_em_unidades numeric, delta_bloqueado_total_em_unidades numeric, delta_disponivel_total_em_unidades numeric, delta_custo_total numeric, filiais_count integer, filiais_sync jsonb, ultima_sync timestamp with time zone, filiais_defasadas integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
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
    SELECT fd.sku, MAX(fd.fator)::numeric AS fator_un FROM fator_desc fd GROUP BY fd.sku
  ),
  estoque_raw AS (
    SELECT e.empresa_par AS empresa, e.abrev_par, e.cod_produto,
           SUM(COALESCE(e.saldo, 0))                     AS saldo_total,
           SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado_total,
           SUM(COALESCE(e.custo_total, 0))               AS custo_total,
           MAX(e.sincronizado_em)                        AS sincronizado_em
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
      AND (p_empresas IS NULL OR e.empresa_par = ANY(p_empresas))
    GROUP BY e.empresa_par, e.abrev_par, e.cod_produto
  ),
  classificado AS (
    SELECT er.empresa, er.abrev_par, er.cod_produto,
           er.saldo_total, er.bloqueado_total,
           GREATEST(er.saldo_total - er.bloqueado_total, 0) AS disponivel_total,
           er.custo_total, er.sincronizado_em, n.nivel,
           COALESCE(n.produto_raiz, er.cod_produto) AS produto_raiz,
           COALESCE(fps.fator_un, 1)::numeric AS fator_un
    FROM estoque_raw er
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = er.cod_produto
    LEFT JOIN fator_por_sku fps ON fps.sku = er.cod_produto
  ),
  classificado_filtrado AS (
    SELECT cl.* FROM classificado cl WHERE cl.produto_raiz = ANY(p_produto_raizes)
  ),
  agg_por_raiz AS (
    SELECT cf.produto_raiz,
           SUM(CASE WHEN cf.nivel = 1 THEN cf.saldo_total ELSE 0 END) AS erp_saldo_em_caixas,
           SUM(cf.saldo_total      * cf.fator_un) AS erp_saldo_total_em_unidades,
           SUM(cf.bloqueado_total  * cf.fator_un) AS erp_bloqueado_total_em_unidades,
           SUM(cf.disponivel_total * cf.fator_un) AS erp_disponivel_total_em_unidades,
           SUM(cf.custo_total)                    AS erp_custo_total,
           COUNT(DISTINCT cf.empresa)             AS filiais_count,
           MAX(cf.sincronizado_em)                AS ultima_sync,
           COUNT(DISTINCT cf.empresa) FILTER (WHERE cf.sincronizado_em < now() - interval '1 day') AS filiais_defasadas,
           jsonb_object_agg(cf.abrev_par, to_char(cf.sincronizado_em, 'YYYY-MM-DD HH24:MI'))
             FILTER (WHERE cf.abrev_par IS NOT NULL AND cf.sincronizado_em IS NOT NULL) AS filiais_sync
    FROM classificado_filtrado cf
    GROUP BY cf.produto_raiz
  ),
  cache_por_raiz AS (
    SELECT u.produto_raiz,
           SUM(u.saldo_em_caixas)              AS cache_saldo_em_caixas,
           SUM(u.saldo_total_em_unidades)      AS cache_saldo_total_em_unidades,
           SUM(u.bloqueado_total_em_unidades)  AS cache_bloqueado_total_em_unidades,
           SUM(u.disponivel_total_em_unidades) AS cache_disponivel_total_em_unidades,
           SUM(u.custo_total)                  AS cache_custo_total
    FROM public.estoque_unificado_cache u
    WHERE u.produto_raiz = ANY(p_produto_raizes)
      AND (p_empresas IS NULL OR u.empresa = ANY(p_empresas))
    GROUP BY u.produto_raiz
  )
  SELECT
    r::integer AS produto_raiz,
    COALESCE(c.cache_saldo_em_caixas, 0),
    COALESCE(c.cache_saldo_total_em_unidades, 0),
    COALESCE(c.cache_bloqueado_total_em_unidades, 0),
    COALESCE(c.cache_disponivel_total_em_unidades, 0),
    COALESCE(c.cache_custo_total, 0),
    COALESCE(a.erp_saldo_em_caixas, 0),
    COALESCE(a.erp_saldo_total_em_unidades, 0),
    COALESCE(a.erp_bloqueado_total_em_unidades, 0),
    COALESCE(a.erp_disponivel_total_em_unidades, 0),
    COALESCE(a.erp_custo_total, 0),
    COALESCE(c.cache_saldo_total_em_unidades, 0)      - COALESCE(a.erp_saldo_total_em_unidades, 0),
    COALESCE(c.cache_bloqueado_total_em_unidades, 0)  - COALESCE(a.erp_bloqueado_total_em_unidades, 0),
    COALESCE(c.cache_disponivel_total_em_unidades, 0) - COALESCE(a.erp_disponivel_total_em_unidades, 0),
    COALESCE(c.cache_custo_total, 0)                  - COALESCE(a.erp_custo_total, 0),
    COALESCE(a.filiais_count, 0)::int,
    COALESCE(a.filiais_sync, '{}'::jsonb),
    a.ultima_sync,
    COALESCE(a.filiais_defasadas, 0)::int
  FROM unnest(p_produto_raizes) AS r
  LEFT JOIN cache_por_raiz c ON c.produto_raiz = r
  LEFT JOIN agg_por_raiz  a ON a.produto_raiz = r;
END;
$function$;

-- ---------------------------------------------------------------------
-- audit_estoque_unificado_cobertura — troca a checagem de "raízes sem BOM"
-- para a fonte oficial. Mantido campo indicador 'bom_edges_duplicadas' com o
-- mesmo nome (o significado agora é "duplicidades na composição do ERP").
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_estoque_unificado_cobertura()
 RETURNS TABLE(indicador text, total bigint, amostra jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH sem_nome AS (
    SELECT v.cod_produto, v.empresa
    FROM public.vw_estoque_unificado_skus v
    WHERE v.nome_prod IS NULL
       OR btrim(v.nome_prod) = ''
       OR lower(btrim(v.nome_prod)) = ('produto ' || v.cod_produto)
  ),
  raiz_sem_bom AS (
    SELECT DISTINCT epn.cod_produto AS produto_raiz
    FROM public.estoque_produto_nivel epn
    WHERE epn.nivel = 1
      AND NOT EXISTS (
        SELECT 1 FROM public.erp_composicao_produto c
        WHERE c.produto_compo = epn.cod_produto
      )
  ),
  dup_edges AS (
    SELECT empresa_compo AS empresa, produto_compo AS pai_cod,
           materia_compo AS filho_cod, COUNT(*) AS c
    FROM public.erp_composicao_produto
    GROUP BY 1,2,3 HAVING COUNT(*) > 1
  )
  SELECT 'skus_sem_nome'::text, COUNT(*)::bigint,
         COALESCE(jsonb_agg(jsonb_build_object('empresa', empresa, 'cod', cod_produto))
                  FILTER (WHERE cod_produto IS NOT NULL), '[]'::jsonb)
  FROM (SELECT * FROM sem_nome LIMIT 50) s
  UNION ALL
  SELECT 'raizes_sem_bom', (SELECT COUNT(*) FROM raiz_sem_bom),
         COALESCE(jsonb_agg(jsonb_build_object('raiz', produto_raiz)) FILTER (WHERE produto_raiz IS NOT NULL), '[]'::jsonb)
  FROM (SELECT * FROM raiz_sem_bom LIMIT 50) r
  UNION ALL
  SELECT 'bom_edges_duplicadas', (SELECT COUNT(*) FROM dup_edges),
         COALESCE(jsonb_agg(jsonb_build_object('empresa', empresa, 'pai', pai_cod, 'filho', filho_cod, 'qtd', c)) FILTER (WHERE empresa IS NOT NULL), '[]'::jsonb)
  FROM (SELECT * FROM dup_edges LIMIT 50) d;
$function$;

-- =====================================================================
-- ITEM 2 — Refresh do cache unificado via cron server-side
-- =====================================================================

-- Auto-cura: se há SKU com saldo sem linha em estoque_produto_nivel,
-- recalcula os níveis antes de reconstruir o cache.
CREATE OR REPLACE FUNCTION public.refresh_estoque_unificado_cache()
 RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_missing integer;
BEGIN
  -- Auto-cura de níveis (elimina caso "SKU novo sem nível")
  SELECT COUNT(*) INTO v_missing
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL
    AND COALESCE(e.saldo, 0) <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.estoque_produto_nivel n
      WHERE n.cod_produto = e.cod_produto
    );
  IF v_missing > 0 THEN
    PERFORM public.recalcular_estoque_niveis();
  END IF;

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
    SELECT sku, MAX(fator)::numeric AS fator_un FROM fator_desc GROUP BY sku
  ),
  estoque AS (
    SELECT e.empresa_par AS empresa, e.cod_produto,
           SUM(COALESCE(e.saldo, 0))                     AS saldo_total,
           SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado_total,
           SUM(COALESCE(e.pedido_pendente, 0))           AS pendente_total,
           SUM(COALESCE(e.custo_total, 0))               AS custo_total
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
    GROUP BY e.empresa_par, e.cod_produto
  ),
  classificado AS (
    SELECT es.empresa, es.cod_produto, es.saldo_total, es.bloqueado_total, es.pendente_total,
           GREATEST(es.saldo_total - es.bloqueado_total, 0) AS disponivel_total,
           es.custo_total, n.nivel,
           COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz,
           COALESCE(fps.fator_un, 1)::numeric AS fator_un
    FROM estoque es
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
    LEFT JOIN fator_por_sku fps ON fps.sku = es.cod_produto
  ),
  agg AS (
    SELECT c.empresa, c.produto_raiz,
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
    SELECT a.empresa, a.produto_raiz,
           COALESCE((SELECT fps.fator_un FROM fator_por_sku fps WHERE fps.sku = a.produto_raiz), 1) AS fator_cx_para_un,
           COALESCE((
             SELECT MAX(fps2.fator_un)
             FROM public.erp_composicao_produto c
             JOIN fator_por_sku fps2 ON fps2.sku = c.materia_compo
             WHERE c.produto_compo = a.produto_raiz
           ), 1) AS fator_bx_para_un
    FROM agg a
  ),
  nome_raiz_direto AS (
    SELECT DISTINCT ON (cod_produto) cod_produto AS produto_raiz, nome_prod AS nome
    FROM public.erp_estoque_distribuidora
    WHERE nome_prod IS NOT NULL
    ORDER BY cod_produto, empresa_par
  ),
  nome_folha AS (
    SELECT DISTINCT ON (n.produto_raiz, e.empresa_par)
           n.produto_raiz, e.empresa_par AS empresa, e.nome_prod AS nome
    FROM public.estoque_produto_nivel n
    JOIN public.erp_estoque_distribuidora e ON e.cod_produto = n.cod_produto
    WHERE e.nome_prod IS NOT NULL
    ORDER BY n.produto_raiz, e.empresa_par, n.nivel DESC
  ),
  nome_folha_global AS (
    SELECT DISTINCT ON (n.produto_raiz) n.produto_raiz, e.nome_prod AS nome
    FROM public.estoque_produto_nivel n
    JOIN public.erp_estoque_distribuidora e ON e.cod_produto = n.cod_produto
    WHERE e.nome_prod IS NOT NULL
    ORDER BY n.produto_raiz, n.nivel DESC
  ),
  nome_fabrica AS (
    SELECT codigo_erp AS chave, MIN(COALESCE(nome_comercial, nome)) AS nome
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
         COALESCE(
           NULLIF(epm.ean_caixa_master, ''),
           NULLIF(epm.ean_unitario_master, ''),
           fp.codigo_barras_ean
         ) AS ean_raiz,
         COALESCE(nrd.nome, nf.nome, ng.nome, nfc.nome) AS nome_raiz,
         now()
  FROM agg a
  LEFT JOIN fatores f              ON f.empresa = a.empresa AND f.produto_raiz = a.produto_raiz
  LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = a.produto_raiz::text
  LEFT JOIN public.estoque_produtos_master epm ON epm.codigo_rp = a.produto_raiz::text
  LEFT JOIN nome_raiz_direto nrd   ON nrd.produto_raiz = a.produto_raiz
  LEFT JOIN nome_folha nf          ON nf.empresa = a.empresa AND nf.produto_raiz = a.produto_raiz
  LEFT JOIN nome_folha_global ng   ON ng.produto_raiz = a.produto_raiz
  LEFT JOIN nome_fabrica nfc       ON nfc.chave = a.produto_raiz::text
  WHERE a.saldo_total_em_unidades <> 0
     OR a.bloqueado_total_em_unidades <> 0
     OR a.pendente_total_em_unidades <> 0
     OR COALESCE(a.custo_total, 0) <> 0
     OR a.saldo_em_caixas <> 0
     OR a.saldo_em_displays <> 0
     OR a.saldo_em_unidades <> 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Cron: refresh a cada 5 minutos (idempotente — reagenda se já existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-estoque-unificado') THEN
    PERFORM cron.unschedule('refresh-estoque-unificado');
  END IF;
  PERFORM cron.schedule(
    'refresh-estoque-unificado',
    '*/5 * * * *',
    $cron$SELECT public.refresh_estoque_unificado_cache();$cron$
  );
END $$;
