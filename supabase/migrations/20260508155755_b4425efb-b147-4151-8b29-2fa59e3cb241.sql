-- Criar Ordem de Produção (OP) na China a partir de uma Submissão.
-- OC opcional. Se OC nula, notifica o comprador (created_by da submissão) via inbox.
CREATE OR REPLACE FUNCTION public.rpc_china_criar_op(
  p_submissao_id uuid,
  p_qty numeric,
  p_oc_id uuid DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL,
  p_formula_id uuid DEFAULT NULL,
  p_lote text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_prevista date DEFAULT NULL,
  p_obs text DEFAULT NULL
)
RETURNS TABLE(op_id uuid, numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_numero    text;
  v_op_id     uuid;
  v_sub       public.china_produto_submissoes%ROWTYPE;
  v_oc        public.china_ordens_compra%ROWTYPE;
  v_produto_id uuid := p_produto_id;
  v_formula_id uuid := p_formula_id;
  v_seq       int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  IF NOT (
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'supervisor'::app_role)
    OR public.check_user_access(v_uid, 'fabrica')
    OR public.check_user_access(v_uid, 'china')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para criar OP';
  END IF;

  IF p_submissao_id IS NULL THEN
    RAISE EXCEPTION 'Submissao obrigatoria';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade invalida';
  END IF;

  SELECT * INTO v_sub FROM public.china_produto_submissoes WHERE id = p_submissao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submissao nao encontrada'; END IF;

  -- Resolve produto/fórmula via fabrica_produtos pelo código (se não fornecido)
  IF v_produto_id IS NULL THEN
    SELECT id, formula_id INTO v_produto_id, v_formula_id
    FROM public.fabrica_produtos
    WHERE codigo = v_sub.produto_codigo
    LIMIT 1;
  END IF;

  -- Valida OC quando informada
  IF p_oc_id IS NOT NULL THEN
    SELECT * INTO v_oc FROM public.china_ordens_compra WHERE id = p_oc_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'OC nao encontrada'; END IF;
    IF v_oc.submissao_id <> p_submissao_id THEN
      RAISE EXCEPTION 'OC nao pertence a submissao';
    END IF;
  END IF;

  -- Numeração OP-CN-YYYYMM-####
  SELECT COALESCE(MAX(SUBSTRING(numero FROM 'OP-CN-\d{6}-(\d+)$')::int), 0) + 1
    INTO v_seq
  FROM public.fabrica_ordens_producao
  WHERE numero LIKE 'OP-CN-' || to_char(now(), 'YYYYMM') || '-%';

  v_numero := 'OP-CN-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.fabrica_ordens_producao(
    numero, produto_id, formula_id, quantidade_planejada, status,
    data_prevista, lote, observacoes, created_by
  ) VALUES (
    v_numero, v_produto_id, v_formula_id, p_qty, 'pendente',
    p_data_prevista, p_lote, p_obs, v_uid
  ) RETURNING id INTO v_op_id;

  -- Vincula à OC se houver
  IF p_oc_id IS NOT NULL THEN
    INSERT INTO public.compras_internacional_vinculos(
      china_ordem_compra_id, fabrica_op_id, qty_alocada, observacoes, created_by
    ) VALUES (p_oc_id, v_op_id, p_qty, p_obs, v_uid);
  ELSE
    -- Sem OC: notifica o comprador (created_by da submissão)
    IF v_sub.created_by IS NOT NULL AND v_sub.created_by <> v_uid THEN
      PERFORM public.inbox_emit(
        v_sub.created_by,
        'acao_minha'::inbox_caixa,
        'china'::inbox_origem,
        'china_op_sem_oc',
        'acao'::inbox_modo_leitura,
        'Nova OP sem OC: ' || v_numero,
        'A China criou a Ordem de Produção ' || v_numero || ' para a submissão ' ||
          COALESCE(v_sub.numero_ordem::text, v_sub.produto_codigo) ||
          ' sem vincular a uma Ordem de Compra. Avalie se uma OC deve ser emitida.',
        '/dashboard/fabrica-china/ordens-producao',
        'fabrica_op',
        v_op_id,
        NULL, NULL, NULL,
        'china',
        v_uid,
        jsonb_build_object(
          'submissao_id', p_submissao_id,
          'produto_codigo', v_sub.produto_codigo,
          'qty', p_qty
        )
      );
    END IF;
  END IF;

  RETURN QUERY SELECT v_op_id, v_numero;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_china_criar_op(uuid, numeric, uuid, uuid, uuid, text, date, date, text) TO authenticated;