DROP VIEW IF EXISTS public.v_estoque_fornecedor_integrado;

CREATE VIEW public.v_estoque_fornecedor_integrado AS
WITH ean_norm AS (
  SELECT ef.id,
         ef.empresa_id, ef.empresa_nome,
         ef.ean_caixa,
         ef.codigo_produto, ef.descricao,
         ef.estoque_caixas, ef.status,
         ef.data_atualizacao_origem, ef.sincronizado_em,
         NULLIF(btrim(ef.ean_caixa), '') AS ean_normalizado
  FROM public.fornecedor_estoque_futura ef
),
match_master AS (
  SELECT en.*,
         epm.codigo_rp     AS m_codigo_rp,
         epm.sku_master    AS m_sku_master,
         epm.nome          AS m_nome,
         CASE
           WHEN epm.ean_caixa_master    = en.ean_normalizado THEN 'master_caixa'
           WHEN epm.ean_unitario_master = en.ean_normalizado THEN 'master_unitario'
         END AS m_origem
  FROM ean_norm en
  LEFT JOIN public.estoque_produtos_master epm
    ON en.ean_normalizado IS NOT NULL
   AND (epm.ean_caixa_master = en.ean_normalizado
        OR epm.ean_unitario_master = en.ean_normalizado)
),
match_fabrica AS (
  SELECT mm.*,
         fp.codigo         AS f_codigo,
         fp.sku            AS f_sku,
         fp.nome_comercial AS f_nome
  FROM match_master mm
  LEFT JOIN public.fabrica_produtos fp
    ON mm.m_codigo_rp IS NULL
   AND mm.ean_normalizado IS NOT NULL
   AND fp.codigo_barras_ean::text = mm.ean_normalizado
),
saldo AS (
  SELECT produto_raiz::text AS produto_raiz_txt,
         SUM(saldo_total_em_unidades) AS nosso_saldo_un,
         SUM(saldo_em_caixas)         AS nosso_saldo_cx
  FROM public.estoque_unificado_cache
  GROUP BY produto_raiz
)
SELECT
  r.empresa_id, r.empresa_nome,
  r.ean_caixa, r.ean_normalizado,
  r.codigo_produto AS futura_codigo,
  r.descricao      AS futura_descricao,
  r.estoque_caixas AS fornecedor_caixas,
  r.status         AS futura_status,
  r.data_atualizacao_origem, r.sincronizado_em,
  COALESCE(r.m_codigo_rp, r.f_codigo::text) AS nosso_codigo,
  COALESCE(r.m_sku_master, r.f_sku)         AS sku,
  COALESCE(r.m_nome, r.f_nome)              AS nome_comercial,
  COALESCE(r.m_origem,
           CASE WHEN r.f_codigo IS NOT NULL THEN 'fabrica_produtos' END) AS origem_match,
  s.nosso_saldo_un,
  s.nosso_saldo_cx,
  (COALESCE(r.m_codigo_rp, r.f_codigo::text) IS NOT NULL) AS casado
FROM match_fabrica r
LEFT JOIN saldo s
  ON s.produto_raiz_txt = COALESCE(r.m_codigo_rp, r.f_codigo::text);

GRANT SELECT ON public.v_estoque_fornecedor_integrado TO authenticated;
GRANT ALL ON public.v_estoque_fornecedor_integrado TO service_role;