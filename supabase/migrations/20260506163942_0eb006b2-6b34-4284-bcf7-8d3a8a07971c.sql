
-- 1) Tornar OC opcional em china_embarques (consolidação multi-OC)
ALTER TABLE public.china_embarques
  ALTER COLUMN ordem_compra_id DROP NOT NULL;

-- 2) Adicionar vínculo a OP da fábrica em china_embarque_itens
ALTER TABLE public.china_embarque_itens
  ALTER COLUMN ordem_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS ordem_producao_id uuid REFERENCES public.fabrica_ordens_producao(id) ON DELETE RESTRICT,
  ADD CONSTRAINT china_embarque_itens_origem_chk
    CHECK (ordem_item_id IS NOT NULL OR ordem_producao_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_china_embarque_itens_op
  ON public.china_embarque_itens(ordem_producao_id);

-- 3) View: OPs prontas para embarque
CREATE OR REPLACE VIEW public.vw_op_pronto_embarque AS
WITH alocado AS (
  SELECT ordem_producao_id, COALESCE(SUM(qty_embarcada),0)::numeric AS qty_alocada
  FROM public.china_embarque_itens
  WHERE ordem_producao_id IS NOT NULL
  GROUP BY ordem_producao_id
),
oc_link AS (
  SELECT DISTINCT ON (fabrica_op_id)
    fabrica_op_id, china_ordem_compra_id
  FROM public.compras_internacional_vinculos
  WHERE fabrica_op_id IS NOT NULL
  ORDER BY fabrica_op_id, created_at DESC
)
SELECT
  op.id                     AS ordem_producao_id,
  op.numero                 AS op_numero,
  op.produto_id,
  op.status                 AS op_status,
  op.quantidade_planejada,
  COALESCE(op.quantidade_produzida,0) AS quantidade_produzida,
  COALESCE(a.qty_alocada,0)           AS qty_alocada,
  GREATEST(
    COALESCE(op.quantidade_produzida,0) - COALESCE(a.qty_alocada,0),
    0
  )                          AS qty_disponivel,
  op.lote,
  op.data_fim,
  GREATEST(
    EXTRACT(DAY FROM (now() - COALESCE(op.data_fim, op.updated_at)))::int,
    0
  )                          AS dias_parado,
  oc.china_ordem_compra_id  AS ordem_compra_id,
  fp.nome                    AS produto_nome,
  fp.codigo                  AS produto_codigo
FROM public.fabrica_ordens_producao op
LEFT JOIN alocado a ON a.ordem_producao_id = op.id
LEFT JOIN oc_link oc ON oc.fabrica_op_id = op.id
LEFT JOIN public.fabrica_produtos fp ON fp.id = op.produto_id
WHERE COALESCE(op.quantidade_produzida,0) > 0
  AND COALESCE(op.quantidade_produzida,0) > COALESCE(a.qty_alocada,0);

-- 4) View: container consolidado
CREATE OR REPLACE VIEW public.vw_container_consolidado AS
SELECT
  e.id AS embarque_id,
  e.numero_embarque,
  e.numero_container,
  e.numero_bl,
  e.booking_number,
  e.navio,
  e.porto_origem,
  e.porto_destino,
  e.data_embarque,
  e.data_eta,
  e.status,
  e.tipo_embarque,
  COALESCE(SUM(ei.qty_embarcada),0)::int AS total_pecas,
  COUNT(DISTINCT ei.ordem_producao_id) FILTER (WHERE ei.ordem_producao_id IS NOT NULL)::int AS qtd_ops,
  (
    SELECT COUNT(DISTINCT oc_id) FROM (
      SELECT DISTINCT oi.ordem_compra_id AS oc_id
        FROM public.china_embarque_itens ei2
        JOIN public.china_ordem_itens oi ON oi.id = ei2.ordem_item_id
        WHERE ei2.embarque_id = e.id
      UNION
      SELECT DISTINCT civ.china_ordem_compra_id AS oc_id
        FROM public.china_embarque_itens ei3
        JOIN public.compras_internacional_vinculos civ ON civ.fabrica_op_id = ei3.ordem_producao_id
        WHERE ei3.embarque_id = e.id
    ) sub
  )::int AS qtd_ocs,
  ss.status AS shipsgo_status,
  ss.eta_atual AS shipsgo_eta_atual,
  ss.dias_atraso AS shipsgo_dias_atraso,
  ss.last_event_at AS shipsgo_last_event_at
FROM public.china_embarques e
LEFT JOIN public.china_embarque_itens ei ON ei.embarque_id = e.id
LEFT JOIN public.shipsgo_shipments ss ON ss.embarque_id = e.id
GROUP BY e.id, ss.status, ss.eta_atual, ss.dias_atraso, ss.last_event_at;

-- 5) RPC: alocar OP em container existente
CREATE OR REPLACE FUNCTION public.rpc_alocar_op_em_container(
  p_embarque_id uuid,
  p_op_id uuid,
  p_qty integer,
  p_lote text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disp numeric;
  v_id uuid;
  v_uid uuid := auth.uid();
  v_uname text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT (
    check_user_access(v_uid,'china') OR check_user_access(v_uid,'fabrica')
    OR has_role(v_uid,'admin') OR has_role(v_uid,'supervisor')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'qty must be > 0';
  END IF;

  SELECT qty_disponivel INTO v_disp
  FROM public.vw_op_pronto_embarque WHERE ordem_producao_id = p_op_id;

  IF v_disp IS NULL OR v_disp < p_qty THEN
    RAISE EXCEPTION 'qty exceeds available (%, requested %)', COALESCE(v_disp,0), p_qty;
  END IF;

  INSERT INTO public.china_embarque_itens(embarque_id, ordem_producao_id, qty_embarcada, lote, observacao)
  VALUES (p_embarque_id, p_op_id, p_qty, p_lote, p_observacao)
  RETURNING id INTO v_id;

  SELECT COALESCE(full_name, email) INTO v_uname FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.produto_doc_audit_log(acao, user_id, user_name, detalhes)
  VALUES (
    'alocacao_container', v_uid, v_uname,
    jsonb_build_object('embarque_id', p_embarque_id, 'op_id', p_op_id, 'qty', p_qty, 'lote', p_lote)
  );

  RETURN v_id;
END;$$;

-- 6) RPC: criar container consolidado
CREATE OR REPLACE FUNCTION public.rpc_criar_container_consolidado(
  p_payload jsonb,
  p_itens jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_uname text;
  v_emb_id uuid;
  v_item jsonb;
  v_op_id uuid;
  v_qty int;
  v_disp numeric;
  v_oc uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (
    check_user_access(v_uid,'china') OR check_user_access(v_uid,'fabrica')
    OR has_role(v_uid,'admin') OR has_role(v_uid,'supervisor')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_oc := NULLIF(p_payload->>'ordem_compra_id','')::uuid;

  -- OC obrigatória pelo schema legado se não consolidado: passamos NULL agora (coluna foi tornada opcional)
  INSERT INTO public.china_embarques(
    ordem_compra_id, numero_container, numero_bl, booking_number,
    navio, porto_origem, porto_destino, data_embarque, data_eta,
    peso_total_kg, volume_cbm, qtd_volumes, valor_frete_usd,
    modalidade, observacoes, status, tipo_embarque, created_by
  )
  VALUES (
    v_oc,
    NULLIF(p_payload->>'numero_container',''),
    NULLIF(p_payload->>'numero_bl',''),
    NULLIF(p_payload->>'booking_number',''),
    NULLIF(p_payload->>'navio',''),
    NULLIF(p_payload->>'porto_origem',''),
    NULLIF(p_payload->>'porto_destino',''),
    NULLIF(p_payload->>'data_embarque','')::date,
    NULLIF(p_payload->>'data_eta','')::date,
    NULLIF(p_payload->>'peso_total_kg','')::numeric,
    NULLIF(p_payload->>'volume_cbm','')::numeric,
    NULLIF(p_payload->>'qtd_volumes','')::int,
    NULLIF(p_payload->>'valor_frete_usd','')::numeric,
    COALESCE(NULLIF(p_payload->>'modalidade',''),'FCL'),
    NULLIF(p_payload->>'observacoes',''),
    'rascunho',
    COALESCE(NULLIF(p_payload->>'tipo_embarque',''),'parcial'),
    v_uid
  ) RETURNING id INTO v_emb_id;

  FOR v_item IN SELECT jsonb_array_elements(p_itens) LOOP
    v_op_id := (v_item->>'ordem_producao_id')::uuid;
    v_qty := (v_item->>'qty')::int;
    SELECT qty_disponivel INTO v_disp
    FROM public.vw_op_pronto_embarque WHERE ordem_producao_id = v_op_id;
    IF v_disp IS NULL OR v_disp < v_qty THEN
      RAISE EXCEPTION 'qty exceeds available for OP %', v_op_id;
    END IF;
    INSERT INTO public.china_embarque_itens(embarque_id, ordem_producao_id, qty_embarcada, lote, observacao)
    VALUES (v_emb_id, v_op_id, v_qty, NULLIF(v_item->>'lote',''), NULLIF(v_item->>'observacao',''));
  END LOOP;

  SELECT COALESCE(full_name, email) INTO v_uname FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.produto_doc_audit_log(acao, user_id, user_name, detalhes)
  VALUES ('container_consolidado_criado', v_uid, v_uname,
    jsonb_build_object('embarque_id', v_emb_id, 'qtd_ops', jsonb_array_length(p_itens)));

  RETURN v_emb_id;
END;$$;

-- 7) RPC: fechar container
CREATE OR REPLACE FUNCTION public.rpc_fechar_container(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_uname text;
  v_e public.china_embarques%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (
    check_user_access(v_uid,'china') OR check_user_access(v_uid,'fabrica')
    OR has_role(v_uid,'admin') OR has_role(v_uid,'supervisor')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_e FROM public.china_embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'embarque not found'; END IF;

  IF v_e.numero_bl IS NULL OR v_e.booking_number IS NULL OR v_e.navio IS NULL OR v_e.data_embarque IS NULL THEN
    RAISE EXCEPTION 'fields required: numero_bl, booking_number, navio, data_embarque';
  END IF;

  UPDATE public.china_embarques
    SET status = 'embarcado', updated_at = now()
    WHERE id = p_embarque_id;

  SELECT COALESCE(full_name, email) INTO v_uname FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.produto_doc_audit_log(acao, user_id, user_name, detalhes)
  VALUES ('container_fechado', v_uid, v_uname,
    jsonb_build_object('embarque_id', p_embarque_id, 'numero_bl', v_e.numero_bl, 'navio', v_e.navio));
END;$$;

GRANT EXECUTE ON FUNCTION public.rpc_alocar_op_em_container(uuid,uuid,int,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_container_consolidado(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_fechar_container(uuid) TO authenticated;
