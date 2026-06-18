
-- ============================================================
-- 1) Enriquecer estoque_produtos_master com dados do RP
-- ============================================================
ALTER TABLE public.estoque_produtos_master
  ADD COLUMN IF NOT EXISTS codigo_rp           text,
  ADD COLUMN IF NOT EXISTS ean_unitario_master text,
  ADD COLUMN IF NOT EXISTS ean_caixa_master    text,
  ADD COLUMN IF NOT EXISTS altura_cm           numeric(10,3),
  ADD COLUMN IF NOT EXISTS largura_cm          numeric(10,3),
  ADD COLUMN IF NOT EXISTS profundidade_cm     numeric(10,3),
  ADD COLUMN IF NOT EXISTS ncm                 text,
  ADD COLUMN IF NOT EXISTS unidade_rp          text,
  ADD COLUMN IF NOT EXISTS origem_cadastro     text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS sincronizado_rp_em  timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_master_codigo_rp
  ON public.estoque_produtos_master (codigo_rp)
  WHERE codigo_rp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estoque_master_ean_caixa
  ON public.estoque_produtos_master (ean_caixa_master)
  WHERE ean_caixa_master IS NOT NULL AND ean_caixa_master <> '';

CREATE INDEX IF NOT EXISTS idx_estoque_master_ean_unit
  ON public.estoque_produtos_master (ean_unitario_master)
  WHERE ean_unitario_master IS NOT NULL AND ean_unitario_master <> '';

-- ============================================================
-- 2) Auditoria de alterações no master
-- ============================================================
CREATE TABLE IF NOT EXISTS public.estoque_produtos_master_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id     uuid NOT NULL REFERENCES public.estoque_produtos_master(id) ON DELETE CASCADE,
  campo         text NOT NULL,
  valor_antes   text,
  valor_depois  text,
  origem        text NOT NULL DEFAULT 'manual',
  changed_by    uuid REFERENCES auth.users(id),
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_audit_master ON public.estoque_produtos_master_audit (master_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_audit_origem ON public.estoque_produtos_master_audit (origem, changed_at DESC);

GRANT SELECT ON public.estoque_produtos_master_audit TO authenticated;
GRANT ALL    ON public.estoque_produtos_master_audit TO service_role;

ALTER TABLE public.estoque_produtos_master_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_audit_select_admin_supervisor"
  ON public.estoque_produtos_master_audit
  FOR SELECT TO authenticated
  USING (is_admin_or_supervisor((SELECT auth.uid())));

CREATE POLICY "master_audit_service_write"
  ON public.estoque_produtos_master_audit
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 3) Espelho bruto do catálogo RP (Cust_EstruturaProdutosSP)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.erp_produto_catalogo_raw (
  codigo_rp        text PRIMARY KEY,
  descricao        text,
  ean_unitario     text,
  ean_caixa        text,
  unidade          text,
  peso_liquido_kg  numeric(12,4),
  peso_bruto_kg    numeric(12,4),
  altura_cm        numeric(10,3),
  largura_cm       numeric(10,3),
  profundidade_cm  numeric(10,3),
  ncm              text,
  categoria        text,
  ativo            boolean,
  raw              jsonb,
  hash_conteudo    text,
  sincronizado_em  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_cat_raw_ean_caixa ON public.erp_produto_catalogo_raw (ean_caixa)    WHERE ean_caixa    IS NOT NULL AND ean_caixa    <> '';
CREATE INDEX IF NOT EXISTS idx_erp_cat_raw_ean_unit  ON public.erp_produto_catalogo_raw (ean_unitario) WHERE ean_unitario IS NOT NULL AND ean_unitario <> '';
CREATE INDEX IF NOT EXISTS idx_erp_cat_raw_sync      ON public.erp_produto_catalogo_raw (sincronizado_em DESC);

GRANT SELECT ON public.erp_produto_catalogo_raw TO authenticated;
GRANT ALL    ON public.erp_produto_catalogo_raw TO service_role;

ALTER TABLE public.erp_produto_catalogo_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_cat_raw_select_admin_supervisor"
  ON public.erp_produto_catalogo_raw
  FOR SELECT TO authenticated
  USING (is_admin_or_supervisor((SELECT auth.uid())));

CREATE POLICY "erp_cat_raw_service_write"
  ON public.erp_produto_catalogo_raw
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_erp_cat_raw_updated
  BEFORE UPDATE ON public.erp_produto_catalogo_raw
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4) Infra de compras automáticas (schema agora, regras depois)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compras_automaticas_regras (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_master_id      uuid NOT NULL REFERENCES public.estoque_produtos_master(id) ON DELETE CASCADE,
  cobertura_minima_dias  integer NOT NULL DEFAULT 30,
  ponto_pedido_caixas    numeric(15,4),
  lote_minimo_compra     numeric(15,4),
  ativo                  boolean NOT NULL DEFAULT true,
  observacoes            text,
  created_by             uuid REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_master_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_automaticas_regras TO authenticated;
GRANT ALL ON public.compras_automaticas_regras TO service_role;

ALTER TABLE public.compras_automaticas_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_regras_admin_sup_all"
  ON public.compras_automaticas_regras
  FOR ALL TO authenticated
  USING (is_admin_or_supervisor((SELECT auth.uid())))
  WITH CHECK (is_admin_or_supervisor((SELECT auth.uid())));

CREATE TRIGGER trg_compras_regras_updated
  BEFORE UPDATE ON public.compras_automaticas_regras
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.compras_automaticas_sugestoes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_master_id           uuid NOT NULL REFERENCES public.estoque_produtos_master(id) ON DELETE CASCADE,
  gerado_em                   timestamptz NOT NULL DEFAULT now(),
  quantidade_sugerida_caixas  numeric(15,4) NOT NULL,
  motivo                      text,
  status                      text NOT NULL DEFAULT 'pendente',
  pedido_id                   uuid,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_sug_status ON public.compras_automaticas_sugestoes (status, gerado_em DESC);
CREATE INDEX IF NOT EXISTS idx_compras_sug_prod   ON public.compras_automaticas_sugestoes (produto_master_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_automaticas_sugestoes TO authenticated;
GRANT ALL ON public.compras_automaticas_sugestoes TO service_role;

ALTER TABLE public.compras_automaticas_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_sug_admin_sup_all"
  ON public.compras_automaticas_sugestoes
  FOR ALL TO authenticated
  USING (is_admin_or_supervisor((SELECT auth.uid())))
  WITH CHECK (is_admin_or_supervisor((SELECT auth.uid())));

CREATE TRIGGER trg_compras_sug_updated
  BEFORE UPDATE ON public.compras_automaticas_sugestoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- skeleton — será evoluída no módulo de compras automáticas
CREATE OR REPLACE FUNCTION public.gerar_sugestoes_compra()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 0;
END;
$$;

-- ============================================================
-- 5) RPC aplicar_catalogo_rp_no_master
-- ============================================================
CREATE OR REPLACE FUNCTION public.aplicar_catalogo_rp_no_master()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atualizados integer := 0;
  v_inseridos   integer := 0;
  v_sem_match   integer := 0;
  r             record;
  v_master_id   uuid;
  v_old         record;
BEGIN
  FOR r IN SELECT * FROM public.erp_produto_catalogo_raw LOOP
    v_master_id := NULL;

    -- match em cascata
    SELECT id INTO v_master_id
      FROM public.estoque_produtos_master
     WHERE codigo_rp = r.codigo_rp
     LIMIT 1;

    IF v_master_id IS NULL THEN
      SELECT id INTO v_master_id
        FROM public.estoque_produtos_master
       WHERE sku_master = r.codigo_rp
       LIMIT 1;
    END IF;

    IF v_master_id IS NULL AND COALESCE(r.ean_caixa,'') <> '' THEN
      SELECT id INTO v_master_id
        FROM public.estoque_produtos_master
       WHERE ean_caixa_master = r.ean_caixa
       LIMIT 1;
    END IF;

    IF v_master_id IS NULL AND COALESCE(r.ean_unitario,'') <> '' THEN
      SELECT id INTO v_master_id
        FROM public.estoque_produtos_master
       WHERE ean_unitario_master = r.ean_unitario
       LIMIT 1;
    END IF;

    IF v_master_id IS NULL THEN
      -- insere novo master
      INSERT INTO public.estoque_produtos_master (
        nome, sku_master, unidade_medida, descricao,
        peso_liquido, peso_bruto,
        codigo_rp, ean_unitario_master, ean_caixa_master,
        altura_cm, largura_cm, profundidade_cm, ncm, unidade_rp,
        categoria, origem_cadastro, sincronizado_rp_em
      ) VALUES (
        COALESCE(NULLIF(r.descricao,''), r.codigo_rp),
        r.codigo_rp,
        COALESCE(NULLIF(r.unidade,''), 'UN'),
        r.descricao,
        r.peso_liquido_kg, r.peso_bruto_kg,
        r.codigo_rp, NULLIF(r.ean_unitario,''), NULLIF(r.ean_caixa,''),
        r.altura_cm, r.largura_cm, r.profundidade_cm, r.ncm, r.unidade,
        r.categoria, 'rp', now()
      );
      v_inseridos := v_inseridos + 1;
      CONTINUE;
    END IF;

    SELECT * INTO v_old FROM public.estoque_produtos_master WHERE id = v_master_id;

    -- update só campos nulos ou divergentes
    UPDATE public.estoque_produtos_master m SET
      codigo_rp           = COALESCE(m.codigo_rp, r.codigo_rp),
      ean_unitario_master = CASE WHEN COALESCE(m.ean_unitario_master,'') = '' THEN NULLIF(r.ean_unitario,'') ELSE m.ean_unitario_master END,
      ean_caixa_master    = CASE WHEN COALESCE(m.ean_caixa_master,'')    = '' THEN NULLIF(r.ean_caixa,'')    ELSE m.ean_caixa_master    END,
      peso_liquido        = COALESCE(m.peso_liquido, r.peso_liquido_kg),
      peso_bruto          = COALESCE(m.peso_bruto,   r.peso_bruto_kg),
      altura_cm           = COALESCE(m.altura_cm,    r.altura_cm),
      largura_cm          = COALESCE(m.largura_cm,   r.largura_cm),
      profundidade_cm     = COALESCE(m.profundidade_cm, r.profundidade_cm),
      ncm                 = COALESCE(m.ncm,          r.ncm),
      unidade_rp          = COALESCE(m.unidade_rp,   r.unidade),
      categoria           = COALESCE(m.categoria,    r.categoria),
      descricao           = COALESCE(m.descricao,    r.descricao),
      sincronizado_rp_em  = now()
    WHERE m.id = v_master_id;

    -- auditoria por campo (apenas se mudou)
    INSERT INTO public.estoque_produtos_master_audit (master_id, campo, valor_antes, valor_depois, origem)
    SELECT v_master_id, x.campo, x.antes, x.depois, 'rp'
    FROM (VALUES
      ('codigo_rp',           v_old.codigo_rp,            COALESCE(v_old.codigo_rp, r.codigo_rp)),
      ('ean_unitario_master', v_old.ean_unitario_master,  CASE WHEN COALESCE(v_old.ean_unitario_master,'')='' THEN NULLIF(r.ean_unitario,'') ELSE v_old.ean_unitario_master END),
      ('ean_caixa_master',    v_old.ean_caixa_master,     CASE WHEN COALESCE(v_old.ean_caixa_master,'')   ='' THEN NULLIF(r.ean_caixa,'')    ELSE v_old.ean_caixa_master    END),
      ('peso_liquido',        v_old.peso_liquido::text,   COALESCE(v_old.peso_liquido, r.peso_liquido_kg)::text),
      ('peso_bruto',          v_old.peso_bruto::text,     COALESCE(v_old.peso_bruto,   r.peso_bruto_kg)::text),
      ('altura_cm',           v_old.altura_cm::text,      COALESCE(v_old.altura_cm,    r.altura_cm)::text),
      ('largura_cm',          v_old.largura_cm::text,     COALESCE(v_old.largura_cm,   r.largura_cm)::text),
      ('profundidade_cm',     v_old.profundidade_cm::text,COALESCE(v_old.profundidade_cm, r.profundidade_cm)::text),
      ('ncm',                 v_old.ncm,                  COALESCE(v_old.ncm,          r.ncm)),
      ('unidade_rp',          v_old.unidade_rp,           COALESCE(v_old.unidade_rp,   r.unidade)),
      ('categoria',           v_old.categoria,            COALESCE(v_old.categoria,    r.categoria))
    ) AS x(campo, antes, depois)
    WHERE x.antes IS DISTINCT FROM x.depois;

    v_atualizados := v_atualizados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'atualizados', v_atualizados,
    'inseridos',   v_inseridos,
    'sem_match',   v_sem_match,
    'executado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_catalogo_rp_no_master() FROM public;
GRANT EXECUTE ON FUNCTION public.aplicar_catalogo_rp_no_master() TO service_role;

-- ============================================================
-- 6) View vw_estoque_marca_niveis — Explode estoque Futura usando composição
-- ============================================================
CREATE OR REPLACE VIEW public.vw_estoque_marca_niveis AS
WITH RECURSIVE
-- fator: unidades-folha contidas em 1 sku (mesma lógica de vw_estoque_unificado_skus)
fator_desc AS (
  SELECT DISTINCT c.materia_compo AS sku, 1::numeric AS fator
    FROM erp_composicao_produto c
   WHERE NOT EXISTS (
     SELECT 1 FROM erp_composicao_produto c2 WHERE c2.produto_compo = c.materia_compo
   )
  UNION ALL
  SELECT c.produto_compo,
         GREATEST(COALESCE(c.quantidade_compo, 1::numeric), 1::numeric) * fd.fator
    FROM erp_composicao_produto c
    JOIN fator_desc fd ON fd.sku = c.materia_compo
),
fator_por_sku AS (
  SELECT sku, max(fator) AS fator_un
    FROM fator_desc
   GROUP BY sku
),
-- caixas Futura casadas com produto raiz via EAN normalizado
futura_caixa AS (
  SELECT ef.empresa_id,
         ef.empresa_nome,
         ef.ean_caixa,
         regexp_replace(ef.ean_caixa, '\D', '', 'g') AS ean_norm,
         ef.codigo_produto AS futura_codigo,
         ef.descricao      AS futura_descricao,
         ef.estoque_caixas,
         ef.sincronizado_em,
         m.id              AS master_id,
         m.sku_master,
         m.nome            AS master_nome,
         n.cod_produto     AS raiz_cod,
         n.produto_raiz
    FROM fornecedor_estoque_futura ef
    JOIN estoque_produtos_master m
      ON regexp_replace(COALESCE(m.ean_caixa_master,''),    '\D','','g') = regexp_replace(COALESCE(ef.ean_caixa,''),'\D','','g')
     AND COALESCE(ef.ean_caixa,'') <> ''
    LEFT JOIN estoque_produto_nivel n
      ON n.cod_produto::text = m.sku_master AND n.nivel = 1
),
-- todos os descendentes (níveis 2 e 3) do raiz no sistema atual
descendentes AS (
  SELECT n.produto_raiz,
         n.cod_produto AS sku_descendente,
         n.nivel
    FROM estoque_produto_nivel n
   WHERE n.produto_raiz IS NOT NULL
)
-- nível 1: a própria caixa Futura
SELECT
  fc.empresa_id,
  fc.empresa_nome,
  fc.master_id,
  fc.sku_master,
  fc.master_nome                                                     AS nome,
  fc.ean_caixa                                                       AS ean,
  fc.raiz_cod                                                        AS cod_produto,
  1::smallint                                                        AS nivel,
  fc.estoque_caixas                                                  AS saldo_marca_caixas,
  fc.estoque_caixas * COALESCE(fps_raiz.fator_un, 1)                 AS saldo_marca_unidades,
  fc.sincronizado_em,
  'caixa_pai'::text                                                  AS origem_explosao
FROM futura_caixa fc
LEFT JOIN fator_por_sku fps_raiz ON fps_raiz.sku::text = fc.raiz_cod::text

UNION ALL

-- níveis 2 e 3: descendentes, saldo equivalente = caixas_futura * fator_raiz / fator_descendente
SELECT
  fc.empresa_id,
  fc.empresa_nome,
  fc.master_id,
  fc.sku_master,
  fc.master_nome                                                     AS nome,
  fp.codigo_barras_ean                                               AS ean,
  d.sku_descendente                                                  AS cod_produto,
  d.nivel::smallint                                                  AS nivel,
  NULL::numeric                                                      AS saldo_marca_caixas,
  fc.estoque_caixas
    * COALESCE(fps_raiz.fator_un, 1)
    / NULLIF(COALESCE(fps_desc.fator_un, 1), 0)                      AS saldo_marca_unidades,
  fc.sincronizado_em,
  'composicao'::text                                                 AS origem_explosao
FROM futura_caixa fc
JOIN descendentes d
  ON d.produto_raiz::text = fc.raiz_cod::text
 AND d.nivel > 1
LEFT JOIN fator_por_sku fps_raiz ON fps_raiz.sku::text = fc.raiz_cod::text
LEFT JOIN fator_por_sku fps_desc ON fps_desc.sku::text = d.sku_descendente::text
LEFT JOIN fabrica_produtos fp     ON fp.codigo::text   = d.sku_descendente::text;

GRANT SELECT ON public.vw_estoque_marca_niveis TO authenticated;
GRANT SELECT ON public.vw_estoque_marca_niveis TO service_role;

-- ============================================================
-- 7) Conciliação marca x distribuidoras
-- ============================================================
CREATE OR REPLACE VIEW public.vw_estoque_consolidado_marca_vs_distribuidoras AS
WITH marca AS (
  SELECT sku_master,
         sum(COALESCE(saldo_marca_unidades, 0)) FILTER (WHERE nivel = 3) AS saldo_marca_un_folhas,
         sum(COALESCE(saldo_marca_caixas,   0)) FILTER (WHERE nivel = 1) AS saldo_marca_caixas,
         max(sincronizado_em) AS marca_sincronizado_em
    FROM public.vw_estoque_marca_niveis
   GROUP BY sku_master
),
dist AS (
  SELECT produto_raiz::text AS produto_raiz,
         sum(COALESCE(saldo_total_em_unidades, 0)) AS saldo_dist_unidades,
         sum(COALESCE(saldo_em_caixas, 0))         AS saldo_dist_caixas
    FROM public.estoque_unificado_cache
   GROUP BY produto_raiz
)
SELECT
  COALESCE(m.sku_master, d.produto_raiz)                  AS chave_raiz,
  m.sku_master                                             AS sku_master,
  d.produto_raiz                                           AS produto_raiz_distribuidoras,
  m.saldo_marca_un_folhas,
  m.saldo_marca_caixas,
  d.saldo_dist_unidades,
  d.saldo_dist_caixas,
  COALESCE(m.saldo_marca_un_folhas, 0) - COALESCE(d.saldo_dist_unidades, 0) AS gap_unidades,
  m.marca_sincronizado_em
FROM marca m
FULL OUTER JOIN dist d ON d.produto_raiz = m.sku_master;

GRANT SELECT ON public.vw_estoque_consolidado_marca_vs_distribuidoras TO authenticated;
GRANT SELECT ON public.vw_estoque_consolidado_marca_vs_distribuidoras TO service_role;
