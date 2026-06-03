CREATE INDEX IF NOT EXISTS idx_erp_estoque_empresa_validade
  ON public.erp_estoque_distribuidora (empresa_par, validade);

CREATE OR REPLACE FUNCTION public.estoque_kpis_recorte(filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := has_role(v_user, 'admin'::app_role) OR has_role(v_user, 'gerente'::app_role);
  v_empresas int[] := COALESCE((SELECT array_agg(c::int) FROM jsonb_array_elements_text(filtros->'empresa_ids') c), ARRAY[]::int[]);
  v_linhas text[] := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'linhas') c), ARRAY[]::text[]);
  v_ums text[] := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'unidades') c), ARRAY[]::text[]);
  v_curvas_fis text[] := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'curvas_fisicas') c), ARRAY[]::text[]);
  v_curvas_mon text[] := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'curvas_monetarias') c), ARRAY[]::text[]);
  v_busca text := NULLIF(filtros->>'busca', '');
  v_apenas_saldo boolean := COALESCE((filtros->>'apenas_com_saldo')::boolean, false);
  v_com_pendente boolean := COALESCE((filtros->>'com_pedido_pendente')::boolean, false);
  v_saldo_min numeric := NULLIF(filtros->>'saldo_min','')::numeric;
  v_saldo_max numeric := NULLIF(filtros->>'saldo_max','')::numeric;
  v_valor_min numeric := NULLIF(filtros->>'valor_min','')::numeric;
  v_valor_max numeric := NULLIF(filtros->>'valor_max','')::numeric;
  v_ult_compra_dias int := NULLIF(filtros->>'ultima_compra_dias','')::int;
  v_sem_compra boolean := COALESCE((filtros->>'sem_compra')::boolean, false);
  v_validade_dias int := NULLIF(filtros->>'validade_dias','')::int;
  v_vencidos boolean := COALESCE((filtros->>'vencidos')::boolean, false);
  v_resultado jsonb;
BEGIN
  WITH base AS (
    SELECT *
    FROM public.erp_estoque_distribuidora e
    WHERE
      (v_is_admin OR e.empresa_par IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = v_user))
      AND (cardinality(v_empresas) = 0 OR e.empresa_par = ANY(v_empresas))
      AND (cardinality(v_linhas) = 0 OR e.nome_linha = ANY(v_linhas))
      AND (cardinality(v_ums) = 0 OR e.unidade_medida = ANY(v_ums))
      AND (cardinality(v_curvas_fis) = 0 OR e.curva_fisica = ANY(v_curvas_fis))
      AND (cardinality(v_curvas_mon) = 0 OR e.curva_monetaria = ANY(v_curvas_mon))
      AND (v_busca IS NULL OR e.nome_prod ILIKE '%'||v_busca||'%' OR e.cod_fabricante ILIKE '%'||v_busca||'%' OR e.cod_produto::text = v_busca)
      AND (NOT v_apenas_saldo OR e.saldo > 0)
      AND (NOT v_com_pendente OR e.pedido_pendente > 0)
      AND (v_saldo_min IS NULL OR e.saldo >= v_saldo_min)
      AND (v_saldo_max IS NULL OR e.saldo <= v_saldo_max)
      AND (v_valor_min IS NULL OR e.custo_total >= v_valor_min)
      AND (v_valor_max IS NULL OR e.custo_total <= v_valor_max)
      AND (v_ult_compra_dias IS NULL OR e.data_ultima_compra >= (CURRENT_DATE - v_ult_compra_dias))
      AND (NOT v_sem_compra OR e.data_ultima_compra IS NULL OR e.data_ultima_compra < (CURRENT_DATE - 180))
      AND (
        CASE
          WHEN v_vencidos THEN e.validade < CURRENT_DATE
          WHEN v_validade_dias IS NOT NULL THEN e.validade >= CURRENT_DATE AND e.validade <= (CURRENT_DATE + v_validade_dias)
          ELSE true
        END
      )
  )
  SELECT jsonb_build_object(
    'total_registros', COUNT(*),
    'valor_total', COALESCE(SUM(custo_total), 0),
    'unidades_total', COALESCE(SUM(saldo), 0),
    'skus_ativos', COUNT(*) FILTER (WHERE saldo > 0),
    'skus_sem_saldo', COUNT(*) FILTER (WHERE saldo = 0),
    'skus_negativos', COUNT(*) FILTER (WHERE saldo < 0),
    'pedidos_pendentes_qtd', COALESCE(SUM(pedido_pendente), 0),
    'skus_com_pendente', COUNT(*) FILTER (WHERE pedido_pendente > 0),
    'ultima_sync', MAX(sincronizado_em),
    'empresas_no_recorte', COUNT(DISTINCT empresa_par),
    'linhas_no_recorte', COUNT(DISTINCT nome_linha)
  ) INTO v_resultado
  FROM base;

  RETURN v_resultado;
END;
$$;