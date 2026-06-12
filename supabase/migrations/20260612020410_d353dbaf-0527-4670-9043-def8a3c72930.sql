
-- ============================================================
-- Divergência de linha no ERP (mesmo cod_produto com nome_linha
-- diferente entre filiais)
-- ============================================================

-- 1) View pública para auditoria
CREATE OR REPLACE VIEW public.vw_divergencia_linha_erp AS
WITH base AS (
  SELECT
    e.cod_produto,
    MAX(e.nome_prod) AS nome_prod,
    MAX(e.cod_fabricante) AS cod_fabricante,
    ARRAY_AGG(DISTINCT e.nome_linha ORDER BY e.nome_linha) FILTER (WHERE e.nome_linha IS NOT NULL) AS linhas_distintas,
    jsonb_agg(DISTINCT jsonb_build_object(
      'empresa_par', e.empresa_par,
      'abrev_par', e.abrev_par,
      'nome_linha', e.nome_linha,
      'saldo', e.saldo
    )) AS por_filial,
    SUM(COALESCE(e.saldo, 0)) AS saldo_total
  FROM erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL
  GROUP BY e.cod_produto
)
SELECT
  cod_produto,
  nome_prod,
  cod_fabricante,
  linhas_distintas,
  COALESCE(array_length(linhas_distintas, 1), 0) AS qtd_linhas_distintas,
  por_filial,
  saldo_total
FROM base
WHERE COALESCE(array_length(linhas_distintas, 1), 0) > 1;

GRANT SELECT ON public.vw_divergencia_linha_erp TO authenticated;

-- 2) rpc_estoque_cores: adiciona divergência (nova param + 2 colunas no fim)
DROP FUNCTION IF EXISTS public.rpc_estoque_cores(
  integer[], text[], uuid[], text, boolean, boolean, text[], text[], boolean, integer, integer, text, text
);

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
  p_order_dir text DEFAULT 'desc',
  p_apenas_divergencia_linha boolean DEFAULT false
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
  detalhe_desmontagem jsonb, total_count bigint,
  tem_divergencia_linha boolean, linhas_divergentes text[]
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
  div_linhas AS (
    SELECT v.cod_produto, v.linhas_distintas
    FROM vw_divergencia_linha_erp v
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
      (po.cod_produto IS NOT NULL) AS tem_pai, po.detalhe,
      dl.linhas_distintas
    FROM saldo_folha sf
    FULL OUTER JOIN potencial po
      ON po.empresa_par = sf.empresa_par AND po.cod_produto = sf.cod_produto
    LEFT JOIN div_linhas dl
      ON dl.cod_produto = COALESCE(sf.cod_produto, po.cod_produto)
  ),
  filtrado AS (
    SELECT * FROM base b
    WHERE (p_linhas IS NULL OR b.nome_linha = ANY(p_linhas))
      AND (p_curva_fisica IS NULL OR b.curva_fisica = ANY(p_curva_fisica))
      AND (p_curva_monetaria IS NULL OR b.curva_monetaria = ANY(p_curva_monetaria))
      AND (NOT p_com_pedido_pendente OR COALESCE(b.pedido_pendente,0) > 0)
      AND (NOT p_apenas_divergencia_linha OR b.linhas_distintas IS NOT NULL)
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
    c._total AS total_count,
    (c.linhas_distintas IS NOT NULL) AS tem_divergencia_linha,
    c.linhas_distintas AS linhas_divergentes
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
    CASE WHEN p_order_by = 'saldo_potencial_desmontagem' AND p_order_dir = 'asc'  THEN c.saldo_potencial_v END ASC,
    CASE WHEN p_order_by = 'pedido_pendente' AND p_order_dir = 'desc' THEN c.pedido_pendente END DESC,
    CASE WHEN p_order_by = 'pedido_pendente' AND p_order_dir = 'asc'  THEN c.pedido_pendente END ASC,
    CASE WHEN p_order_by = 'custo_total' AND p_order_dir = 'desc' THEN c.custo_total END DESC,
    CASE WHEN p_order_by = 'custo_total' AND p_order_dir = 'asc'  THEN c.custo_total END ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_estoque_cores(
  integer[], text[], uuid[], text, boolean, boolean, text[], text[], boolean, integer, integer, text, text, boolean
) TO authenticated;


-- 3) rpc_estoque_cores_consolidado: idem
DROP FUNCTION IF EXISTS public.rpc_estoque_cores_consolidado(
  integer[], text[], uuid[], text, boolean, boolean, text[], text[], boolean, integer, integer, text, text
);

CREATE OR REPLACE FUNCTION public.rpc_estoque_cores_consolidado(
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
  p_order_dir text DEFAULT 'desc',
  p_apenas_divergencia_linha boolean DEFAULT false
)
RETURNS TABLE (
  cod_produto integer,
  cod_fabricante text,
  nome_prod text,
  nome_linha text,
  unidade_medida text,
  curva_fisica text,
  curva_monetaria text,
  qtd_empresas integer,
  saldo_proprio numeric,
  saldo_potencial_desmontagem numeric,
  saldo_total_disponivel numeric,
  pedido_pendente numeric,
  estoque_endereco numeric,
  estoque_bloqueado_produto numeric,
  estoque_bloqueado_endereco numeric,
  por_empresa jsonb,
  total_count bigint,
  tem_divergencia_linha boolean,
  linhas_divergentes text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_empresas integer[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

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
    SELECT
      p.cod_folha,
      c.produto_compo,
      p.fator * GREATEST(COALESCE(c.quantidade_compo, 1), 1)::numeric,
      p.depth + 1,
      p.visited || c.produto_compo
    FROM caminhos p
    JOIN erp_composicao_produto c ON c.materia_compo = p.cod_ancestor
    WHERE p.depth < 5 AND NOT (c.produto_compo = ANY(p.visited))
  ),
  saldo_folha AS (
    SELECT
      e.empresa_par,
      e.abrev_par,
      e.cod_produto,
      e.cod_fabricante,
      e.nome_prod,
      e.nome_linha,
      e.unidade_medida,
      e.saldo,
      e.pedido_pendente,
      e.curva_fisica,
      e.curva_monetaria,
      e.estoque_endereco,
      e.estoque_bloqueado_produto,
      e.estoque_bloqueado_endereco
    FROM erp_estoque_distribuidora e
    JOIN folhas f ON f.cod_folha = e.cod_produto
    WHERE e.empresa_par = ANY(v_empresas)
  ),
  potencial AS (
    SELECT
      ep.empresa_par,
      cam.cod_folha AS cod_produto,
      SUM(COALESCE(ep.saldo, 0) * cam.fator) AS saldo_potencial,
      jsonb_agg(
        jsonb_build_object(
          'cod_pai', ep.cod_produto,
          'nome_pai', ep.nome_prod,
          'saldo_pai', ep.saldo,
          'fator', cam.fator,
          'contribuicao', COALESCE(ep.saldo, 0) * cam.fator
        ) ORDER BY (COALESCE(ep.saldo, 0) * cam.fator) DESC
      ) FILTER (WHERE COALESCE(ep.saldo,0) > 0) AS detalhe
    FROM caminhos cam
    JOIN erp_estoque_distribuidora ep
      ON ep.cod_produto = cam.cod_ancestor
     AND ep.empresa_par = ANY(v_empresas)
    GROUP BY ep.empresa_par, cam.cod_folha
  ),
  div_linhas AS (
    SELECT v.cod_produto, v.linhas_distintas FROM vw_divergencia_linha_erp v
  ),
  base AS (
    SELECT
      COALESCE(sf.empresa_par, po.empresa_par) AS empresa_par,
      sf.abrev_par,
      COALESCE(sf.cod_produto, po.cod_produto) AS cod_produto,
      sf.cod_fabricante,
      sf.nome_prod,
      sf.nome_linha,
      sf.unidade_medida,
      sf.curva_fisica,
      sf.curva_monetaria,
      COALESCE(sf.saldo, 0) AS saldo_proprio_v,
      COALESCE(po.saldo_potencial, 0) AS saldo_potencial_v,
      COALESCE(sf.pedido_pendente, 0) AS pedido_pendente,
      COALESCE(sf.estoque_endereco, 0) AS estoque_endereco,
      COALESCE(sf.estoque_bloqueado_produto, 0) AS estoque_bloqueado_produto,
      COALESCE(sf.estoque_bloqueado_endereco, 0) AS estoque_bloqueado_endereco,
      po.detalhe
    FROM saldo_folha sf
    FULL OUTER JOIN potencial po
      ON po.empresa_par = sf.empresa_par AND po.cod_produto = sf.cod_produto
  ),
  filtrado AS (
    SELECT b.*, dl.linhas_distintas
    FROM base b
    LEFT JOIN div_linhas dl ON dl.cod_produto = b.cod_produto
    WHERE
      (p_linhas IS NULL OR b.nome_linha = ANY(p_linhas))
      AND (p_curva_fisica IS NULL OR b.curva_fisica = ANY(p_curva_fisica))
      AND (p_curva_monetaria IS NULL OR b.curva_monetaria = ANY(p_curva_monetaria))
      AND (NOT p_com_pedido_pendente OR b.pedido_pendente > 0)
      AND (NOT p_apenas_divergencia_linha OR dl.linhas_distintas IS NOT NULL)
      AND (
        p_busca IS NULL OR p_busca = ''
        OR b.nome_prod ILIKE '%'||p_busca||'%'
        OR b.cod_fabricante ILIKE '%'||p_busca||'%'
        OR b.cod_produto::text = p_busca
      )
      AND (
        p_campanha_ids IS NULL
        OR EXISTS (
          SELECT 1 FROM estoque_etiqueta_produtos ep
          WHERE ep.cod_produto = b.cod_produto AND ep.etiqueta_id = ANY(p_campanha_ids)
        )
      )
  ),
  agg AS (
    SELECT
      f.cod_produto,
      MAX(f.cod_fabricante) AS cod_fabricante,
      MAX(f.nome_prod) AS nome_prod,
      MAX(f.nome_linha) AS nome_linha,
      MAX(f.unidade_medida) AS unidade_medida,
      MAX(f.curva_fisica) AS curva_fisica,
      MAX(f.curva_monetaria) AS curva_monetaria,
      COUNT(DISTINCT f.empresa_par)::integer AS qtd_empresas,
      SUM(f.saldo_proprio_v) AS saldo_proprio,
      SUM(f.saldo_potencial_v) AS saldo_potencial,
      SUM(f.pedido_pendente) AS pedido_pendente,
      SUM(f.estoque_endereco) AS estoque_endereco,
      SUM(f.estoque_bloqueado_produto) AS estoque_bloqueado_produto,
      SUM(f.estoque_bloqueado_endereco) AS estoque_bloqueado_endereco,
      MAX(f.linhas_distintas) AS linhas_distintas,
      jsonb_agg(
        jsonb_build_object(
          'empresa_par', f.empresa_par,
          'abrev_par', f.abrev_par,
          'saldo_proprio', f.saldo_proprio_v,
          'saldo_potencial_desmontagem', f.saldo_potencial_v,
          'saldo_total_disponivel', f.saldo_proprio_v + f.saldo_potencial_v,
          'pedido_pendente', f.pedido_pendente,
          'estoque_endereco', f.estoque_endereco,
          'estoque_bloqueado_produto', f.estoque_bloqueado_produto,
          'estoque_bloqueado_endereco', f.estoque_bloqueado_endereco,
          'detalhe_desmontagem', f.detalhe,
          'nome_linha', f.nome_linha
        ) ORDER BY (f.saldo_proprio_v + f.saldo_potencial_v) DESC
      ) AS por_empresa
    FROM filtrado f
    GROUP BY f.cod_produto
  ),
  calc AS (
    SELECT
      a.*,
      CASE WHEN p_incluir_potencial
           THEN a.saldo_proprio + a.saldo_potencial
           ELSE a.saldo_proprio
      END AS saldo_total
    FROM agg a
    WHERE NOT p_apenas_com_saldo
       OR (CASE WHEN p_incluir_potencial
                THEN a.saldo_proprio + a.saldo_potencial
                ELSE a.saldo_proprio
           END) > 0
  ),
  counted AS (
    SELECT c.*, COUNT(*) OVER () AS _total FROM calc c
  )
  SELECT
    c.cod_produto,
    c.cod_fabricante,
    c.nome_prod,
    c.nome_linha,
    c.unidade_medida,
    c.curva_fisica,
    c.curva_monetaria,
    c.qtd_empresas,
    c.saldo_proprio,
    c.saldo_potencial AS saldo_potencial_desmontagem,
    c.saldo_total AS saldo_total_disponivel,
    c.pedido_pendente,
    c.estoque_endereco,
    c.estoque_bloqueado_produto,
    c.estoque_bloqueado_endereco,
    c.por_empresa,
    c._total AS total_count,
    (c.linhas_distintas IS NOT NULL) AS tem_divergencia_linha,
    c.linhas_distintas AS linhas_divergentes
  FROM counted c
  ORDER BY
    CASE WHEN p_order_by = 'nome_prod' AND p_order_dir = 'asc'  THEN c.nome_prod END ASC,
    CASE WHEN p_order_by = 'nome_prod' AND p_order_dir = 'desc' THEN c.nome_prod END DESC,
    CASE WHEN p_order_by = 'saldo' AND p_order_dir = 'asc'  THEN c.saldo_total END ASC,
    CASE WHEN p_order_by = 'saldo' AND p_order_dir = 'desc' THEN c.saldo_total END DESC,
    CASE WHEN p_order_by = 'saldo_total_disponivel' AND p_order_dir = 'asc'  THEN c.saldo_total END ASC,
    CASE WHEN p_order_by = 'saldo_total_disponivel' AND p_order_dir = 'desc' THEN c.saldo_total END DESC,
    CASE WHEN p_order_by = 'saldo_potencial_desmontagem' AND p_order_dir = 'desc' THEN c.saldo_potencial END DESC,
    CASE WHEN p_order_by = 'saldo_potencial_desmontagem' AND p_order_dir = 'asc'  THEN c.saldo_potencial END ASC,
    CASE WHEN p_order_by = 'pedido_pendente' AND p_order_dir = 'desc' THEN c.pedido_pendente END DESC,
    CASE WHEN p_order_by = 'pedido_pendente' AND p_order_dir = 'asc'  THEN c.pedido_pendente END ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END
$$;

GRANT EXECUTE ON FUNCTION public.rpc_estoque_cores_consolidado(
  integer[], text[], uuid[], text, boolean, boolean, text[], text[], boolean, integer, integer, text, text, boolean
) TO authenticated;
