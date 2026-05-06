
-- Index helper for vinculos
CREATE INDEX IF NOT EXISTS idx_civ_china_oc_op
  ON public.compras_internacional_vinculos (china_ordem_compra_id, fabrica_op_id);

-- View consolidada de KPIs de recebimento por OC
CREATE OR REPLACE VIEW public.vw_china_oc_recebimento_kpis AS
SELECT
  oc.id                                AS ordem_compra_id,
  oc.numero_oc,
  oc.submissao_id,
  oc.produto_codigo,
  oc.produto_nome,
  oc.status                            AS oc_status,
  oc.data_emissao,
  oc.data_entrega_prevista,
  oc.data_entrega_real,
  COALESCE(SUM(oi.qty_pedida), 0)::int      AS qty_pedida,
  COALESCE(SUM(oi.qty_produzida), 0)::int   AS qty_produzida,
  COALESCE(SUM(oi.qty_embarcada), 0)::int   AS qty_embarcada,
  COALESCE(SUM(oi.qty_recebida), 0)::int    AS qty_recebida,
  COALESCE(SUM(oi.qty_cancelada), 0)::int   AS qty_cancelada,
  COALESCE(SUM(ri.qty_avariada), 0)::int    AS qty_avariada,
  COALESCE(SUM(ri.qty_faltante), 0)::int    AS qty_faltante,
  GREATEST(
    COALESCE(SUM(oi.qty_pedida), 0)
    - COALESCE(SUM(oi.qty_recebida), 0)
    - COALESCE(SUM(oi.qty_cancelada), 0)
  , 0)::int                                  AS saldo_aberto,
  MIN(rc.data_chegada_porto)                 AS data_chegada_porto,
  MAX(rc.data_desembaraco)                   AS data_desembaraco,
  MAX(rc.data_recebimento_cd)                AS data_recebimento_cd,
  CASE
    WHEN MAX(rc.data_recebimento_cd) IS NOT NULL
     AND MIN(rc.data_chegada_porto) IS NOT NULL
    THEN (MAX(rc.data_recebimento_cd) - MIN(rc.data_chegada_porto))
  END                                        AS sla_porto_cd_dias
FROM public.china_ordens_compra oc
LEFT JOIN public.china_ordem_itens          oi ON oi.ordem_compra_id = oc.id
LEFT JOIN public.china_recebimentos_carga   rc ON rc.ordem_compra_id = oc.id
LEFT JOIN public.china_recebimento_itens    ri ON ri.recebimento_id  = rc.id
GROUP BY oc.id;

GRANT SELECT ON public.vw_china_oc_recebimento_kpis TO authenticated;

-- ===== RPC: gerar OP a partir de OC =====
CREATE OR REPLACE FUNCTION public.rpc_gerar_op_da_oc_china(
  p_oc_id           uuid,
  p_produto_id      uuid,
  p_qty             numeric,
  p_formula_id      uuid DEFAULT NULL,
  p_lote            text DEFAULT NULL,
  p_data_prevista   date DEFAULT NULL,
  p_maquina_id      uuid DEFAULT NULL,
  p_responsavel_id  uuid DEFAULT NULL,
  p_obs             text DEFAULT NULL
)
RETURNS TABLE(op_id uuid, numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_numero    text;
  v_op_id     uuid;
  v_oc        public.china_ordens_compra%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  IF NOT (
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'supervisor'::app_role)
    OR public.check_user_access(v_uid, 'fabrica')
    OR public.check_user_access(v_uid, 'china')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para gerar OP';
  END IF;

  SELECT * INTO v_oc FROM public.china_ordens_compra WHERE id = p_oc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC nao encontrada'; END IF;

  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade invalida';
  END IF;

  IF p_produto_id IS NULL THEN
    RAISE EXCEPTION 'Produto Brasil obrigatorio';
  END IF;

  v_numero := 'OP-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYYMM') || '-' ||
              lpad((
                SELECT COALESCE(MAX(
                  NULLIF(regexp_replace(numero, '^OP-\d{6}-', ''), '')::int
                ), 0) + 1
                FROM public.fabrica_ordens_producao
                WHERE numero LIKE 'OP-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYYMM') || '-%'
              )::text, 4, '0');

  INSERT INTO public.fabrica_ordens_producao (
    numero, produto_id, formula_id, quantidade_planejada,
    status, data_prevista, lote, maquina_id,
    operador_principal_id, responsavel_id, observacoes, created_by
  ) VALUES (
    v_numero, p_produto_id, p_formula_id, p_qty,
    'pendente', p_data_prevista, p_lote, p_maquina_id,
    NULL, p_responsavel_id, p_obs, v_uid
  )
  RETURNING id INTO v_op_id;

  INSERT INTO public.compras_internacional_vinculos (
    china_ordem_compra_id, fabrica_op_id, qty_alocada, observacoes, created_by
  ) VALUES (
    p_oc_id, v_op_id, p_qty, p_obs, v_uid
  );

  INSERT INTO public.produto_doc_audit_log (
    acao, user_id, user_name, detalhes
  ) VALUES (
    'op_gerada', v_uid,
    COALESCE((SELECT nome FROM public.profiles WHERE id = v_uid), 'Usuario'),
    jsonb_build_object(
      'numero_oc', v_oc.numero_oc,
      'oc_id', p_oc_id,
      'op_id', v_op_id,
      'numero_op', v_numero,
      'qty', p_qty,
      'lote', p_lote
    )
  );

  RETURN QUERY SELECT v_op_id, v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_gerar_op_da_oc_china(uuid,uuid,numeric,uuid,text,date,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_op_da_oc_china(uuid,uuid,numeric,uuid,text,date,uuid,uuid,text) TO authenticated;

-- ===== RPC: vincular OP existente a OC =====
CREATE OR REPLACE FUNCTION public.rpc_vincular_op_existente(
  p_oc_id     uuid,
  p_op_id     uuid,
  p_qty       numeric DEFAULT NULL,
  p_obs       text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_qty numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  IF NOT (
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'supervisor'::app_role)
    OR public.check_user_access(v_uid, 'fabrica')
    OR public.check_user_access(v_uid, 'china')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para vincular OP';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.china_ordens_compra      WHERE id = p_oc_id) THEN RAISE EXCEPTION 'OC nao encontrada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fabrica_ordens_producao  WHERE id = p_op_id) THEN RAISE EXCEPTION 'OP nao encontrada'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.compras_internacional_vinculos
    WHERE china_ordem_compra_id = p_oc_id AND fabrica_op_id = p_op_id
  ) THEN
    RAISE EXCEPTION 'Vinculo ja existe';
  END IF;

  v_qty := COALESCE(
    p_qty,
    (SELECT quantidade_planejada FROM public.fabrica_ordens_producao WHERE id = p_op_id)
  );

  INSERT INTO public.compras_internacional_vinculos (
    china_ordem_compra_id, fabrica_op_id, qty_alocada, observacoes, created_by
  ) VALUES (p_oc_id, p_op_id, v_qty, p_obs, v_uid)
  RETURNING id INTO v_id;

  INSERT INTO public.produto_doc_audit_log (acao, user_id, user_name, detalhes)
  VALUES (
    'op_vinculada', v_uid,
    COALESCE((SELECT nome FROM public.profiles WHERE id = v_uid), 'Usuario'),
    jsonb_build_object('oc_id', p_oc_id, 'op_id', p_op_id, 'qty', v_qty)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vincular_op_existente(uuid,uuid,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_op_existente(uuid,uuid,numeric,text) TO authenticated;

-- ===== RPC: desvincular OP de OC =====
CREATE OR REPLACE FUNCTION public.rpc_desvincular_op_da_oc(
  p_vinculo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_v   public.compras_internacional_vinculos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  IF NOT (
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'supervisor'::app_role)
    OR public.check_user_access(v_uid, 'fabrica')
    OR public.check_user_access(v_uid, 'china')
  ) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  SELECT * INTO v_v FROM public.compras_internacional_vinculos WHERE id = p_vinculo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vinculo nao encontrado'; END IF;

  DELETE FROM public.compras_internacional_vinculos WHERE id = p_vinculo_id;

  INSERT INTO public.produto_doc_audit_log (acao, user_id, user_name, detalhes)
  VALUES (
    'op_desvinculada', v_uid,
    COALESCE((SELECT nome FROM public.profiles WHERE id = v_uid), 'Usuario'),
    jsonb_build_object('oc_id', v_v.china_ordem_compra_id, 'op_id', v_v.fabrica_op_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_desvincular_op_da_oc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_desvincular_op_da_oc(uuid) TO authenticated;
