-- =========================================================================
-- Torre de Controle de Despesas — FASE 1 (backend)
-- 3 RPCs agregadas + índices + cadastro de tela com grants propagados
-- =========================================================================

-- -------------------------------------------------------------------------
-- 2.1  fn_despesas_departamentos
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_despesas_departamentos(
  p_meses int DEFAULT 13,
  p_mes_ref date DEFAULT NULL,
  p_empresa_ids integer[] DEFAULT NULL,
  p_natureza text DEFAULT NULL,
  p_conf_minima numeric DEFAULT NULL,
  p_incluir_sem_depto boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meses     int;
  v_mes_ref   date;
  v_serie_ini date;
  v_ext_ini   date;
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  v_meses     := GREATEST(COALESCE(p_meses, 13), 1);
  v_mes_ref   := COALESCE(date_trunc('month', p_mes_ref)::date,
                          date_trunc('month', current_date)::date);
  v_serie_ini := (v_mes_ref - make_interval(months => v_meses - 1))::date;
  v_ext_ini   := LEAST(v_serie_ini, (v_mes_ref - interval '12 months')::date);

  RETURN (
    WITH base_raw AS (
      SELECT cp.id, cp.departamento_id, cp.departamento_nome, cp.valor_original,
             cp.confianca_classificacao, cp.classificacao_manual,
             date_trunc('month', cp.data_emissao)::date AS mes
      FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_natureza IS NULL OR cp.natureza_lancamento = p_natureza)
        AND cp.data_emissao IS NOT NULL
        AND cp.data_emissao >= v_ext_ini
        AND cp.data_emissao <  (v_mes_ref + interval '1 month')::date
    ),
    qualidade AS (
      SELECT
        COALESCE(sum(valor_original) FILTER (WHERE departamento_id IS NULL AND mes = v_mes_ref), 0) AS valor_sem_depto,
        COALESCE(sum(valor_original) FILTER (WHERE mes = v_mes_ref), 0)                             AS total_ref,
        COALESCE(sum(valor_original) FILTER (
          WHERE mes = v_mes_ref
            AND departamento_nome = 'Administrativo'
            AND COALESCE(confianca_classificacao, 0) < COALESCE(p_conf_minima, 0.7)
            AND classificacao_manual IS NOT TRUE), 0)                                               AS valor_baixa_conf
      FROM base_raw
    ),
    base AS (
      SELECT * FROM base_raw
      WHERE (p_incluir_sem_depto OR departamento_id IS NOT NULL)
        AND (p_conf_minima IS NULL OR NOT (
              departamento_nome = 'Administrativo'
              AND COALESCE(confianca_classificacao, 0) < p_conf_minima
              AND classificacao_manual IS NOT TRUE))
    ),
    dims AS (
      SELECT departamento_id,
             CASE WHEN departamento_id IS NULL THEN '(sem classificação)'
                  ELSE COALESCE(max(departamento_nome), '(sem nome)') END AS departamento_nome
      FROM base
      GROUP BY departamento_id
    ),
    meses_ext AS (
      SELECT gs::date AS mes
      FROM generate_series(v_ext_ini, v_mes_ref, interval '1 month') gs
    ),
    mensal AS (
      SELECT departamento_id, mes, sum(valor_original) AS valor
      FROM base
      GROUP BY 1, 2
    ),
    grade AS (
      SELECT d.departamento_id, d.departamento_nome, m.mes,
             COALESCE(x.valor, 0)::numeric AS valor
      FROM dims d
      CROSS JOIN meses_ext m
      LEFT JOIN mensal x
        ON x.departamento_id IS NOT DISTINCT FROM d.departamento_id
       AND x.mes = m.mes
    ),
    lagged AS (
      SELECT departamento_id, departamento_nome, mes, valor,
             LAG(valor, 1)  OVER w AS valor_m1,
             LAG(valor, 12) OVER w AS valor_m12
      FROM grade
      WINDOW w AS (PARTITION BY departamento_id ORDER BY mes)
    ),
    stats12 AS (
      SELECT departamento_id,
             avg(valor)                        AS media_12m,
             stddev_samp(valor)                AS desvio_12m,
             count(*) FILTER (WHERE valor > 0) AS n_meses_com_mov
      FROM grade
      WHERE mes >= (v_mes_ref - interval '12 months')::date
        AND mes <  v_mes_ref
      GROUP BY departamento_id
    ),
    series_dept AS (
      SELECT departamento_id,
             jsonb_agg(jsonb_build_object(
               'mes', to_char(mes, 'YYYY-MM-DD'),
               'valor', round(valor, 2)) ORDER BY mes) AS serie
      FROM grade
      WHERE mes >= v_serie_ini
      GROUP BY departamento_id
    ),
    tot_mensal AS (
      SELECT mes, sum(valor) AS valor FROM grade GROUP BY mes
    ),
    tot_lag AS (
      SELECT mes, valor,
             LAG(valor, 1)  OVER (ORDER BY mes) AS valor_m1,
             LAG(valor, 12) OVER (ORDER BY mes) AS valor_m12
      FROM tot_mensal
    ),
    tot_ref AS (SELECT * FROM tot_lag WHERE mes = v_mes_ref),
    dept_json AS (
      SELECT COALESCE(jsonb_agg(
               jsonb_build_object(
                 'departamento_id',   l.departamento_id,
                 'departamento_nome', l.departamento_nome,
                 'total_mes_ref',     round(l.valor, 2),
                 'mom_pct',           round(100.0 * (l.valor - l.valor_m1)  / NULLIF(l.valor_m1,  0), 2),
                 'yoy_pct',           round(100.0 * (l.valor - l.valor_m12) / NULLIF(l.valor_m12, 0), 2),
                 'z_mes_ref',         CASE WHEN s.n_meses_com_mov >= 6
                                        THEN round((l.valor - s.media_12m) / NULLIF(s.desvio_12m, 0), 2)
                                      END,
                 'share_pct',         round(100.0 * l.valor / NULLIF(t.valor, 0), 2),
                 'media_12m',         round(COALESCE(s.media_12m, 0), 2),
                 'desvio_12m',        round(COALESCE(s.desvio_12m, 0), 2),
                 'serie',             COALESCE(sd.serie, '[]'::jsonb)
               ) ORDER BY l.valor DESC), '[]'::jsonb) AS departamentos
      FROM lagged l
      LEFT JOIN stats12     s  ON s.departamento_id  IS NOT DISTINCT FROM l.departamento_id
      LEFT JOIN series_dept sd ON sd.departamento_id IS NOT DISTINCT FROM l.departamento_id
      LEFT JOIN tot_ref     t  ON true
      WHERE l.mes = v_mes_ref
    )
    SELECT jsonb_build_object(
      'meta', jsonb_build_object(
        'mes_ref', to_char(v_mes_ref, 'YYYY-MM-DD'),
        'meses',   v_meses),
      'qualidade', (SELECT jsonb_build_object(
        'valor_sem_depto',     round(valor_sem_depto, 2),
        'pct_valor_sem_depto', COALESCE(round(100.0 * valor_sem_depto  / NULLIF(total_ref, 0), 2), 0),
        'pct_baixa_conf',      COALESCE(round(100.0 * valor_baixa_conf / NULLIF(total_ref, 0), 2), 0)
      ) FROM qualidade),
      'totais', COALESCE(
        (SELECT jsonb_build_object(
           'total_mes_ref', round(valor, 2),
           'mom_pct', round(100.0 * (valor - valor_m1)  / NULLIF(valor_m1,  0), 2),
           'yoy_pct', round(100.0 * (valor - valor_m12) / NULLIF(valor_m12, 0), 2),
           'serie', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'mes', to_char(mes, 'YYYY-MM-DD'),
                       'valor', round(valor, 2)) ORDER BY mes), '[]'::jsonb)
                     FROM tot_mensal WHERE mes >= v_serie_ini)
         ) FROM tot_ref),
        jsonb_build_object('total_mes_ref', 0, 'mom_pct', NULL, 'yoy_pct', NULL, 'serie', '[]'::jsonb)),
      'departamentos', (SELECT departamentos FROM dept_json)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despesas_departamentos(int, date, integer[], text, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_despesas_departamentos(int, date, integer[], text, numeric, boolean) TO authenticated;

-- -------------------------------------------------------------------------
-- 2.2  fn_despesas_drill
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_despesas_drill(
  p_nivel text,
  p_mes date,
  p_departamento uuid DEFAULT NULL,
  p_sem_depto boolean DEFAULT false,
  p_plano_contas_id uuid DEFAULT NULL,
  p_fornecedor_codigo text DEFAULT NULL,
  p_empresa_ids integer[] DEFAULT NULL,
  p_natureza text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mes     date;
  v_fim     date;
  v_m1      date;
  v_m12     date;
  v_m12_fim date;
  v_limit   int;
  v_offset  int;
  v_result  jsonb;
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  IF p_nivel NOT IN ('plano', 'fornecedor', 'titulos') THEN
    RAISE EXCEPTION 'p_nivel invalido: % (use plano | fornecedor | titulos)', p_nivel;
  END IF;
  IF p_mes IS NULL THEN
    RAISE EXCEPTION 'p_mes e obrigatorio';
  END IF;

  v_mes     := date_trunc('month', p_mes)::date;
  v_fim     := (v_mes + interval '1 month')::date;
  v_m1      := (v_mes - interval '1 month')::date;
  v_m12     := (v_mes - interval '12 months')::date;
  v_m12_fim := (v_m12 + interval '1 month')::date;
  v_limit   := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
  v_offset  := GREATEST(COALESCE(p_offset, 0), 0);

  IF p_nivel = 'plano' THEN
    WITH base AS (
      SELECT cp.plano_contas_id, cp.plano_contas_nome, cp.valor_original,
             date_trunc('month', cp.data_emissao)::date AS mes
      FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_natureza IS NULL OR cp.natureza_lancamento = p_natureza)
        AND ((p_sem_depto AND cp.departamento_id IS NULL)
          OR (NOT p_sem_depto AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)))
        AND (p_plano_contas_id IS NULL OR cp.plano_contas_id = p_plano_contas_id)
        AND (p_fornecedor_codigo IS NULL OR cp.fornecedor_codigo = p_fornecedor_codigo)
        AND cp.data_emissao IS NOT NULL
        AND (   (cp.data_emissao >= v_mes AND cp.data_emissao < v_fim)
             OR (cp.data_emissao >= v_m1  AND cp.data_emissao < v_mes)
             OR (cp.data_emissao >= v_m12 AND cp.data_emissao < v_m12_fim))
    ),
    agg AS (
      SELECT plano_contas_id,
             COALESCE(max(plano_contas_nome) FILTER (WHERE plano_contas_nome IS NOT NULL),
                      '(sem plano)')                                    AS plano_nome,
             COALESCE(sum(valor_original) FILTER (WHERE mes = v_mes), 0) AS valor_mes,
             count(*)            FILTER (WHERE mes = v_mes)              AS qtd,
             sum(valor_original) FILTER (WHERE mes = v_m1)               AS valor_m1,
             sum(valor_original) FILTER (WHERE mes = v_m12)              AS valor_m12
      FROM base
      GROUP BY plano_contas_id
      HAVING count(*) FILTER (WHERE mes = v_mes) > 0
    ),
    pagina AS (
      SELECT * FROM agg
      ORDER BY valor_mes DESC, plano_nome
      LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                 'plano_contas_id', plano_contas_id,
                 'plano_nome',      plano_nome,
                 'valor_mes',       round(valor_mes, 2),
                 'qtd',             qtd,
                 'mom_pct',         round(100.0 * (valor_mes - valor_m1)  / NULLIF(valor_m1,  0), 2),
                 'yoy_pct',         round(100.0 * (valor_mes - valor_m12) / NULLIF(valor_m12, 0), 2)
               ) ORDER BY valor_mes DESC, plano_nome) FROM pagina), '[]'::jsonb),
      'total_valor', (SELECT COALESCE(round(sum(valor_mes), 2), 0) FROM agg)
    ) INTO v_result;

  ELSIF p_nivel = 'fornecedor' THEN
    WITH base_full AS (
      SELECT cp.fornecedor_codigo, cp.fornecedor_nome, cp.valor_original, cp.data_emissao,
             date_trunc('month', cp.data_emissao)::date AS mes
      FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_natureza IS NULL OR cp.natureza_lancamento = p_natureza)
        AND ((p_sem_depto AND cp.departamento_id IS NULL)
          OR (NOT p_sem_depto AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)))
        AND (p_plano_contas_id IS NULL OR cp.plano_contas_id = p_plano_contas_id)
        AND (p_fornecedor_codigo IS NULL OR cp.fornecedor_codigo = p_fornecedor_codigo)
        AND cp.data_emissao IS NOT NULL
        AND cp.data_emissao < v_fim
        AND cp.fornecedor_codigo IS NOT NULL
    ),
    agg AS (
      SELECT fornecedor_codigo,
             COALESCE(max(fornecedor_nome) FILTER (WHERE fornecedor_nome IS NOT NULL),
                      '(sem nome)')                                      AS fornecedor_nome,
             COALESCE(sum(valor_original) FILTER (WHERE mes = v_mes), 0) AS valor_mes,
             count(*)            FILTER (WHERE mes = v_mes)              AS qtd,
             sum(valor_original) FILTER (WHERE mes = v_m1)               AS valor_m1,
             min(data_emissao)                                           AS primeiro_lancamento
      FROM base_full
      GROUP BY fornecedor_codigo
      HAVING count(*) FILTER (WHERE mes = v_mes) > 0
    ),
    pagina AS (
      SELECT * FROM agg
      ORDER BY valor_mes DESC, fornecedor_nome
      LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                 'fornecedor_codigo',   fornecedor_codigo,
                 'fornecedor_nome',     fornecedor_nome,
                 'valor_mes',           round(valor_mes, 2),
                 'qtd',                 qtd,
                 'mom_pct',             round(100.0 * (valor_mes - valor_m1) / NULLIF(valor_m1, 0), 2),
                 'primeiro_lancamento', to_char(primeiro_lancamento, 'YYYY-MM-DD')
               ) ORDER BY valor_mes DESC, fornecedor_nome) FROM pagina), '[]'::jsonb),
      'total_valor', (SELECT COALESCE(round(sum(valor_mes), 2), 0) FROM agg)
    ) INTO v_result;

  ELSE  -- 'titulos'
    WITH base AS (
      SELECT cp.id, cp.erp_id, cp.fornecedor_nome, cp.valor_original,
             cp.data_emissao, cp.data_vencimento, cp.data_pagamento,
             cp.status, cp.natureza_lancamento, cp.numero_documento, cp.parcela
      FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_natureza IS NULL OR cp.natureza_lancamento = p_natureza)
        AND ((p_sem_depto AND cp.departamento_id IS NULL)
          OR (NOT p_sem_depto AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)))
        AND (p_plano_contas_id IS NULL OR cp.plano_contas_id = p_plano_contas_id)
        AND (p_fornecedor_codigo IS NULL OR cp.fornecedor_codigo = p_fornecedor_codigo)
        AND cp.data_emissao >= v_mes
        AND cp.data_emissao <  v_fim
    ),
    pagina AS (
      SELECT * FROM base
      ORDER BY valor_original DESC, data_emissao, id
      LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                 'id',                  id,
                 'erp_id',              erp_id,
                 'fornecedor_nome',     fornecedor_nome,
                 'valor_original',      round(valor_original, 2),
                 'data_emissao',        to_char(data_emissao,   'YYYY-MM-DD'),
                 'data_vencimento',     to_char(data_vencimento,'YYYY-MM-DD'),
                 'data_pagamento',      to_char(data_pagamento, 'YYYY-MM-DD'),
                 'status',              status,
                 'natureza_lancamento', natureza_lancamento,
                 'numero_documento',    numero_documento,
                 'parcela',             parcela
               ) ORDER BY valor_original DESC, data_emissao, id) FROM pagina), '[]'::jsonb),
      'total_qtd',   (SELECT count(*) FROM base),
      'total_valor', (SELECT COALESCE(round(sum(valor_original), 2), 0) FROM base)
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despesas_drill(text, date, uuid, boolean, uuid, text, integer[], text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_despesas_drill(text, date, uuid, boolean, uuid, text, integer[], text, int, int) TO authenticated;

-- -------------------------------------------------------------------------
-- 2.3  fn_despesas_variacoes
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_despesas_variacoes(
  p_mes date DEFAULT NULL,
  p_empresa_ids integer[] DEFAULT NULL,
  p_natureza text DEFAULT NULL,
  p_min_valor numeric DEFAULT 5000,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mes    date;
  v_fim    date;
  v_m1     date;
  v_m12    date;
  v_m6_ini date;
  v_limit  int;
  v_min    numeric;
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  v_mes    := COALESCE(date_trunc('month', p_mes)::date,
                       date_trunc('month', current_date)::date);
  v_fim    := (v_mes + interval '1 month')::date;
  v_m1     := (v_mes - interval '1 month')::date;
  v_m12    := (v_mes - interval '12 months')::date;
  v_m6_ini := (v_mes - interval '6 months')::date;
  v_limit  := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_min    := GREATEST(COALESCE(p_min_valor, 5000), 0);

  RETURN (
    WITH base_full AS (
      SELECT cp.id, cp.empresa_id, cp.departamento_id, cp.departamento_nome,
             cp.plano_contas_id, cp.plano_contas_nome,
             cp.fornecedor_codigo, cp.fornecedor_nome,
             cp.numero_documento, cp.parcela, cp.erp_id,
             cp.valor_original, cp.data_emissao,
             date_trunc('month', cp.data_emissao)::date AS mes
      FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_natureza IS NULL OR cp.natureza_lancamento = p_natureza)
        AND cp.data_emissao IS NOT NULL
        AND cp.data_emissao < v_fim
    ),
    base_12m AS (
      SELECT * FROM base_full WHERE mes >= v_m12
    ),
    mensal AS (
      SELECT departamento_id, plano_contas_id, fornecedor_codigo, mes,
             max(departamento_nome) AS departamento_nome,
             max(plano_contas_nome) AS plano_nome,
             max(fornecedor_nome)   AS fornecedor_nome,
             sum(valor_original)    AS valor
      FROM base_12m
      GROUP BY 1, 2, 3, 4
    ),
    grain AS (
      SELECT departamento_id, plano_contas_id, fornecedor_codigo,
             max(departamento_nome) AS departamento_nome,
             max(plano_nome)        AS plano_nome,
             COALESCE(max(fornecedor_nome), '(sem nome)') AS fornecedor_nome,
             COALESCE(sum(valor) FILTER (WHERE mes = v_mes), 0)  AS valor_mes,
             sum(valor) FILTER (WHERE mes = v_m1)                AS valor_m1,
             sum(valor) FILTER (WHERE mes = v_m12)               AS valor_m12,
             COALESCE(sum(valor)         FILTER (WHERE mes >= v_m6_ini AND mes < v_mes), 0) AS s1_6m,
             COALESCE(sum(valor * valor) FILTER (WHERE mes >= v_m6_ini AND mes < v_mes), 0) AS s2_6m
      FROM mensal
      GROUP BY 1, 2, 3
    ),
    dept_tot AS (
      SELECT departamento_id, sum(valor) AS total_depto
      FROM mensal WHERE mes = v_mes GROUP BY 1
    ),
    ids_mes AS (
      SELECT departamento_id, plano_contas_id, fornecedor_codigo,
             (array_agg(id ORDER BY valor_original DESC))[1:50] AS conta_ids
      FROM base_12m WHERE mes = v_mes
      GROUP BY 1, 2, 3
    ),
    candidatos AS (
      SELECT g.*,
             g.valor_mes - COALESCE(g.valor_m1, 0) AS delta,
             round(100.0 * (g.valor_mes - g.valor_m1)  / NULLIF(g.valor_m1,  0), 2) AS mom_pct,
             round(100.0 * (g.valor_mes - g.valor_m12) / NULLIF(g.valor_m12, 0), 2) AS yoy_pct,
             round(g.s1_6m / 6.0, 2) AS media_6m,
             round((g.valor_mes - g.s1_6m / 6.0)
               / NULLIF(sqrt(GREATEST((g.s2_6m - (g.s1_6m * g.s1_6m) / 6.0) / 5.0, 0)), 0), 2) AS z_6m,
             COALESCE(round(100.0 * g.valor_mes / NULLIF(dt.total_depto, 0), 2), 0) AS share_depto_pct,
             COALESCE(i.conta_ids, '{}'::uuid[]) AS conta_ids
      FROM grain g
      LEFT JOIN dept_tot dt ON dt.departamento_id IS NOT DISTINCT FROM g.departamento_id
      LEFT JOIN ids_mes  i  ON i.departamento_id   IS NOT DISTINCT FROM g.departamento_id
                           AND i.plano_contas_id   IS NOT DISTINCT FROM g.plano_contas_id
                           AND i.fornecedor_codigo IS NOT DISTINCT FROM g.fornecedor_codigo
      WHERE GREATEST(g.valor_mes, COALESCE(g.valor_m1, 0)) >= v_min
        AND g.fornecedor_codigo IS NOT NULL
    ),
    altas  AS (SELECT * FROM candidatos WHERE delta > 0 ORDER BY delta DESC LIMIT v_limit),
    quedas AS (SELECT * FROM candidatos WHERE delta < 0 ORDER BY delta ASC  LIMIT v_limit),
    novos AS (
      SELECT fornecedor_codigo,
             max(fornecedor_nome) AS fornecedor_nome,
             min(data_emissao)    AS primeiro_lancamento,
             sum(valor_original)  AS valor_acumulado,
             count(*)             AS qtd,
             (array_agg(id ORDER BY valor_original DESC))[1:50] AS conta_ids
      FROM base_full
      WHERE fornecedor_codigo IS NOT NULL
      GROUP BY fornecedor_codigo
      HAVING min(data_emissao) >= (v_fim - 90)
         AND sum(valor_original) >= v_min
      ORDER BY valor_acumulado DESC
      LIMIT v_limit
    ),
    dup_universo AS (
      SELECT * FROM base_full
      WHERE data_emissao >= (v_mes - 7)
        AND data_emissao <  v_fim
        AND fornecedor_codigo IS NOT NULL
        AND valor_original >= v_min
    ),
    dup_pares AS (
      SELECT a.fornecedor_codigo,
             COALESCE(a.fornecedor_nome, b.fornecedor_nome)  AS fornecedor_nome,
             GREATEST(a.valor_original, b.valor_original)    AS valor,
             a.data_emissao AS data_a, b.data_emissao AS data_b,
             a.erp_id AS erp_a, b.erp_id AS erp_b,
             a.id AS id_a, b.id AS id_b
      FROM dup_universo a
      JOIN dup_universo b
        ON b.fornecedor_codigo = a.fornecedor_codigo
       AND b.empresa_id        = a.empresa_id
       AND b.id > a.id
       AND b.erp_id IS DISTINCT FROM a.erp_id
       AND abs(b.data_emissao - a.data_emissao) <= 7
       AND abs(b.valor_original - a.valor_original)
             <= 0.01 * GREATEST(a.valor_original, b.valor_original)
       AND NOT (b.numero_documento IS NOT DISTINCT FROM a.numero_documento
                AND b.parcela IS DISTINCT FROM a.parcela)
      WHERE date_trunc('month', a.data_emissao)::date = v_mes
         OR date_trunc('month', b.data_emissao)::date = v_mes
      ORDER BY GREATEST(a.valor_original, b.valor_original) DESC
      LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'mes_ref', to_char(v_mes, 'YYYY-MM-DD'),
      'top_altas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'departamento_id',   departamento_id,
          'departamento_nome', COALESCE(departamento_nome, '(sem classificação)'),
          'plano_contas_id',   plano_contas_id,
          'plano_nome',        COALESCE(plano_nome, '(sem plano)'),
          'fornecedor_codigo', fornecedor_codigo,
          'fornecedor_nome',   fornecedor_nome,
          'valor_mes',         round(valor_mes, 2),
          'mom_pct',           mom_pct,
          'yoy_pct',           yoy_pct,
          'media_6m',          media_6m,
          'z_6m',              z_6m,
          'share_depto_pct',   share_depto_pct,
          'conta_ids',         to_jsonb(conta_ids)
        ) ORDER BY delta DESC) FROM altas), '[]'::jsonb),
      'top_quedas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'departamento_id',   departamento_id,
          'departamento_nome', COALESCE(departamento_nome, '(sem classificação)'),
          'plano_contas_id',   plano_contas_id,
          'plano_nome',        COALESCE(plano_nome, '(sem plano)'),
          'fornecedor_codigo', fornecedor_codigo,
          'fornecedor_nome',   fornecedor_nome,
          'valor_mes',         round(valor_mes, 2),
          'mom_pct',           mom_pct,
          'yoy_pct',           yoy_pct,
          'media_6m',          media_6m,
          'z_6m',              z_6m,
          'share_depto_pct',   share_depto_pct,
          'conta_ids',         to_jsonb(conta_ids)
        ) ORDER BY delta ASC) FROM quedas), '[]'::jsonb),
      'novos_fornecedores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'fornecedor_codigo',   fornecedor_codigo,
          'fornecedor_nome',     fornecedor_nome,
          'primeiro_lancamento', to_char(primeiro_lancamento, 'YYYY-MM-DD'),
          'valor_acumulado',     round(valor_acumulado, 2),
          'qtd',                 qtd,
          'conta_ids',           to_jsonb(conta_ids)
        ) ORDER BY valor_acumulado DESC) FROM novos), '[]'::jsonb),
      'duplicidades_mes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'fornecedor_codigo', fornecedor_codigo,
          'fornecedor_nome',   fornecedor_nome,
          'valor',             round(valor, 2),
          'datas',             jsonb_build_array(to_char(LEAST(data_a, data_b), 'YYYY-MM-DD'),
                                                 to_char(GREATEST(data_a, data_b), 'YYYY-MM-DD')),
          'erp_ids',           jsonb_build_array(erp_a, erp_b),
          'conta_ids',         jsonb_build_array(id_a, id_b)
        ) ORDER BY valor DESC) FROM dup_pares), '[]'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despesas_variacoes(date, integer[], text, numeric, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_despesas_variacoes(date, integer[], text, numeric, int) TO authenticated;

-- -------------------------------------------------------------------------
-- 3. Índices em contas_pagar
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cp_emissao_ativos
  ON public.contas_pagar (data_emissao)
  WHERE status <> 'cancelado';

CREATE INDEX IF NOT EXISTS idx_cp_dept_emissao
  ON public.contas_pagar (departamento_id, data_emissao);

CREATE INDEX IF NOT EXISTS idx_cp_forn_emissao
  ON public.contas_pagar (fornecedor_codigo, data_emissao);

-- -------------------------------------------------------------------------
-- 4. Tela financeiro_torre_despesas + grants propagados
-- -------------------------------------------------------------------------
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, modulo_codigo, icone, ativo, ordem, acesso_padrao)
VALUES ('financeiro_torre_despesas',
        'Torre de Despesas',
        'Torre de Controle de Despesas — MoM/YoY por departamento, drill e variações do mês',
        '/dashboard/financeiro/torre-despesas',
        'financeiro', 'Radar', true, 12, false)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, rota = EXCLUDED.rota,
      modulo_codigo = EXCLUDED.modulo_codigo, ativo = true;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, t.id
FROM public.telas_sistema t WHERE t.codigo = 'financeiro_torre_despesas'
ON CONFLICT (role, tela_id) DO NOTHING;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT rpm.role, t.id
FROM public.role_permissoes_modulos rpm
JOIN public.modulos_sistema ms ON ms.id = rpm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas') t
ON CONFLICT (role, tela_id) DO NOTHING;

INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
SELECT upm.usuario_id, t.id
FROM public.usuario_permissoes_modulos upm
JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas') t
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuario_permissoes_telas x
  WHERE x.usuario_id = upm.usuario_id AND x.tela_id = t.id
);

INSERT INTO public.departamento_permissoes_telas (departamento_id, tela_id)
SELECT dpm.departamento_id, t.id
FROM public.departamento_permissoes_modulos dpm
JOIN public.modulos_sistema ms ON ms.id = dpm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas') t
WHERE NOT EXISTS (
  SELECT 1 FROM public.departamento_permissoes_telas x
  WHERE x.departamento_id = dpm.departamento_id AND x.tela_id = t.id
);