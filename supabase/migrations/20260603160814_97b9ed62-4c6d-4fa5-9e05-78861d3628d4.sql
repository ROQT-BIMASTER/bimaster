CREATE OR REPLACE FUNCTION public.estoque_valores_por_filial(filtros jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE (
  empresa_par int, abrev_par text, valor_total numeric, unidades_total numeric,
  total_registros bigint, skus_ativos bigint, skus_sem_saldo bigint, skus_negativos bigint,
  pedidos_pendentes_qtd numeric, skus_com_pendente bigint, ultima_sync timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := has_role(v_user,'admin'::app_role) OR has_role(v_user,'gerente'::app_role);
  v_empresas int[]  := COALESCE((SELECT array_agg(c::int) FROM jsonb_array_elements_text(filtros->'empresa_ids') c), ARRAY[]::int[]);
  v_linhas text[]   := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'linhas') c), ARRAY[]::text[]);
  v_ums text[]      := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'unidades') c), ARRAY[]::text[]);
  v_curvas_fis text[] := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'curvas_fisicas') c), ARRAY[]::text[]);
  v_curvas_mon text[] := COALESCE((SELECT array_agg(c) FROM jsonb_array_elements_text(filtros->'curvas_monetarias') c), ARRAY[]::text[]);
  v_busca text := NULLIF(filtros->>'busca','');
  v_apenas_saldo boolean := COALESCE((filtros->>'apenas_com_saldo')::boolean,false);
  v_com_pendente boolean := COALESCE((filtros->>'com_pedido_pendente')::boolean,false);
  v_saldo_min numeric := NULLIF(filtros->>'saldo_min','')::numeric;
  v_saldo_max numeric := NULLIF(filtros->>'saldo_max','')::numeric;
  v_valor_min numeric := NULLIF(filtros->>'valor_min','')::numeric;
  v_valor_max numeric := NULLIF(filtros->>'valor_max','')::numeric;
  v_ult_compra_dias int := NULLIF(filtros->>'ultima_compra_dias','')::int;
  v_sem_compra boolean := COALESCE((filtros->>'sem_compra')::boolean,false);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT e.* FROM public.erp_estoque_distribuidora e
    WHERE (v_is_admin OR e.empresa_par IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = v_user))
      AND (cardinality(v_empresas)=0 OR e.empresa_par = ANY(v_empresas))
      AND (cardinality(v_linhas)=0 OR e.nome_linha = ANY(v_linhas))
      AND (cardinality(v_ums)=0 OR e.unidade_medida = ANY(v_ums))
      AND (cardinality(v_curvas_fis)=0 OR e.curva_fisica = ANY(v_curvas_fis))
      AND (cardinality(v_curvas_mon)=0 OR e.curva_monetaria = ANY(v_curvas_mon))
      AND (v_busca IS NULL OR e.nome_prod ILIKE '%'||v_busca||'%' OR e.cod_fabricante ILIKE '%'||v_busca||'%' OR e.cod_produto::text = v_busca)
      AND (NOT v_apenas_saldo OR e.saldo > 0)
      AND (NOT v_com_pendente OR e.pedido_pendente > 0)
      AND (v_saldo_min IS NULL OR e.saldo >= v_saldo_min)
      AND (v_saldo_max IS NULL OR e.saldo <= v_saldo_max)
      AND (v_valor_min IS NULL OR e.custo_total >= v_valor_min)
      AND (v_valor_max IS NULL OR e.custo_total <= v_valor_max)
      AND (v_ult_compra_dias IS NULL OR e.data_ultima_compra >= (CURRENT_DATE - v_ult_compra_dias))
      AND (NOT v_sem_compra OR e.data_ultima_compra IS NULL OR e.data_ultima_compra < (CURRENT_DATE - 180))
  )
  SELECT b.empresa_par,
         MAX(b.abrev_par),
         COALESCE(SUM(b.custo_total),0)::numeric,
         COALESCE(SUM(b.saldo),0)::numeric,
         COUNT(*)::bigint,
         COUNT(*) FILTER (WHERE b.saldo > 0)::bigint,
         COUNT(*) FILTER (WHERE b.saldo = 0)::bigint,
         COUNT(*) FILTER (WHERE b.saldo < 0)::bigint,
         COALESCE(SUM(b.pedido_pendente),0)::numeric,
         COUNT(*) FILTER (WHERE b.pedido_pendente > 0)::bigint,
         MAX(b.sincronizado_em)
  FROM base b GROUP BY b.empresa_par ORDER BY 3 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.estoque_valores_por_filial(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estoque_valores_por_filial(jsonb) TO authenticated;