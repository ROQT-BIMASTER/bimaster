-- PR-23: campos novos em pagamentos + RPC retro-compatível
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS codigo_pix varchar(255),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Constraint enum em forma_pagamento (mantém 'API' como legacy + valores reais do ERP)
ALTER TABLE public.pagamentos DROP CONSTRAINT IF EXISTS pagamentos_forma_pagamento_chk;
ALTER TABLE public.pagamentos ADD CONSTRAINT pagamentos_forma_pagamento_chk
  CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('dinheiro','cheque','pix','boleto','cartao','transferencia','API'));

-- RPC process_payment_atomic — assinatura nova com p_forma_pagamento, p_codigo_pix, p_created_by
-- (defaults preservam retro-compatibilidade — chamadas antigas continuam funcionando)
CREATE OR REPLACE FUNCTION public.process_payment_atomic(
  p_titulo_id uuid,
  p_valor numeric,
  p_desconto numeric DEFAULT 0,
  p_juros numeric DEFAULT 0,
  p_multa numeric DEFAULT 0,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_observacao text DEFAULT 'Pagamento registrado via API',
  p_origem text DEFAULT 'internal',
  p_codigo_baixa_integracao text DEFAULT NULL,
  p_conciliar_documento boolean DEFAULT false,
  p_forma_pagamento text DEFAULT 'API',
  p_codigo_pix text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_titulo record;
  v_valor_liquido numeric;
  v_novo_valor_pago numeric;
  v_novo_valor_aberto numeric;
  v_novo_status text;
  v_liquidado boolean;
  v_pagamento_id uuid;
  v_limite_maximo numeric;
BEGIN
  SELECT id, status, valor_original, valor_pago, valor_aberto,
         codigo_lancamento_huggs, codigo_lancamento_integracao, empresa_id
  INTO v_titulo
  FROM public.contas_pagar
  WHERE id = p_titulo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', true, 'code', 'not_found', 'message', 'Título não encontrado');
  END IF;

  IF v_titulo.status = 'cancelado' THEN
    RETURN jsonb_build_object('error', true, 'code', 'cancelled', 'message', 'Título cancelado não pode receber pagamento');
  END IF;

  IF v_titulo.status = 'pago' THEN
    RETURN jsonb_build_object('error', true, 'code', 'already_paid', 'message', 'Título já liquidado');
  END IF;

  v_valor_liquido := p_valor + COALESCE(p_juros, 0) + COALESCE(p_multa, 0) - COALESCE(p_desconto, 0);
  v_novo_valor_pago := COALESCE(v_titulo.valor_pago, 0) + v_valor_liquido;
  v_limite_maximo := COALESCE(v_titulo.valor_original, 0) * 1.5;

  IF v_novo_valor_pago > v_limite_maximo THEN
    RETURN jsonb_build_object('error', true, 'code', 'overpayment',
      'message', format('Valor excede limite (150%% do original = %s)', v_limite_maximo));
  END IF;

  v_novo_valor_aberto := GREATEST(0, COALESCE(v_titulo.valor_original, 0) - v_novo_valor_pago);
  v_liquidado := v_novo_valor_aberto <= 0.01;
  v_novo_status := CASE WHEN v_liquidado THEN 'pago' ELSE 'parcial' END;

  INSERT INTO public.pagamentos (
    conta_pagar_id, valor, data_pagamento, observacoes,
    forma_pagamento, codigo_pix, created_by
  ) VALUES (
    p_titulo_id, v_valor_liquido, p_data_pagamento, p_observacao,
    COALESCE(p_forma_pagamento, 'API'), p_codigo_pix, p_created_by
  ) RETURNING id INTO v_pagamento_id;

  UPDATE public.contas_pagar SET
    valor_pago = v_novo_valor_pago,
    valor_aberto = v_novo_valor_aberto,
    status = v_novo_status,
    data_pagamento = CASE WHEN v_liquidado THEN p_data_pagamento ELSE data_pagamento END,
    data_baixa = CASE WHEN v_liquidado THEN p_data_pagamento ELSE data_baixa END,
    updated_at = now()
  WHERE id = p_titulo_id;

  RETURN jsonb_build_object(
    'error', false,
    'titulo_id', v_titulo.id,
    'pagamento_id', v_pagamento_id,
    'codigo_lancamento_huggs', v_titulo.codigo_lancamento_huggs,
    'codigo_lancamento_integracao', v_titulo.codigo_lancamento_integracao,
    'empresa_id', v_titulo.empresa_id,
    'novo_valor_pago', v_novo_valor_pago,
    'novo_valor_aberto', v_novo_valor_aberto,
    'novo_status', v_novo_status,
    'liquidado', v_liquidado,
    'valor_liquido', v_valor_liquido
  );
END;
$function$;