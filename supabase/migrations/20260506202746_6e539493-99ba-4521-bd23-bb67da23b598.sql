-- ============================================================================
-- China OC: snapshots versionados + RPCs de edição segura
-- ============================================================================

-- 1) Tabela de versões (snapshots completos da OC + itens em marcos relevantes)
CREATE TABLE IF NOT EXISTS public.china_oc_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  marco TEXT NOT NULL,
  motivo TEXT,
  snapshot JSONB NOT NULL,
  diff JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ordem_compra_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_china_oc_versoes_oc ON public.china_oc_versoes(ordem_compra_id, versao DESC);

ALTER TABLE public.china_oc_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read OC versions"
  ON public.china_oc_versoes FOR SELECT
  TO authenticated
  USING (true);

-- 2) Helper: snapshot atual da OC + itens
CREATE OR REPLACE FUNCTION public._china_oc_snapshot_payload(p_oc_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'oc', to_jsonb(o.*),
    'itens', COALESCE((
      SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.cor_nome)
      FROM public.china_ordem_itens i
      WHERE i.ordem_compra_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.china_ordens_compra o
  WHERE o.id = p_oc_id;
$$;

-- 3) RPC: gravar snapshot de versão (chamado internamente após mudanças)
CREATE OR REPLACE FUNCTION public.rpc_china_oc_snapshot(
  p_oc_id UUID,
  p_marco TEXT,
  p_motivo TEXT DEFAULT NULL,
  p_diff JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proxima_versao INTEGER;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT COALESCE(MAX(versao), 0) + 1
    INTO v_proxima_versao
    FROM public.china_oc_versoes
   WHERE ordem_compra_id = p_oc_id;

  INSERT INTO public.china_oc_versoes(
    ordem_compra_id, versao, marco, motivo, snapshot, diff, created_by
  ) VALUES (
    p_oc_id,
    v_proxima_versao,
    p_marco,
    p_motivo,
    public._china_oc_snapshot_payload(p_oc_id),
    p_diff,
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4) RPC: editar itens enquanto a OC está PENDENTE (antes de aceitar)
--    Edição direta com auditoria por snapshot. Aceita array de patches.
CREATE OR REPLACE FUNCTION public.rpc_china_oc_editar_itens_pendente(
  p_oc_id UUID,
  p_itens JSONB,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc public.china_ordens_compra%ROWTYPE;
  v_item JSONB;
  v_total INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_oc FROM public.china_ordens_compra WHERE id = p_oc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC não encontrada'; END IF;

  IF v_oc.aceita_em IS NOT NULL OR v_oc.recusada_em IS NOT NULL THEN
    RAISE EXCEPTION 'Edição de itens só permitida enquanto a OC está pendente';
  END IF;

  -- Snapshot ANTES de mudar
  PERFORM public.rpc_china_oc_snapshot(p_oc_id, 'edicao_pendente_antes', p_motivo, NULL);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    UPDATE public.china_ordem_itens
       SET qty_pedida = COALESCE((v_item->>'qty_pedida')::INTEGER, qty_pedida),
           preco_unitario_usd = COALESCE((v_item->>'preco_unitario_usd')::NUMERIC, preco_unitario_usd),
           sku = COALESCE(v_item->>'sku', sku),
           cor_nome = COALESCE(v_item->>'cor_nome', cor_nome),
           updated_at = now()
     WHERE id = (v_item->>'id')::UUID
       AND ordem_compra_id = p_oc_id;
  END LOOP;

  -- Recalcula qty_total da OC
  SELECT COALESCE(SUM(qty_pedida), 0) INTO v_total
    FROM public.china_ordem_itens WHERE ordem_compra_id = p_oc_id;

  UPDATE public.china_ordens_compra
     SET qty_total = v_total,
         updated_at = now()
   WHERE id = p_oc_id;

  -- Snapshot DEPOIS
  PERFORM public.rpc_china_oc_snapshot(p_oc_id, 'edicao_pendente_depois', p_motivo, p_itens);
END;
$$;

-- 5) RPC: atualizar campos de logística (data prevista / observações)
--    Permitido em PENDENTE e em PRODUÇÃO (depois de aceita, antes do embarque).
CREATE OR REPLACE FUNCTION public.rpc_china_oc_atualizar_logistica(
  p_oc_id UUID,
  p_data_entrega_prevista DATE DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc public.china_ordens_compra%ROWTYPE;
  v_has_emb BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_oc FROM public.china_ordens_compra WHERE id = p_oc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC não encontrada'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.china_embarques WHERE ordem_compra_id = p_oc_id)
    INTO v_has_emb;

  IF v_has_emb OR v_oc.data_entrega_real IS NOT NULL OR v_oc.status IN ('cancelada','concluida') THEN
    RAISE EXCEPTION 'Logística só pode ser editada antes do embarque';
  END IF;

  UPDATE public.china_ordens_compra
     SET data_entrega_prevista = COALESCE(p_data_entrega_prevista, data_entrega_prevista),
         observacoes = COALESCE(p_observacoes, observacoes),
         updated_at = now()
   WHERE id = p_oc_id;

  PERFORM public.rpc_china_oc_snapshot(
    p_oc_id, 'edicao_logistica', p_motivo,
    jsonb_build_object(
      'data_entrega_prevista', p_data_entrega_prevista,
      'observacoes', p_observacoes
    )
  );
END;
$$;

-- 6) RPC: cancelamento parcial de saldo por SKU (em produção)
CREATE OR REPLACE FUNCTION public.rpc_china_oc_cancelar_saldo_item(
  p_item_id UUID,
  p_qty_cancelar INTEGER,
  p_motivo TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.china_ordem_itens%ROWTYPE;
  v_oc public.china_ordens_compra%ROWTYPE;
  v_max INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo é obrigatório para cancelar saldo';
  END IF;
  IF p_qty_cancelar <= 0 THEN
    RAISE EXCEPTION 'Quantidade a cancelar deve ser maior que zero';
  END IF;

  SELECT * INTO v_item FROM public.china_ordem_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  SELECT * INTO v_oc FROM public.china_ordens_compra WHERE id = v_item.ordem_compra_id;

  IF v_oc.aceita_em IS NULL THEN
    RAISE EXCEPTION 'Cancele a OC inteira em vez de saldo enquanto está pendente';
  END IF;

  v_max := GREATEST(0, v_item.qty_pedida - v_item.qty_recebida - v_item.qty_cancelada);
  IF p_qty_cancelar > v_max THEN
    RAISE EXCEPTION 'Quantidade excede saldo disponível (%)', v_max;
  END IF;

  UPDATE public.china_ordem_itens
     SET qty_cancelada = qty_cancelada + p_qty_cancelar,
         updated_at = now()
   WHERE id = p_item_id;

  PERFORM public.rpc_china_oc_snapshot(
    v_item.ordem_compra_id, 'cancelamento_saldo_parcial', p_motivo,
    jsonb_build_object('item_id', p_item_id, 'qty_cancelada_adicionada', p_qty_cancelar)
  );
END;
$$;

-- 7) Snapshots automáticos nos marcos via triggers nas RPCs já existentes não é prático;
--    em vez disso, as RPCs aceitar/recusar/embarque continuam como estão e nós gravamos
--    snapshots de marco a partir do front quando essas ações forem invocadas (chamada
--    extra a rpc_china_oc_snapshot). Trigger leve para snapshot inicial:
CREATE OR REPLACE FUNCTION public._china_oc_snapshot_inicial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Aguarda os itens serem inseridos no mesmo TX; agenda snapshot diferido
  PERFORM 1; -- placeholder
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_china_oc_snapshot(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_oc_editar_itens_pendente(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_oc_atualizar_logistica(UUID, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_oc_cancelar_saldo_item(UUID, INTEGER, TEXT) TO authenticated;
