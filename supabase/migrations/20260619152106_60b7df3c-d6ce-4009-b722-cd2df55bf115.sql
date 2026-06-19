DROP VIEW IF EXISTS public.v_estoque_fornecedor_integrado;

CREATE VIEW public.v_estoque_fornecedor_integrado AS
WITH ean_norm AS (
  SELECT ef.id, ef.empresa_id, ef.empresa_nome, ef.ean_caixa, ef.codigo_produto,
         ef.descricao, ef.estoque_caixas, ef.status, ef.data_atualizacao_origem,
         ef.sincronizado_em,
         NULLIF(btrim(ef.ean_caixa), '') AS ean_normalizado
    FROM public.fornecedor_estoque_futura ef
),
match_master AS (
  SELECT en.*,
         epm.codigo_rp AS m_codigo_rp,
         epm.sku_master AS m_sku_master,
         epm.nome AS m_nome,
         CASE
           WHEN epm.ean_caixa_master = en.ean_normalizado THEN 'master_caixa'
           WHEN epm.ean_unitario_master = en.ean_normalizado THEN 'master_unitario'
           ELSE NULL
         END AS m_origem
    FROM ean_norm en
    LEFT JOIN public.estoque_produtos_master epm
      ON en.ean_normalizado IS NOT NULL
     AND (epm.ean_caixa_master = en.ean_normalizado
          OR epm.ean_unitario_master = en.ean_normalizado)
),
match_depara AS (
  SELECT mm.*,
         d.codigo_rp AS d_codigo_rp,
         d.sku_master AS d_sku_master,
         d.nome_master AS d_nome
    FROM match_master mm
    LEFT JOIN public.fornecedor_ean_depara d
      ON mm.m_codigo_rp IS NULL
     AND mm.ean_normalizado IS NOT NULL
     AND d.ean_fornecedor = mm.ean_normalizado
),
match_fabrica AS (
  SELECT md.*,
         fp.codigo AS f_codigo,
         fp.sku AS f_sku,
         fp.nome_comercial AS f_nome
    FROM match_depara md
    LEFT JOIN public.fabrica_produtos fp
      ON md.m_codigo_rp IS NULL
     AND md.d_codigo_rp IS NULL
     AND md.ean_normalizado IS NOT NULL
     AND fp.codigo_barras_ean::text = md.ean_normalizado
),
saldo AS (
  SELECT produto_raiz::text AS produto_raiz_txt,
         SUM(saldo_total_em_unidades) AS nosso_saldo_un,
         SUM(saldo_em_caixas) AS nosso_saldo_cx,
         jsonb_object_agg(
           empresa::text,
           jsonb_build_object(
             'cx', saldo_em_caixas,
             'un', saldo_total_em_unidades
           )
         ) AS saldos_por_empresa
    FROM public.estoque_unificado_cache
   GROUP BY produto_raiz
)
SELECT
  r.empresa_id,
  r.empresa_nome,
  r.ean_caixa,
  r.ean_normalizado,
  r.codigo_produto AS futura_codigo,
  r.descricao AS futura_descricao,
  r.estoque_caixas AS fornecedor_caixas,
  r.status AS futura_status,
  r.data_atualizacao_origem,
  r.sincronizado_em,
  COALESCE(r.m_codigo_rp, r.d_codigo_rp, r.f_codigo::text) AS nosso_codigo,
  COALESCE(r.m_sku_master, r.d_sku_master, r.f_sku) AS sku,
  COALESCE(r.m_nome, r.d_nome, r.f_nome) AS nome_comercial,
  COALESCE(
    r.m_origem,
    CASE WHEN r.d_codigo_rp IS NOT NULL THEN 'depara_manual' END,
    CASE WHEN r.f_codigo IS NOT NULL THEN 'fabrica_produtos' END
  ) AS origem_match,
  s.nosso_saldo_un,
  s.nosso_saldo_cx,
  s.saldos_por_empresa,
  COALESCE(r.m_codigo_rp, r.d_codigo_rp, r.f_codigo::text) IS NOT NULL AS casado
FROM match_fabrica r
LEFT JOIN saldo s
  ON s.produto_raiz_txt = COALESCE(r.m_codigo_rp, r.d_codigo_rp, r.f_codigo::text);

GRANT SELECT ON public.v_estoque_fornecedor_integrado TO authenticated;
GRANT ALL ON public.v_estoque_fornecedor_integrado TO service_role;