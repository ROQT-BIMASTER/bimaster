
-- 1) Validação: apontamento não pode ultrapassar qty_pedida da OC para a cor
CREATE OR REPLACE FUNCTION public.fn_china_apont_validate_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido      integer := 0;
  v_apontado    integer := 0;
  v_delta       integer := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := NEW.quantidade;
  ELSIF TG_OP = 'UPDATE' THEN
    v_delta := NEW.quantidade - OLD.quantidade;
  END IF;

  IF v_delta <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(qty_pedida), 0) INTO v_pedido
    FROM public.china_ordem_itens
   WHERE ordem_compra_id = NEW.ordem_compra_id
     AND COALESCE(cor_nome, '') = COALESCE(NEW.cor_nome, '');

  IF v_pedido = 0 THEN
    RETURN NEW; -- OC sem item registrado para essa cor: não bloqueia (legado)
  END IF;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_apontado
    FROM public.china_producao_apontamentos
   WHERE ordem_compra_id = NEW.ordem_compra_id
     AND COALESCE(cor_nome, '') = COALESCE(NEW.cor_nome, '')
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF (v_apontado + NEW.quantidade) > v_pedido THEN
    RAISE EXCEPTION
      'Apontamento (%) ultrapassa o pedido da OC para a cor "%": pedido=%, já apontado=%',
      NEW.quantidade, COALESCE(NEW.cor_nome, '—'), v_pedido, v_apontado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_apont_validate_saldo ON public.china_producao_apontamentos;
CREATE TRIGGER trg_china_apont_validate_saldo
BEFORE INSERT OR UPDATE ON public.china_producao_apontamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_china_apont_validate_saldo();


-- 2) Validação: embarque não pode ultrapassar saldo livre do item de OC
CREATE OR REPLACE FUNCTION public.fn_china_embarque_validate_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido      integer;
  v_cancelado   integer;
  v_embarcado   integer;
  v_saldo       integer;
BEGIN
  IF NEW.ordem_item_id IS NULL THEN
    RETURN NEW; -- itens vinculados só por OP saem desta validação
  END IF;

  SELECT qty_pedida, qty_cancelada
    INTO v_pedido, v_cancelado
    FROM public.china_ordem_itens
   WHERE id = NEW.ordem_item_id;

  IF v_pedido IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(qty_embarcada), 0) INTO v_embarcado
    FROM public.china_embarque_itens
   WHERE ordem_item_id = NEW.ordem_item_id
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  v_saldo := v_pedido - COALESCE(v_cancelado, 0) - v_embarcado;

  IF NEW.qty_embarcada > v_saldo THEN
    RAISE EXCEPTION
      'Embarque (%) ultrapassa o saldo do item de OC: pedido=%, cancelado=%, já embarcado=%, saldo=%',
      NEW.qty_embarcada, v_pedido, COALESCE(v_cancelado, 0), v_embarcado, v_saldo
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_embarque_validate_saldo ON public.china_embarque_itens;
CREATE TRIGGER trg_china_embarque_validate_saldo
BEFORE INSERT OR UPDATE ON public.china_embarque_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_china_embarque_validate_saldo();


-- 3) Auditoria: decisão sobre saldo de OC entra na timeline
CREATE OR REPLACE FUNCTION public.trg_cte_saldo_decisao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.china_timeline_eventos(
    kind, title, descricao, payload, ordem_compra_id, actor_id, dedupe_key
  )
  VALUES (
    'embarque_status',
    'Decisão de saldo: ' || NEW.decisao,
    COALESCE(NEW.justificativa, 'sem justificativa'),
    jsonb_build_object(
      'decisao', NEW.decisao,
      'qty_remanescente', NEW.qty_remanescente,
      'nova_oc_id', NEW.nova_oc_id
    ),
    NEW.ordem_compra_id,
    NEW.decidido_por,
    'saldo-dec-' || NEW.id
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cte_saldo_decisao_ai ON public.china_oc_saldo_decisoes;
CREATE TRIGGER trg_cte_saldo_decisao_ai
AFTER INSERT ON public.china_oc_saldo_decisoes
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_saldo_decisao();
