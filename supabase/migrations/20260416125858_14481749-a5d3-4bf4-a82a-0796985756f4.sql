
-- =====================================================
-- 1A. Idempotency Keys Table
-- =====================================================
CREATE TABLE public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  endpoint text NOT NULL,
  response_body jsonb,
  response_status integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE UNIQUE INDEX idx_idempotency_key_endpoint ON public.idempotency_keys (idempotency_key, endpoint);
CREATE INDEX idx_idempotency_expires ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions use service role key)
CREATE POLICY "Service role full access on idempotency_keys"
  ON public.idempotency_keys
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup expired keys
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.idempotency_keys WHERE expires_at < now();
$$;

-- =====================================================
-- 1B. Atomic Payment Processing RPC
-- =====================================================
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
  p_conciliar_documento boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- 1. Lock and fetch título
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
    RETURN jsonb_build_object('error', true, 'code', 'cancelled', 'message', 'Título cancelado');
  END IF;

  IF v_titulo.status = 'pago' THEN
    RETURN jsonb_build_object('error', true, 'code', 'already_paid', 'message', 'Título já liquidado');
  END IF;

  -- 2. Calculate
  v_valor_liquido := COALESCE(p_valor, 0) - COALESCE(p_desconto, 0) + COALESCE(p_juros, 0) + COALESCE(p_multa, 0);
  v_limite_maximo := COALESCE(v_titulo.valor_original, 0) * 1.05;

  IF (COALESCE(v_titulo.valor_pago, 0) + v_valor_liquido) > v_limite_maximo THEN
    RETURN jsonb_build_object(
      'error', true, 'code', 'overpayment',
      'message', format('Pagamento excede 105%% do título. Original: %s, já pago: %s, tentativa: %s',
        v_titulo.valor_original, v_titulo.valor_pago, v_valor_liquido)
    );
  END IF;

  v_novo_valor_pago := COALESCE(v_titulo.valor_pago, 0) + v_valor_liquido;
  v_novo_valor_aberto := GREATEST(0, COALESCE(v_titulo.valor_original, 0) - v_novo_valor_pago);
  v_liquidado := v_novo_valor_aberto <= 0;
  v_novo_status := CASE WHEN v_liquidado THEN 'pago' ELSE 'parcial' END;

  -- 3. Insert payment
  INSERT INTO public.pagamentos (conta_pagar_id, valor, data_pagamento, metodo_pagamento, observacao, baixa_origem)
  VALUES (v_titulo.id, v_valor_liquido, p_data_pagamento, 'API', p_observacao, 'api')
  RETURNING id INTO v_pagamento_id;

  -- 4. Update título atomically
  UPDATE public.contas_pagar SET
    valor_pago = v_novo_valor_pago,
    valor_aberto = v_novo_valor_aberto,
    status = v_novo_status,
    data_pagamento = CASE WHEN v_liquidado THEN p_data_pagamento ELSE NULL END,
    data_baixa = CASE WHEN v_liquidado THEN now() ELSE NULL END,
    baixa_origem = 'api',
    valor_juros = CASE WHEN p_origem = 'huggs' THEN COALESCE(p_juros, 0) ELSE valor_juros END,
    valor_desconto = CASE WHEN p_origem = 'huggs' THEN COALESCE(p_desconto, 0) ELSE valor_desconto END,
    codigo_baixa_integracao = CASE WHEN p_origem = 'huggs' THEN p_codigo_baixa_integracao ELSE codigo_baixa_integracao END,
    conciliar_documento = CASE WHEN p_origem = 'huggs' THEN p_conciliar_documento ELSE conciliar_documento END,
    updated_at = now()
  WHERE id = v_titulo.id;

  -- 5. Return result
  RETURN jsonb_build_object(
    'error', false,
    'pagamento_id', v_pagamento_id,
    'titulo_id', v_titulo.id,
    'valor_liquido', v_valor_liquido,
    'novo_valor_pago', v_novo_valor_pago,
    'novo_valor_aberto', v_novo_valor_aberto,
    'novo_status', v_novo_status,
    'liquidado', v_liquidado,
    'codigo_lancamento_huggs', v_titulo.codigo_lancamento_huggs,
    'codigo_lancamento_integracao', v_titulo.codigo_lancamento_integracao,
    'empresa_id', v_titulo.empresa_id
  );
END;
$$;
